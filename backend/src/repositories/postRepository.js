import { extractHashtags } from '../utils/hashtag.js';
import { buildPostVisibilityPredicate } from './postVisibility.js';

let savedPostsTableEnsured = false;
async function ensureSavedPostsTable(pool) {
  if (savedPostsTableEnsured || !pool || typeof pool.query !== 'function') return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_posts (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_saved_post UNIQUE (user_id, post_id)
      );
      CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON saved_posts(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON saved_posts(post_id);
    `);
    savedPostsTableEnsured = true;
  } catch (err) {
    // silently continue
  }
}

export const postSelect = `
  SELECT
    p.id,
    p.author_id,
    p.content,
    p.image_url,
    p.image_moderation_status,
    p.image_moderation_label,
    p.image_moderation_safe,
    p.image_moderation_nsfw,
    p.image_moderation_violence,
    p.image_moderation_thresholds,
    p.image_moderation_appealed_at,
    p.privacy,
    p.ai_label,
    p.ai_confidence,
    p.ai_status,
    p.likes_count,
    p.comments_count,
    p.shares_count,
    p.created_at,
    p.updated_at,
    p.edited_at,
    p.original_post_id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.is_verified
  FROM posts p
  JOIN users u ON u.id = p.author_id
`;

const emptyReactionCounts = () => ({
  like: 0,
  love: 0,
  haha: 0,
  wow: 0,
  sad: 0,
  angry: 0,
});

async function fetchCommentReactionMaps(pool, commentRows = [], viewerId = null) {
  const commentIds = commentRows.map((c) => Number(c.id)).filter((id) => Number.isInteger(id) && id > 0);
  const countsByComment = new Map();
  const myReactionByComment = new Map();
  if (commentIds.length === 0) return { countsByComment, myReactionByComment };

  try {
    const countRes = await pool.query(
      `SELECT comment_id, reaction_type, COUNT(*)::int AS count
       FROM comment_reactions
       WHERE comment_id = ANY($1::bigint[])
       GROUP BY comment_id, reaction_type`,
      [commentIds]
    );
    for (const row of countRes?.rows || []) {
      const cid = Number(row.comment_id);
      if (!countsByComment.has(cid)) {
        countsByComment.set(cid, { counts: emptyReactionCounts(), total: 0 });
      }
      const bucket = countsByComment.get(cid);
      if (row.reaction_type in bucket.counts) {
        const cnt = Number(row.count || 0);
        bucket.counts[row.reaction_type] = cnt;
        bucket.total += cnt;
      }
    }

    if (viewerId) {
      const myRes = await pool.query(
        `SELECT comment_id, reaction_type
         FROM comment_reactions
         WHERE user_id = $1 AND comment_id = ANY($2::bigint[])`,
        [viewerId, commentIds]
      );
      for (const row of myRes?.rows || []) {
        myReactionByComment.set(Number(row.comment_id), row.reaction_type);
      }
    }
  } catch {
    // Fallback cleanly if comment_reactions table is absent in mocked unit tests
  }

  return { countsByComment, myReactionByComment };
}

function attachReactionAndCommentsData(
  posts,
  countRows = [],
  myReactionRows = [],
  commentRows = [],
  savedPostIds = new Set(),
  commentReactionMaps = null
) {
  const reactionDataByPost = new Map();
  const commentsByPost = new Map();

  for (const post of posts) {
    const pid = Number(post.id);
    reactionDataByPost.set(pid, {
      counts: emptyReactionCounts(),
      total: 0,
      myReaction: null,
    });
    commentsByPost.set(pid, []);
  }

  for (const row of countRows) {
    const postId = Number(row.post_id);
    const reactionData = reactionDataByPost.get(postId);
    if (!reactionData || !(row.reaction_type in reactionData.counts)) continue;

    const count = Number(row.count || 0);
    reactionData.counts[row.reaction_type] = count;
    reactionData.total += count;
  }

  for (const row of myReactionRows) {
    const reactionData = reactionDataByPost.get(Number(row.post_id));
    if (reactionData) {
      reactionData.myReaction = row.reaction_type;
    }
  }

  const countsByComment = commentReactionMaps?.countsByComment || new Map();
  const myReactionByComment = commentReactionMaps?.myReactionByComment || new Map();

  for (const c of commentRows) {
    const pid = Number(c.post_id);
    const cid = Number(c.id);
    const cReaction = countsByComment.get(cid);
    const reactionCounts = cReaction?.counts || emptyReactionCounts();
    const totalReactions = cReaction?.total || 0;
    const myReaction = myReactionByComment.get(cid) || null;
    if (commentsByPost.has(pid)) {
      commentsByPost.get(pid).push({
        id: String(c.id),
        parentId: c.parent_id ? String(c.parent_id) : null,
        parent_id: c.parent_id ? String(c.parent_id) : null,
        author: {
          id: c.author_id,
          name: c.full_name,
          username: c.username,
          avatar: c.avatar_url,
          isVerified: Boolean(c.is_verified),
          is_verified: Boolean(c.is_verified),
        },
        content: c.content,
        image: c.image_url || null,
        is_hidden: Boolean(c.is_hidden),
        isHidden: Boolean(c.is_hidden),
        is_soft_hidden: Boolean(c.is_soft_hidden),
        isSoftHidden: Boolean(c.is_soft_hidden),
        ai_label: c.ai_label || null,
        aiLabel: c.ai_label || null,
        ai_status: c.ai_status || 'approved',
        aiStatus: c.ai_status || 'approved',
        reactionCounts,
        totalReactions,
        myReaction,
        imageModeration: c.image_moderation_status ? {
          status: c.image_moderation_status,
          scores: { safe: c.image_moderation_safe, nsfw: c.image_moderation_nsfw, violence: c.image_moderation_violence },
          thresholds: c.image_moderation_thresholds,
          appealedAt: c.image_moderation_appealed_at || null,
        } : null,
        created_at: c.created_at,
        time: 'Vừa xong',
      });
    }
  }

  return posts.map((post) => {
    const pid = Number(post.id);
    const reactionData = reactionDataByPost.get(pid);
    const postComments = commentsByPost.get(pid) || [];
    // Bình luận mới nhất lên đầu, bình luận Toxic (ẩn mềm) tự động đưa xuống cuối danh sách
    const sortedComments = [...postComments].sort((a, b) => {
      const aSoft = Boolean(a.is_soft_hidden || a.isSoftHidden);
      const bSoft = Boolean(b.is_soft_hidden || b.isSoftHidden);
      if (aSoft !== bSoft) return aSoft ? 1 : -1;
      const aTime = Date.parse(a.created_at || a.createdAt || 0) || 0;
      const bTime = Date.parse(b.created_at || b.createdAt || 0) || 0;
      if (bTime !== aTime) return bTime - aTime;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
    return {
      ...post,
      reaction_counts: reactionData?.counts || emptyReactionCounts(),
      total_reactions: reactionData?.total || 0,
      my_reaction: reactionData?.myReaction || null,
      is_saved: savedPostIds.has(pid) || Boolean(post.is_saved),
      comments: sortedComments,
    };
  });
}

async function runPostTransaction(pool, work) {
  if (typeof pool.connect !== 'function') return work(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function replacePostHashtags(db, postId, content, { clearExisting = true } = {}) {
  const hashtags = extractHashtags(content);
  if (!clearExisting && hashtags.length === 0) return;
  await db.query('DELETE FROM post_hashtags WHERE post_id = $1', [postId]);
  for (const { tag, displayTag } of hashtags) {
    await db.query(
      `INSERT INTO post_hashtags (post_id, tag, display_tag)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, tag) DO UPDATE SET display_tag = EXCLUDED.display_tag`,
      [postId, tag, displayTag]
    );
  }
}

export function createPostRepository({ pool }) {
  return {
    pool,
    async findAcceptedFriendIds(userId) {
      const result = await pool.query(
        `SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS user_id
         FROM friendships
         WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'`,
        [userId]
      );
      return result.rows.map((row) => row.user_id);
    },
    async createPost({ authorId, content, imageUrl, imageModeration, privacy, aiLabel = 'Normal', aiConfidence = 1.0, aiStatus = 'approved' }) {
      const storedPrivacy = privacy ?? 'public';
      const imgScores = imageModeration?.scores || imageModeration?.images?.[0]?.scores || {};
      const safeScore = imgScores.safe ?? null;
      const nsfwScore = imgScores.nsfw ?? null;
      const violenceScore = imgScores.violence ?? null;
      const imgLabel = nsfwScore >= 0.7 || imageModeration?.decision === 'sensitive' ? 'NSFW'
                     : violenceScore >= 0.8 || imageModeration?.decision === 'rejected' ? 'Violence'
                     : 'Safe';

      const result = await runPostTransaction(pool, async (db) => {
        const insertResult = await db.query(
          `INSERT INTO posts (author_id, content, image_url, privacy, image_moderation_status,
                            image_moderation_label, image_moderation_safe, image_moderation_nsfw,
                            image_moderation_violence, image_moderation_thresholds,
                            ai_label, ai_confidence, ai_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
          [authorId, content, imageUrl, storedPrivacy, imageModeration?.decision || null,
            imgLabel,
            safeScore,
            nsfwScore,
            violenceScore,
            imageModeration?.thresholds || null,
            aiLabel, aiConfidence, aiStatus]
        );
        await replacePostHashtags(db, insertResult.rows[0].id, content, { clearExisting: false });
        return insertResult;
      });

      const inserted = result.rows[0];
      const post = await this.findById(inserted.id, authorId);
      if (post) return post;

      // Keep the create response usable if a visibility race hides the row
      // immediately after INSERT. The database row already exists, so return
      // the inserted values rather than turning a successful write into 500.
      return {
        id: String(inserted.id),
        author_id: authorId,
        content,
        image_url: imageUrl,
        ...(privacy !== undefined ? { privacy: storedPrivacy } : {}),
        image_moderation_status: imageModeration?.decision || null,
        image_moderation_safe: imageModeration?.images?.[0]?.scores?.safe || null,
        image_moderation_nsfw: imageModeration?.images?.[0]?.scores?.nsfw || null,
        image_moderation_violence: imageModeration?.images?.[0]?.scores?.violence || null,
        image_moderation_thresholds: imageModeration?.thresholds || null,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        ai_status: 'approved',
      };
    },

    async findById(postId, viewerId = null) {
      const cleanId = Number(String(postId).replace(/^post-/, ''));
      if (Number.isNaN(cleanId)) return null;

      const result = await pool.query(
        `${postSelect}
         WHERE p.id = $1
           AND ${buildPostVisibilityPredicate('$2')}`,
        [cleanId, viewerId]
      );

      if (!result.rows[0]) return null;

      const countResult = await pool.query(
        `SELECT post_id, reaction_type, COUNT(*)::int AS count
         FROM post_reactions
         WHERE post_id = $1
         GROUP BY post_id, reaction_type`,
        [cleanId]
      );

      const myReactionResult = viewerId
        ? await pool.query(
            `SELECT post_id, reaction_type
             FROM post_reactions
             WHERE user_id = $1 AND post_id = $2`,
            [viewerId, cleanId]
          )
        : { rows: [] };

      const commentResult = await pool.query(
        `SELECT c.id, c.post_id, c.parent_id, c.content, c.image_url, c.image_label,
                c.image_moderation_status, c.image_moderation_safe, c.image_moderation_nsfw,
                c.image_moderation_violence, c.image_moderation_thresholds, c.image_moderation_appealed_at, c.created_at,
                c.is_hidden, c.is_soft_hidden, c.ai_label, c.ai_status,
                u.id AS author_id, u.full_name, u.username, u.avatar_url, u.is_verified
         FROM comments c
         JOIN users u ON u.id = c.author_id
           WHERE c.post_id = $1
             AND c.is_hidden = false
             AND (c.ai_status IS NULL OR c.ai_status != 'hidden')
             AND (c.image_moderation_status IS NULL OR c.image_moderation_status IN ('safe', 'sensitive')
                  OR (c.author_id = $2 AND c.image_moderation_status IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending')))
         ORDER BY c.created_at DESC, c.id DESC`,
        [cleanId, viewerId]
      );

      let isSaved = false;
      if (viewerId) {
        await ensureSavedPostsTable(pool);
        try {
          const savedResult = await pool.query(
            `SELECT 1 FROM saved_posts WHERE user_id = $1 AND post_id = $2`,
            [viewerId, cleanId]
          );
          isSaved = savedResult.rows.length > 0;
        } catch {}
      }

      const commentReactionMaps = await fetchCommentReactionMaps(pool, commentResult.rows, viewerId);

      const post = attachReactionAndCommentsData(
        result.rows,
        countResult.rows,
        myReactionResult.rows,
        commentResult.rows,
        isSaved ? new Set([cleanId]) : new Set(),
        commentReactionMaps
      )[0];

      // Nếu là bài chia sẻ, lấy thêm thông tin bài gốc
      if (post && post.original_post_id) {
        const originalResult = await pool.query(
          `SELECT p.id, p.content, p.image_url, p.created_at, p.ai_status,
                  p.likes_count, p.comments_count, p.shares_count,
                  u.id AS author_id, u.full_name, u.username, u.avatar_url
           FROM posts p
           JOIN users u ON u.id = p.author_id
           WHERE p.id = $1 AND ${buildPostVisibilityPredicate('$2')}`,
          [post.original_post_id, viewerId]
        );
        post.original_post = originalResult.rows[0] || null;
      }

      return post;
    },

    async findByIdForOwnerAction(postId) {
      const cleanId = Number(String(postId).replace(/^post-/, ''));
      if (Number.isNaN(cleanId)) return null;

      const result = await pool.query(
        `${postSelect} WHERE p.id = $1`,
        [cleanId]
      );
      return result.rows[0] || null;
    },

    async updatePost({ postId, authorId, content, imageUrl, imageModeration, aiStatus, aiLabel, aiConfidence }) {
      const moderationFields = imageModeration ? `,
         image_moderation_status = $5,
         image_moderation_label = $6,
         image_moderation_safe = $7,
         image_moderation_nsfw = $8,
         image_moderation_violence = $9,
         image_moderation_thresholds = $10` : '';

      const values = [
        postId,
        authorId,
        content,
        imageUrl,
      ];

      if (imageModeration) {
        values.push(
          imageModeration?.decision || null,
          imageModeration?.label || null,
          imageModeration?.images?.[0]?.scores?.safe ?? null,
          imageModeration?.images?.[0]?.scores?.nsfw ?? null,
          imageModeration?.images?.[0]?.scores?.violence ?? null,
          imageModeration?.thresholds || null
        );
      }

      let aiFields = '';
      if (aiStatus !== undefined || aiLabel !== undefined) {
        const nextIdx = values.length + 1;
        aiFields = `,
         ai_status = $${nextIdx},
         ai_label = $${nextIdx + 1},
         ai_confidence = $${nextIdx + 2}`;
        values.push(
          aiStatus || 'approved',
          aiLabel || 'Normal',
          aiConfidence !== undefined && aiConfidence !== null ? aiConfidence : 0.99
        );
      }

      const result = await runPostTransaction(pool, async (db) => {
        const updateResult = await db.query(
          `UPDATE posts
         SET content = $3, image_url = $4${moderationFields}${aiFields}, edited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND author_id = $2
           AND COALESCE(image_moderation_status, '') NOT IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending', 'rejected_final')
         RETURNING id`,
          values
        );
        if (updateResult.rows[0]) {
          await replacePostHashtags(db, updateResult.rows[0].id, content);
        }
        return updateResult;
      });

      if (!result.rows[0]) {
        const error = new Error('Bài viết không tồn tại');
        error.statusCode = 404;
        throw error;
      }

      return this.findById(result.rows[0].id, authorId);
    },

    async updatePostPrivacy({ postId, authorId, privacy }) {
      const result = await pool.query(
        `UPDATE posts
         SET privacy = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND author_id = $2
           AND COALESCE(image_moderation_status, '') NOT IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending', 'rejected_final')
         RETURNING id`,
        [postId, authorId, privacy]
      );
      if (!result.rows[0]) {
        const error = new Error('\u0042\u00e0i vi\u1ebft kh\u00f4ng t\u1ed3n t\u1ea1i');
        error.statusCode = 404;
        throw error;
      }
      return this.findById(result.rows[0].id, authorId);
    },

    async deletePost({ postId, authorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        const result = await client.query(
          `DELETE FROM posts WHERE id = $1 AND (author_id = $2 OR $2 IS NULL)
             AND COALESCE(image_moderation_status, '') <> 'rejected_final' RETURNING id`,
          [postId, authorId]
        );

        if (!result.rows[0]) {
          const error = new Error('Bài viết không tồn tại');
          error.statusCode = 404;
          throw error;
        }

        await client.query('COMMIT');
        return { id: String(result.rows[0].id) };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async findCommentById(commentId) {
      const cleanId = Number(String(commentId).replace(/^cmt-/, ''));
      if (!Number.isInteger(cleanId) || cleanId <= 0) return null;
      const result = await pool.query(
        `SELECT id, post_id, parent_id, author_id, is_hidden, ai_status
         FROM comments
         WHERE id = $1`,
        [cleanId]
      );
      return result.rows[0] || null;
    },

    async createComment({ postId, authorId, parentId = null, content, imageUrl = null, imageModeration = null, aiLabel = 'Normal', aiConfidence = 1.0, isHidden = false, isSoftHidden = false, aiStatus = 'approved' }) {
      const imgScores = imageModeration?.scores || imageModeration?.images?.[0]?.scores || {};
      const safeScore = imgScores.safe ?? null;
      const nsfwScore = imgScores.nsfw ?? null;
      const violenceScore = imgScores.violence ?? null;
      const imgLabel = nsfwScore >= 0.7 || imageModeration?.decision === 'sensitive' ? 'NSFW'
                     : violenceScore >= 0.8 || imageModeration?.decision === 'rejected' ? 'Violence'
                     : 'Safe';
      let normalizedParentId = null;
      if (parentId !== null && parentId !== undefined && String(parentId).trim() !== '') {
        const parsedParent = Number(String(parentId).replace(/^cmt-/, ''));
        if (!Number.isInteger(parsedParent) || parsedParent <= 0) {
          const error = new Error('Bình luận cha không hợp lệ.');
          error.statusCode = 400;
          throw error;
        }
        normalizedParentId = parsedParent;
      }

      const res = await pool.query(
        `INSERT INTO comments (post_id, author_id, parent_id, content, image_url, image_label,
                              image_moderation_status, image_moderation_safe, image_moderation_nsfw,
                              image_moderation_violence, image_moderation_thresholds,
                              ai_label, ai_confidence, is_hidden, is_soft_hidden, ai_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id, post_id, parent_id, author_id, content, image_url, image_label,
                   image_moderation_status, image_moderation_safe, image_moderation_nsfw,
                   image_moderation_violence, image_moderation_thresholds,
                   ai_label, ai_confidence, is_hidden, is_soft_hidden, ai_status, created_at`,
        [postId, authorId, normalizedParentId, content || '', imageUrl, imgLabel, imageModeration?.decision || null,
          safeScore,
          nsfwScore,
          violenceScore,
          imageModeration?.thresholds || null,
          aiLabel, aiConfidence, Boolean(isHidden), Boolean(isSoftHidden), aiStatus]
      );

      if (!['pending_review', 'rejected_hold'].includes(imageModeration?.decision) && !isHidden) {
        await pool.query(`UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1`, [postId]);
      }

      const detail = await pool.query(
        `SELECT c.id, c.post_id, c.parent_id, c.content, c.image_url, c.image_label,
                c.image_moderation_status, c.image_moderation_safe, c.image_moderation_nsfw,
                c.image_moderation_violence, c.image_moderation_thresholds, c.created_at,
                c.is_hidden, c.is_soft_hidden, c.ai_label, c.ai_status,
                u.id AS author_id, u.full_name, u.username, u.avatar_url, u.is_verified
         FROM comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.id = $1`,
        [res.rows[0].id]
      );

      // Gửi thông báo cho chủ bài viết (nếu người bình luận không phải chính tác giả và không bị ẩn cứng)
      try {
        if (['pending_review', 'rejected_hold'].includes(imageModeration?.decision) || isHidden) {
          return detail.rows[0];
        }
        const postRes = await pool.query(`SELECT author_id FROM posts WHERE id = $1`, [postId]);
        if (postRes.rows.length > 0) {
          const postAuthorId = postRes.rows[0].author_id;
          if (postAuthorId && postAuthorId !== authorId) {
            await pool.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
               VALUES ($1, $2, 'comment', $3, $4)`,
              [postAuthorId, authorId, 'đã bình luận về bài viết của bạn', postId]
            );
          }
        }
      } catch (notifErr) {
        console.error('Lỗi gửi thông báo bình luận:', notifErr.message);
      }

      return detail.rows[0];
    },

    async findVisiblePosts({ viewerId }) {
      const params = [];
      let visibilityWhere = buildPostVisibilityPredicate();

      if (viewerId) {
        params.push(viewerId);
        visibilityWhere = buildPostVisibilityPredicate('$1');
      }

      const result = await pool.query(
        `${postSelect}
         WHERE ${visibilityWhere}
         ORDER BY p.created_at DESC`,
        params
      );

      if (result.rows.length === 0) {
        return [];
      }

      const postIds = result.rows.map((post) => post.id);

      const countResult = await pool.query(
        `SELECT post_id, reaction_type, COUNT(*)::int AS count
         FROM post_reactions
         WHERE post_id = ANY($1::bigint[])
         GROUP BY post_id, reaction_type`,
        [postIds]
      );

      const myReactionResult = viewerId
        ? await pool.query(
            `SELECT post_id, reaction_type
             FROM post_reactions
             WHERE user_id = $1 AND post_id = ANY($2::bigint[])`,
            [viewerId, postIds]
          )
        : { rows: [] };

      const commentsResult = await pool.query(
        `SELECT c.id, c.post_id, c.parent_id, c.content, c.image_url, c.image_label, c.created_at,
                c.image_moderation_status, c.image_moderation_safe, c.image_moderation_nsfw,
                c.image_moderation_violence, c.image_moderation_thresholds,
                c.image_moderation_appealed_at,
                c.is_hidden, c.is_soft_hidden, c.ai_label, c.ai_status,
                u.id AS author_id, u.full_name, u.username, u.avatar_url, u.is_verified
         FROM comments c
         JOIN users u ON u.id = c.author_id
           WHERE c.post_id = ANY($1::bigint[])
             AND c.is_hidden = false
             AND (c.ai_status IS NULL OR c.ai_status != 'hidden')
             AND (c.image_moderation_status IS NULL OR c.image_moderation_status IN ('safe', 'sensitive')
                  OR (c.author_id = $2 AND c.image_moderation_status IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending')))
         ORDER BY c.created_at DESC, c.id DESC`,
        [postIds, viewerId]
      );

      let savedPostIds = new Set();
      if (viewerId) {
        await ensureSavedPostsTable(pool);
        try {
          const savedResult = await pool.query(
            `SELECT post_id FROM saved_posts WHERE user_id = $1 AND post_id = ANY($2::bigint[])`,
            [viewerId, postIds]
          );
          savedPostIds = new Set(savedResult.rows.map((r) => Number(r.post_id)));
        } catch {}
      }

      const commentReactionMaps = await fetchCommentReactionMaps(pool, commentsResult.rows, viewerId);
      const posts = attachReactionAndCommentsData(
        result.rows,
        countResult.rows,
        myReactionResult.rows,
        commentsResult.rows,
        savedPostIds,
        commentReactionMaps
      );

      // Lấy thông tin bài gốc cho các bài chia sẻ
      const originalPostIds = posts
        .filter((p) => p.original_post_id)
        .map((p) => p.original_post_id);

      if (originalPostIds.length > 0) {
        const originalPostsResult = await pool.query(
          `SELECT p.id, p.content, p.image_url, p.created_at, p.ai_status,
                  p.likes_count, p.comments_count, p.shares_count,
                  u.id AS author_id, u.full_name, u.username, u.avatar_url
           FROM posts p
           JOIN users u ON u.id = p.author_id
           WHERE p.id = ANY($1::bigint[]) AND ${buildPostVisibilityPredicate('$2')}`,
          [originalPostIds, viewerId]
        );
        const originalPostMap = new Map(originalPostsResult.rows.map((op) => [Number(op.id), op]));
        return posts.map((p) => ({
          ...p,
          original_post: p.original_post_id ? (originalPostMap.get(Number(p.original_post_id)) || null) : null,
        }));
      }

      return posts;
    },

    async sharePost({ sharerId, originalPostId, content }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Tạo bài chia sẻ mới liên kết tới bài gốc
        const insertResult = await client.query(
          `INSERT INTO posts (author_id, content, original_post_id, privacy)
           VALUES ($1, $2, $3, 'public')
           RETURNING id`,
          [sharerId, content || '', originalPostId]
        );

        const newPostId = insertResult.rows[0].id;

        // Tăng shares_count của bài gốc
        await client.query(
          `UPDATE posts SET shares_count = shares_count + 1 WHERE id = $1`,
          [originalPostId]
        );

        // Gửi thông báo cho tác giả bài viết gốc nếu người chia sẻ không phải chính họ
        const origPostRes = await client.query(`SELECT author_id FROM posts WHERE id = $1`, [originalPostId]);
        if (origPostRes.rows.length > 0) {
          const originalAuthorId = origPostRes.rows[0].author_id;
          if (originalAuthorId && originalAuthorId !== sharerId) {
            await client.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
               VALUES ($1, $2, 'share', $3, $4)`,
              [originalAuthorId, sharerId, 'đã chia sẻ bài viết của bạn', originalPostId]
            );
          }
        }

        await client.query('COMMIT');
        return this.findById(newPostId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async toggleSavePost({ userId, postId }) {
      if (!userId) {
        const error = new Error('Bạn cần đăng nhập để lưu bài viết');
        error.statusCode = 401;
        throw error;
      }
      const cleanId = Number(String(postId).replace(/^post-/, ''));
      if (Number.isNaN(cleanId)) {
        const error = new Error('ID bài viết không hợp lệ');
        error.statusCode = 400;
        throw error;
      }

      await ensureSavedPostsTable(pool);

      const checkRes = await pool.query(
        `SELECT id FROM saved_posts WHERE user_id = $1 AND post_id = $2`,
        [userId, cleanId]
      );

      if (checkRes.rows.length > 0) {
        await pool.query(
          `DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2`,
          [userId, cleanId]
        );
        return { isSaved: false, postId: String(cleanId) };
      } else {
        await pool.query(
          `INSERT INTO saved_posts (user_id, post_id, created_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, post_id) DO NOTHING`,
          [userId, cleanId]
        );
        return { isSaved: true, postId: String(cleanId) };
      }
    },

    async getSavedPosts({ userId }) {
      if (!userId) return [];
      await ensureSavedPostsTable(pool);

      const result = await pool.query(
        `${postSelect}
         JOIN saved_posts sp ON sp.post_id = p.id
         WHERE sp.user_id = $1
           AND p.ai_status != 'hidden'
           AND (p.image_moderation_status IS NULL OR p.image_moderation_status IN ('safe', 'sensitive') OR p.author_id = $1)
         ORDER BY sp.created_at DESC`,
        [userId]
      );

      if (result.rows.length === 0) return [];
      const postIds = result.rows.map((p) => p.id);

      const countResult = await pool.query(
        `SELECT post_id, reaction_type, COUNT(*)::int AS count
         FROM post_reactions
         WHERE post_id = ANY($1::bigint[])
         GROUP BY post_id, reaction_type`,
        [postIds]
      );

      const myReactionResult = await pool.query(
        `SELECT post_id, reaction_type
         FROM post_reactions
         WHERE user_id = $1 AND post_id = ANY($2::bigint[])`,
        [userId, postIds]
      );

      const commentsResult = await pool.query(
        `SELECT c.id, c.post_id, c.parent_id, c.content, c.image_url, c.image_label, c.created_at,
                c.image_moderation_status, c.image_moderation_safe, c.image_moderation_nsfw,
                c.image_moderation_violence, c.image_moderation_thresholds,
                c.image_moderation_appealed_at,
                c.is_hidden, c.is_soft_hidden, c.ai_label, c.ai_status,
                u.id AS author_id, u.full_name, u.username, u.avatar_url, u.is_verified
         FROM comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.post_id = ANY($1::bigint[])
           AND c.is_hidden = false
           AND (c.ai_status IS NULL OR c.ai_status != 'hidden')
           AND (c.image_moderation_status IS NULL OR c.image_moderation_status IN ('safe', 'sensitive')
                OR (c.author_id = $2 AND c.image_moderation_status IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending')))
         ORDER BY c.created_at DESC, c.id DESC`,
        [postIds, userId]
      );

      const commentReactionMaps = await fetchCommentReactionMaps(pool, commentsResult.rows, userId);
      const savedSet = new Set(postIds.map(Number));
      const posts = attachReactionAndCommentsData(
        result.rows,
        countResult.rows,
        myReactionResult.rows,
        commentsResult.rows,
        savedSet,
        commentReactionMaps
      );

      const originalPostIds = posts
        .filter((p) => p.original_post_id)
        .map((p) => p.original_post_id);

      if (originalPostIds.length > 0) {
        const originalPostsResult = await pool.query(
          `SELECT p.id, p.content, p.image_url, p.created_at, p.ai_status,
                  p.likes_count, p.comments_count, p.shares_count,
                  u.id AS author_id, u.full_name, u.username, u.avatar_url
           FROM posts p
           JOIN users u ON u.id = p.author_id
           WHERE p.id = ANY($1::bigint[]) AND p.ai_status = 'approved'
             AND (p.image_moderation_status IS NULL OR p.image_moderation_status IN ('safe', 'sensitive'))`,
          [originalPostIds]
        );
        const originalPostMap = new Map(originalPostsResult.rows.map((op) => [Number(op.id), op]));
        return posts.map((p) => ({
          ...p,
          original_post: p.original_post_id ? (originalPostMap.get(Number(p.original_post_id)) || null) : null,
        }));
      }

      return posts;
    },
  };
}

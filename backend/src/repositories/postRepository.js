const postSelect = `
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

function attachReactionAndCommentsData(posts, countRows = [], myReactionRows = [], commentRows = []) {
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

  for (const c of commentRows) {
    const pid = Number(c.post_id);
    if (commentsByPost.has(pid)) {
      commentsByPost.get(pid).push({
        id: String(c.id),
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
    // Bình luận Toxic (ẩn mềm) tự động đưa xuống cuối danh sách
    const sortedComments = [...postComments].sort((a, b) => {
      const aSoft = Boolean(a.is_soft_hidden || a.isSoftHidden);
      const bSoft = Boolean(b.is_soft_hidden || b.isSoftHidden);
      if (aSoft === bSoft) return 0;
      return aSoft ? 1 : -1;
    });
    return {
      ...post,
      reaction_counts: reactionData?.counts || emptyReactionCounts(),
      total_reactions: reactionData?.total || 0,
      my_reaction: reactionData?.myReaction || null,
      comments: sortedComments,
    };
  });
}

export function createPostRepository({ pool }) {
  return {
    pool,
    async createPost({ authorId, content, imageUrl, imageModeration, privacy = 'public', aiLabel = 'Normal', aiConfidence = 1.0, aiStatus = 'approved' }) {
      const imgScores = imageModeration?.scores || imageModeration?.images?.[0]?.scores || {};
      const safeScore = imgScores.safe ?? null;
      const nsfwScore = imgScores.nsfw ?? null;
      const violenceScore = imgScores.violence ?? null;
      const imgLabel = nsfwScore >= 0.7 || imageModeration?.decision === 'sensitive' ? 'NSFW'
                     : violenceScore >= 0.8 || imageModeration?.decision === 'rejected' ? 'Violence'
                     : 'Safe';

      const result = await pool.query(
        `INSERT INTO posts (author_id, content, image_url, privacy, image_moderation_status,
                            image_moderation_label, image_moderation_safe, image_moderation_nsfw,
                            image_moderation_violence, image_moderation_thresholds,
                            ai_label, ai_confidence, ai_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [authorId, content, imageUrl, privacy, imageModeration?.decision || null,
          imgLabel,
          safeScore,
          nsfwScore,
          violenceScore,
          imageModeration?.thresholds || null,
          aiLabel, aiConfidence, aiStatus]
      );

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
        privacy,
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
           AND (
             p.image_moderation_status IS NULL
             OR p.image_moderation_status IN ('safe', 'sensitive')
             OR (p.author_id = $2
                 AND p.image_moderation_status IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending'))
           )`,
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
        `SELECT c.id, c.post_id, c.content, c.image_url, c.image_label,
                c.image_moderation_status, c.image_moderation_safe, c.image_moderation_nsfw,
                c.image_moderation_violence, c.image_moderation_thresholds, c.image_moderation_appealed_at, c.created_at,
                c.is_hidden, c.is_soft_hidden, c.ai_label, c.ai_status,
                u.id AS author_id, u.full_name, u.username, u.avatar_url, u.is_verified
         FROM comments c
         JOIN users u ON u.id = c.author_id
           WHERE c.post_id = $1 AND (c.is_hidden = false OR c.author_id = $2)
             AND (c.image_moderation_status IS NULL OR c.image_moderation_status IN ('safe', 'sensitive')
                  OR (c.author_id = $2 AND c.image_moderation_status IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending')))
         ORDER BY c.created_at ASC`,
        [cleanId, viewerId]
      );

      const post = attachReactionAndCommentsData(result.rows, countResult.rows, myReactionResult.rows, commentResult.rows)[0];

      // Nếu là bài chia sẻ, lấy thêm thông tin bài gốc
      if (post && post.original_post_id) {
        const originalResult = await pool.query(
          `SELECT p.id, p.content, p.image_url, p.created_at, p.ai_status,
                  p.likes_count, p.comments_count, p.shares_count,
                  u.id AS author_id, u.full_name, u.username, u.avatar_url
           FROM posts p
           JOIN users u ON u.id = p.author_id
           WHERE p.id = $1 AND p.ai_status = 'approved'
             AND (p.image_moderation_status IS NULL OR p.image_moderation_status IN ('safe', 'sensitive'))`,
          [post.original_post_id]
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
         ai_status = ${nextIdx},
         ai_label = ${nextIdx + 1},
         ai_confidence = ${nextIdx + 2}`;
        values.push(
          aiStatus || 'approved',
          aiLabel || 'Normal',
          aiConfidence !== undefined && aiConfidence !== null ? aiConfidence : 0.99
        );
      }

      const result = await pool.query(
        `UPDATE posts
         SET content = $3, image_url = $4${moderationFields}${aiFields}, edited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND author_id = $2
           AND COALESCE(image_moderation_status, '') NOT IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending', 'rejected_final')
         RETURNING id`,
        values
      );

      if (!result.rows[0]) {
        const error = new Error('Bài viết không tồn tại');
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

    async createComment({ postId, authorId, content, imageUrl = null, imageModeration = null, aiLabel = 'Normal', aiConfidence = 1.0, isHidden = false, isSoftHidden = false, aiStatus = 'approved' }) {
      const imgScores = imageModeration?.scores || imageModeration?.images?.[0]?.scores || {};
      const safeScore = imgScores.safe ?? null;
      const nsfwScore = imgScores.nsfw ?? null;
      const violenceScore = imgScores.violence ?? null;
      const imgLabel = nsfwScore >= 0.7 || imageModeration?.decision === 'sensitive' ? 'NSFW'
                     : violenceScore >= 0.8 || imageModeration?.decision === 'rejected' ? 'Violence'
                     : 'Safe';

      const res = await pool.query(
        `INSERT INTO comments (post_id, author_id, content, image_url, image_label,
                              image_moderation_status, image_moderation_safe, image_moderation_nsfw,
                              image_moderation_violence, image_moderation_thresholds,
                              ai_label, ai_confidence, is_hidden, is_soft_hidden, ai_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id, post_id, author_id, content, image_url, image_label,
                   image_moderation_status, image_moderation_safe, image_moderation_nsfw,
                   image_moderation_violence, image_moderation_thresholds,
                   ai_label, ai_confidence, is_hidden, is_soft_hidden, ai_status, created_at`,
        [postId, authorId, content || '', imageUrl, imgLabel, imageModeration?.decision || null,
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
        `SELECT c.id, c.post_id, c.content, c.image_url, c.image_label,
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
      let visibilityWhere = `p.ai_status = 'approved'
        AND (p.image_moderation_status IS NULL OR p.image_moderation_status IN ('safe', 'sensitive'))`;

      if (viewerId) {
        params.push(viewerId);
        visibilityWhere = `(p.ai_status = 'approved' OR p.author_id = $1)
          AND (p.image_moderation_status IS NULL OR p.image_moderation_status IN ('safe', 'sensitive')
               OR (p.author_id = $1 AND p.image_moderation_status IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending')))`;
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
        `SELECT c.id, c.post_id, c.content, c.image_url, c.image_label, c.created_at,
                c.image_moderation_status, c.image_moderation_safe, c.image_moderation_nsfw,
                c.image_moderation_violence, c.image_moderation_thresholds,
                c.image_moderation_appealed_at,
                c.is_hidden, c.is_soft_hidden, c.ai_label, c.ai_status,
                u.id AS author_id, u.full_name, u.username, u.avatar_url, u.is_verified
         FROM comments c
         JOIN users u ON u.id = c.author_id
           WHERE c.post_id = ANY($1::bigint[]) AND (c.is_hidden = false OR c.author_id = $2)
             AND (c.image_moderation_status IS NULL OR c.image_moderation_status IN ('safe', 'sensitive')
                  OR (c.author_id = $2 AND c.image_moderation_status IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending')))
         ORDER BY c.created_at ASC`,
        [postIds, viewerId]
      );

      const posts = attachReactionAndCommentsData(result.rows, countResult.rows, myReactionResult.rows, commentsResult.rows);

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
  };
}

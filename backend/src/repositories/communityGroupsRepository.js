import { applyTrustPenalty } from '../services/trustScoreService.js';

async function inTransaction(pool, work) {
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

async function notifyGroupPostPenalty(pool, { userId, amount, groupId, postId, label }) {
  if (typeof pool.query !== 'function') return;
  try {
    await pool.query(
      `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
       VALUES ($1, NULL, 'ai_moderation', $2, NULL)`,
      [userId, `Điểm uy tín của bạn bị trừ ${amount} điểm do bài viết nhóm #${groupId}, bài #${postId} vi phạm nhãn ${label}.`]
    );
  } catch (error) {
    console.warn('Không thể gửi thông báo trừ điểm bài viết nhóm:', error.message);
  }
}

const groupSelect = `
  SELECT g.id::text AS id, g.name, g.description, g.rules, g.privacy,
         g.is_discoverable AS "isDiscoverable", g.post_approval_mode AS "postApprovalMode",
         g.created_by AS "createdBy",
         g.created_at AS "createdAt",
         COUNT(DISTINCT active_member.user_id)::int AS "memberCount",
         mine.role AS "currentRole", mine.status AS "membershipStatus",
         CASE WHEN mine.status = 'active' AND mine.role IN ('owner', 'admin', 'moderator')
              THEN mine.moderation_score ELSE NULL END AS "moderationScore"
  FROM community_groups g
  LEFT JOIN community_group_members active_member
    ON active_member.group_id = g.id AND active_member.status = 'active'
  LEFT JOIN community_group_members mine
    ON mine.group_id = g.id AND mine.user_id = $1
`;

export function createCommunityGroupsRepository({ pool }) {
  return {
    async listGroups({ viewerId = null, search = '' } = {}) {
      const result = await pool.query(
        `${groupSelect}
         WHERE (g.privacy = 'public' OR g.is_discoverable = TRUE
                OR mine.status IN ('active', 'pending'))
           AND ($2 = '' OR g.name ILIKE '%' || $2 || '%' OR g.description ILIKE '%' || $2 || '%')
         GROUP BY g.id, mine.role, mine.status, mine.moderation_score
         ORDER BY g.created_at DESC`,
        [viewerId, search]
      );
      return result.rows;
    },

    async listHomePosts({ viewerId = null, search = '' }) {
      const result = await pool.query(
        `SELECT p.id::text AS id, p.group_id::text AS "groupId", g.name AS "groupName",
                p.author_id AS "authorId", u.full_name AS "authorName", u.username,
                u.avatar_url AS "authorAvatar", u.is_verified AS "authorIsVerified",
                p.content, p.image_url AS "imageUrl", p.image_moderation AS "imageModeration",
                p.ai_label AS "aiLabel", p.ai_confidence AS "aiConfidence", FALSE AS "canRecommend",
                p.ai_action AS "aiAction", p.ai_source AS "aiSource",
                p.edited_at AS "editedAt", p.created_at AS "createdAt",
                TRUE AS "isGroupPost",
                ($1 IS NOT NULL AND EXISTS (
                  SELECT 1 FROM saved_group_posts sp
                  WHERE sp.post_id = p.id AND sp.user_id = $1
                )) AS "isSaved",
                EXISTS (SELECT 1 FROM community_group_members mine
                        WHERE mine.group_id = p.group_id AND mine.user_id = $1 AND mine.status = 'active') AS "canInteract",
                (SELECT COUNT(*)::int FROM community_group_post_reactions r WHERE r.post_id = p.id) AS "likesCount",
                (SELECT COALESCE(jsonb_object_agg(summary.reaction_type, summary.count), '{}'::jsonb)
                 FROM (SELECT r.reaction_type, COUNT(*)::int AS count
                       FROM community_group_post_reactions r WHERE r.post_id = p.id
                       GROUP BY r.reaction_type) summary) AS "reactionCounts",
                (SELECT r.reaction_type FROM community_group_post_reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS "myReaction",
                (SELECT COUNT(*)::int FROM community_group_post_comments c WHERE c.post_id = p.id) AS "commentsCount",
                (SELECT COUNT(*)::int FROM community_group_post_shares s WHERE s.post_id = p.id) AS "sharesCount"
         FROM community_group_posts p
         JOIN community_groups g ON g.id = p.group_id
         JOIN users u ON u.id = p.author_id
         WHERE p.review_status = 'approved'
           AND (
             ($1 IS NOT NULL AND EXISTS (
               SELECT 1 FROM community_group_members membership
               WHERE membership.group_id = p.group_id
                 AND membership.user_id = $1
                 AND membership.status = 'active'
             ))
             OR ($2 <> '' AND g.privacy = 'public' AND (
               p.content ILIKE '%' || $2 || '%'
               OR g.name ILIKE '%' || $2 || '%'
               OR u.username ILIKE '%' || $2 || '%'
               OR u.full_name ILIKE '%' || $2 || '%'
             ))
           )
         ORDER BY p.created_at DESC
         LIMIT 100`,
        [viewerId, search]
      );
      return result.rows;
    },

    async listSavedPosts({ userId }) {
      if (!userId) return [];
      const result = await pool.query(
        `SELECT p.id::text AS id, p.group_id::text AS "groupId", g.name AS "groupName",
                p.author_id AS "authorId", u.full_name AS "authorName", u.username,
                u.avatar_url AS "authorAvatar", u.is_verified AS "authorIsVerified",
                p.content, p.image_url AS "imageUrl", p.image_moderation AS "imageModeration",
                p.ai_label AS "aiLabel", p.ai_confidence AS "aiConfidence", FALSE AS "canRecommend",
                p.ai_action AS "aiAction", p.ai_source AS "aiSource",
                p.review_status AS status, p.edited_at AS "editedAt",
                p.created_at AS "createdAt", sp.created_at AS "savedAt",
                TRUE AS "isGroupPost", TRUE AS "isSaved",
                EXISTS (SELECT 1 FROM community_group_members mine
                        WHERE mine.group_id = p.group_id AND mine.user_id = $1 AND mine.status = 'active') AS "canInteract",
                (SELECT COUNT(*)::int FROM community_group_post_reactions r WHERE r.post_id = p.id) AS "likesCount",
                (SELECT COALESCE(jsonb_object_agg(summary.reaction_type, summary.count), '{}'::jsonb)
                 FROM (SELECT r.reaction_type, COUNT(*)::int AS count
                       FROM community_group_post_reactions r WHERE r.post_id = p.id
                       GROUP BY r.reaction_type) summary) AS "reactionCounts",
                (SELECT r.reaction_type FROM community_group_post_reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS "myReaction",
                (SELECT COUNT(*)::int FROM community_group_post_comments c WHERE c.post_id = p.id) AS "commentsCount",
                (SELECT COUNT(*)::int FROM community_group_post_shares s WHERE s.post_id = p.id) AS "sharesCount"
         FROM saved_group_posts sp
         JOIN community_group_posts p ON p.id = sp.post_id
         JOIN community_groups g ON g.id = p.group_id
         JOIN users u ON u.id = p.author_id
         WHERE sp.user_id = $1
           AND p.review_status = 'approved'
           AND (g.privacy = 'public' OR EXISTS (
             SELECT 1 FROM community_group_members gm
             WHERE gm.group_id = g.id AND gm.user_id = $1 AND gm.status = 'active'
           ))
         ORDER BY sp.created_at DESC`,
        [userId]
      );
      return result.rows;
    },

    async toggleSavePost({ userId, groupId, postId }) {
      const existing = await pool.query(
        `SELECT id FROM saved_group_posts WHERE user_id = $1 AND post_id = $2`,
        [userId, postId]
      );
      if (existing.rows.length > 0) {
        await pool.query(
          `DELETE FROM saved_group_posts WHERE user_id = $1 AND post_id = $2`,
          [userId, postId]
        );
        return { isSaved: false, postId: String(postId), groupId: String(groupId) };
      }
      await pool.query(
        `INSERT INTO saved_group_posts (user_id, post_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, post_id) DO NOTHING`,
        [userId, postId]
      );
      return { isSaved: true, postId: String(postId), groupId: String(groupId) };
    },

    async findGroup(groupId, viewerId = null) {
      const result = await pool.query(
        `${groupSelect}
         WHERE g.id = $2
         GROUP BY g.id, mine.role, mine.status, mine.moderation_score`,
        [viewerId, groupId]
      );
      return result.rows[0] || null;
    },

    async createGroup({ name, description, rules, privacy, isDiscoverable, postApprovalMode, creatorId }) {
      return inTransaction(pool, async (db) => {
        const created = await db.query(
          `INSERT INTO community_groups
             (name, description, rules, privacy, is_discoverable, post_approval_mode, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id::text AS id, name, description, rules, privacy,
                     is_discoverable AS "isDiscoverable", post_approval_mode AS "postApprovalMode",
                     created_by AS "createdBy", created_at AS "createdAt"`,
          [name, description, rules, privacy, isDiscoverable, postApprovalMode, creatorId]
        );
        const group = created.rows[0];
        await db.query(
          `INSERT INTO community_group_members (group_id, user_id, role, status)
           VALUES ($1, $2, 'owner', 'active')`,
          [group.id, creatorId]
        );
        return { ...group, memberCount: 1, currentRole: 'owner', membershipStatus: 'active' };
      });
    },

    async updatePostApprovalMode({ groupId, postApprovalMode, actorId }) {
      const result = await pool.query(
        `UPDATE community_groups g
         SET post_approval_mode = $2, updated_at = CURRENT_TIMESTAMP
         WHERE g.id = $1
           AND EXISTS (
             SELECT 1 FROM community_group_members actor
             WHERE actor.group_id = g.id AND actor.user_id = $3
               AND actor.role IN ('owner', 'admin') AND actor.status = 'active'
           )
         RETURNING g.id::text AS id, g.post_approval_mode AS "postApprovalMode"`,
        [groupId, postApprovalMode, actorId]
      );
      return result.rows[0] || null;
    },

    async findMembership(groupId, userId) {
      const result = await pool.query(
        `SELECT group_id::text AS "groupId", user_id AS "userId", role, status,
                requested_at AS "requestedAt"
         FROM community_group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, userId]
      );
      return result.rows[0] || null;
    },

    async upsertMembership({ groupId, userId, status }) {
      const result = await pool.query(
        `INSERT INTO community_group_members (group_id, user_id, role, status)
         VALUES ($1, $2, 'member', $3)
         ON CONFLICT (group_id, user_id) DO UPDATE
           SET role = 'member', status = EXCLUDED.status, requested_at = CURRENT_TIMESTAMP,
               reviewed_by = NULL, reviewed_at = NULL
         WHERE community_group_members.status IN ('left', 'rejected')
         RETURNING group_id::text AS "groupId", user_id AS "userId", role, status,
                   requested_at AS "requestedAt"`,
        [groupId, userId, status]
      );
      return result.rows[0] || null;
    },

    async leaveGroup(groupId, userId) {
      const result = await pool.query(
        `UPDATE community_group_members
         SET status = 'left', reviewed_at = CURRENT_TIMESTAMP
         WHERE group_id = $1 AND user_id = $2 AND status = 'active' AND role <> 'owner'
         RETURNING group_id::text AS "groupId", user_id AS "userId", status`,
        [groupId, userId]
      );
      return result.rows[0] || null;
    },

    async listMembers(groupId) {
      const result = await pool.query(
        `SELECT gm.user_id AS id, u.full_name AS name, u.username, u.avatar_url AS avatar,
                gm.role, gm.status, gm.requested_at AS "requestedAt"
         FROM community_group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = $1 AND gm.status = 'active'
         ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END,
                  gm.requested_at ASC`,
        [groupId]
      );
      return result.rows;
    },

    async listMemberRequests(groupId) {
      const result = await pool.query(
        `SELECT gm.user_id AS id, u.full_name AS name, u.username, u.avatar_url AS avatar,
                gm.requested_at AS "requestedAt"
         FROM community_group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = $1 AND gm.status = 'pending'
         ORDER BY gm.requested_at ASC`,
        [groupId]
      );
      return result.rows;
    },

    async updateMemberRole({ groupId, userId, role, actorId }) {
      const result = await pool.query(
        `UPDATE community_group_members target
         SET role = $3
         WHERE target.group_id = $1 AND target.user_id = $2 AND target.status = 'active'
           AND target.role <> 'owner'
           AND EXISTS (
             SELECT 1 FROM community_group_members actor
             WHERE actor.group_id = $1 AND actor.user_id = $4
               AND actor.role = 'owner' AND actor.status = 'active'
           )
         RETURNING target.user_id AS id, target.role, target.status`,
        [groupId, userId, role, actorId]
      );
      return result.rows[0] || null;
    },

    async listPosts({ groupId, viewerId, includePending }) {
      const result = await pool.query(
        `SELECT p.id::text AS id, p.group_id::text AS "groupId", p.author_id AS "authorId",
                u.full_name AS "authorName", u.username, u.avatar_url AS "authorAvatar",
                u.is_verified AS "authorIsVerified",
                p.content, p.image_url AS "imageUrl", p.image_moderation AS "imageModeration",
                p.review_status AS status, p.ai_label AS "aiLabel",
                p.ai_confidence AS "aiConfidence", p.ai_action AS "aiAction", p.ai_source AS "aiSource",
                p.review_note AS "reviewNote", p.reviewed_at AS "reviewedAt",
                p.edited_at AS "editedAt", p.created_at AS "createdAt",
                ($2::uuid IS NOT NULL AND EXISTS (
                  SELECT 1 FROM saved_group_posts sp
                  WHERE sp.post_id = p.id AND sp.user_id = $2
                )) AS "isSaved",
                (SELECT COUNT(*)::int FROM community_group_post_reactions r WHERE r.post_id = p.id) AS "likesCount",
                (SELECT COALESCE(jsonb_object_agg(summary.reaction_type, summary.count), '{}'::jsonb)
                 FROM (SELECT r.reaction_type, COUNT(*)::int AS count
                       FROM community_group_post_reactions r WHERE r.post_id = p.id
                       GROUP BY r.reaction_type) summary) AS "reactionCounts",
                (SELECT r.reaction_type FROM community_group_post_reactions r WHERE r.post_id = p.id AND r.user_id = $2) AS "myReaction",
                (SELECT COUNT(*)::int FROM community_group_post_comments c WHERE c.post_id = p.id) AS "commentsCount",
                (SELECT COUNT(*)::int FROM community_group_post_shares s WHERE s.post_id = p.id) AS "sharesCount"
         FROM community_group_posts p
         JOIN users u ON u.id = p.author_id
         WHERE p.group_id = $1
           AND p.review_status = 'approved'
         ORDER BY p.created_at DESC`,
        [groupId, viewerId]
      );
      return result.rows;
    },

    async findPostById({ groupId, postId }) {
      const result = await pool.query(
        `SELECT p.id::text AS id, p.group_id::text AS "groupId", p.author_id AS "authorId",
                p.content, p.image_url AS "imageUrl", p.image_moderation AS "imageModeration",
                p.review_status AS status, p.ai_label AS "aiLabel",
                p.ai_confidence AS "aiConfidence", p.ai_action AS "aiAction", p.ai_source AS "aiSource",
                p.review_note AS "reviewNote", p.edited_at AS "editedAt", p.created_at AS "createdAt"
         FROM community_group_posts p
         WHERE p.group_id = $1 AND p.id = $2`,
        [groupId, postId]
      );
      return result.rows[0] || null;
    },

    async findApprovedPost({ groupId, postId }) {
      const result = await pool.query(
        `SELECT id::text AS id, group_id::text AS "groupId"
         FROM community_group_posts
         WHERE group_id = $1 AND id = $2 AND review_status = 'approved'`,
        [groupId, postId]
      );
      return result.rows[0] || null;
    },

    async listPostComments({ groupId, postId, viewerId = null }) {
      const result = await pool.query(
        `SELECT c.id::text AS id, c.post_id::text AS "postId",
                c.parent_id::text AS "parentId",
                c.author_id AS "authorId",
                u.full_name AS "authorName", u.username, u.avatar_url AS "authorAvatar",
                u.is_verified AS "authorIsVerified",
                c.content, c.image_url AS "imageUrl", c.image_moderation AS "imageModeration",
                c.ai_label AS "aiLabel", c.ai_status AS "aiStatus",
                c.created_at AS "createdAt"
         FROM community_group_post_comments c
         JOIN users u ON u.id = c.author_id
         JOIN community_group_posts p ON p.id = c.post_id
         WHERE c.post_id = $2 AND p.group_id = $1 AND p.review_status = 'approved'
         ORDER BY c.created_at DESC, c.id DESC`,
        [groupId, postId]
      );

      const rows = result.rows || [];
      const commentIds = rows.map((r) => Number(r.id)).filter((id) => Number.isInteger(id) && id > 0);
      if (commentIds.length === 0) return rows;

      const countsByComment = new Map();
      const myReactionByComment = new Map();
      try {
        const countRes = await pool.query(
          `SELECT comment_id, reaction_type, COUNT(*)::int AS count
           FROM community_group_comment_reactions
           WHERE comment_id = ANY($1::bigint[])
           GROUP BY comment_id, reaction_type`,
          [commentIds]
        );
        for (const r of countRes.rows || []) {
          const cid = String(r.comment_id);
          if (!countsByComment.has(cid)) countsByComment.set(cid, {});
          countsByComment.get(cid)[r.reaction_type] = Number(r.count || 0);
        }
        if (viewerId) {
          const myRes = await pool.query(
            `SELECT comment_id, reaction_type
             FROM community_group_comment_reactions
             WHERE user_id = $1 AND comment_id = ANY($2::bigint[])`,
            [viewerId, commentIds]
          );
          for (const r of myRes.rows || []) {
            myReactionByComment.set(String(r.comment_id), r.reaction_type);
          }
        }
      } catch {}

      return rows.map((row) => {
        const reactionCounts = countsByComment.get(String(row.id)) || {};
        const totalReactions = Object.values(reactionCounts).reduce((sum, n) => sum + Number(n || 0), 0);
        return {
          ...row,
          reactionCounts,
          totalReactions,
          myReaction: myReactionByComment.get(String(row.id)) || null,
        };
      });
    },

    async findPostComment({ groupId, postId, commentId }) {
      const result = await pool.query(
        `SELECT c.id::text AS id, c.post_id::text AS "postId", c.parent_id::text AS "parentId",
                c.author_id AS "authorId", c.content, c.image_url AS "imageUrl"
         FROM community_group_post_comments c
         JOIN community_group_posts p ON p.id = c.post_id
         WHERE p.group_id = $1 AND c.post_id = $2 AND c.id = $3 AND p.review_status = 'approved'`,
        [groupId, postId, commentId]
      );
      return result.rows[0] || null;
    },

    async listPostReactions({ groupId, postId }) {
      const result = await pool.query(
        `SELECT r.user_id AS "userId", u.full_name AS name, u.username,
                u.avatar_url AS avatar, r.reaction_type AS "reactionType", r.created_at AS "createdAt"
         FROM community_group_post_reactions r
         JOIN community_group_posts p ON p.id = r.post_id
         JOIN users u ON u.id = r.user_id
         WHERE p.group_id = $1 AND p.id = $2 AND p.review_status = 'approved'
         ORDER BY r.created_at DESC, r.user_id`,
        [groupId, postId]
      );
      return result.rows;
    },

    async setPostReaction({ groupId, postId, userId, reactionType, action }) {
      if (action === 'remove') {
        await pool.query(
          `DELETE FROM community_group_post_reactions r
           USING community_group_posts p
           WHERE r.post_id = p.id AND p.group_id = $1 AND p.id = $2
             AND p.review_status = 'approved' AND r.user_id = $3`,
          [groupId, postId, userId]
        );
      } else {
        await pool.query(
          `INSERT INTO community_group_post_reactions (post_id, user_id, reaction_type)
           SELECT p.id, $3, $4 FROM community_group_posts p
           WHERE p.group_id = $1 AND p.id = $2 AND p.review_status = 'approved'
           ON CONFLICT (post_id, user_id) DO UPDATE
           SET reaction_type = EXCLUDED.reaction_type, created_at = CURRENT_TIMESTAMP`,
          [groupId, postId, userId, reactionType]
        );
      }
      const result = await pool.query(
        `SELECT COUNT(r.user_id)::int AS "likesCount", mine.reaction_type AS "myReaction",
                (SELECT COALESCE(jsonb_object_agg(summary.reaction_type, summary.count), '{}'::jsonb)
                 FROM (SELECT grouped.reaction_type, COUNT(*)::int AS count
                       FROM community_group_post_reactions grouped
                       WHERE grouped.post_id = p.id
                       GROUP BY grouped.reaction_type) summary) AS "reactionCounts"
         FROM community_group_posts p
         LEFT JOIN community_group_post_reactions r ON r.post_id = p.id
         LEFT JOIN community_group_post_reactions mine ON mine.post_id = p.id AND mine.user_id = $3
         WHERE p.group_id = $1 AND p.id = $2 AND p.review_status = 'approved'
         GROUP BY p.id, mine.reaction_type`,
        [groupId, postId, userId]
      );
      return result.rows[0] || null;
    },

    async createPostComment({
      groupId,
      postId,
      authorId,
      content = '',
      parentId = null,
      imageUrl = null,
      imageModeration = null,
      aiLabel = 'Normal',
      aiConfidence = null,
      aiStatus = 'approved',
    }) {
      const result = await pool.query(
        `WITH created AS (
           INSERT INTO community_group_post_comments
             (post_id, author_id, content, parent_id, image_url, image_moderation, ai_label, ai_confidence, ai_status)
           SELECT p.id, $3, $4, $5, $6, $7, $8, $9, $10 FROM community_group_posts p
           WHERE p.group_id = $1 AND p.id = $2 AND p.review_status = 'approved'
           RETURNING id, post_id, parent_id, author_id, content, image_url, image_moderation, ai_label, ai_status, created_at
         )
         SELECT created.id::text AS id, created.post_id::text AS "postId",
                created.parent_id::text AS "parentId",
                created.author_id AS "authorId", u.full_name AS "authorName",
                u.username, u.avatar_url AS "authorAvatar", u.is_verified AS "authorIsVerified",
                created.content, created.image_url AS "imageUrl",
                created.image_moderation AS "imageModeration",
                created.ai_label AS "aiLabel", created.ai_status AS "aiStatus",
                created.created_at AS "createdAt"
         FROM created JOIN users u ON u.id = created.author_id`,
        [
          groupId,
          postId,
          authorId,
          content,
          parentId,
          imageUrl,
          imageModeration ? JSON.stringify(imageModeration) : null,
          aiLabel,
          aiConfidence,
          aiStatus,
        ]
      );
      return result.rows[0] || null;
    },

    async setCommentReaction({ groupId, postId, commentId, userId, reactionType, action }) {
      const validComment = await pool.query(
        `SELECT c.id
         FROM community_group_post_comments c
         JOIN community_group_posts p ON p.id = c.post_id
         WHERE p.group_id = $1 AND p.id = $2 AND c.id = $3 AND p.review_status = 'approved'`,
        [groupId, postId, commentId]
      );
      if (!validComment.rows[0]) return null;

      if (action === 'remove') {
        await pool.query(
          `DELETE FROM community_group_comment_reactions
           WHERE comment_id = $1 AND user_id = $2`,
          [commentId, userId]
        );
      } else {
        await pool.query(
          `INSERT INTO community_group_comment_reactions (comment_id, user_id, reaction_type)
           VALUES ($1, $2, $3)
           ON CONFLICT (comment_id, user_id) DO UPDATE
           SET reaction_type = EXCLUDED.reaction_type, created_at = CURRENT_TIMESTAMP`,
          [commentId, userId, reactionType]
        );
      }

      const countRes = await pool.query(
        `SELECT reaction_type, COUNT(*)::int AS count
         FROM community_group_comment_reactions
         WHERE comment_id = $1
         GROUP BY reaction_type`,
        [commentId]
      );
      const myRes = await pool.query(
        `SELECT reaction_type
         FROM community_group_comment_reactions
         WHERE comment_id = $1 AND user_id = $2`,
        [commentId, userId]
      );
      const reactionCounts = {};
      let totalReactions = 0;
      for (const row of countRes.rows || []) {
        const cnt = Number(row.count || 0);
        reactionCounts[row.reaction_type] = cnt;
        totalReactions += cnt;
      }
      return {
        commentId: String(commentId),
        myReaction: myRes.rows[0]?.reaction_type || null,
        reactionCounts,
        totalReactions,
      };
    },

    async recordPostShare({ groupId, postId, userId }) {
      await pool.query(
        `INSERT INTO community_group_post_shares (post_id, user_id)
         SELECT p.id, $3 FROM community_group_posts p
         WHERE p.group_id = $1 AND p.id = $2 AND p.review_status = 'approved'`,
        [groupId, postId, userId]
      );
      const result = await pool.query(
        `SELECT COUNT(s.id)::int AS "sharesCount"
         FROM community_group_post_shares s
         JOIN community_group_posts p ON p.id = s.post_id
         WHERE p.group_id = $1 AND p.id = $2 AND p.review_status = 'approved'`,
        [groupId, postId]
      );
      return result.rows[0] || null;
    },

    async listReviewQueue(groupId) {
      const result = await pool.query(
        `SELECT p.id::text AS id, p.group_id::text AS "groupId", p.author_id AS "authorId",
                u.full_name AS "authorName", u.username, u.avatar_url AS "authorAvatar",
                p.content, p.image_url AS "imageUrl", p.image_moderation AS "imageModeration",
                p.ai_label AS "aiLabel", p.ai_confidence AS "aiConfidence",
                p.ai_action AS "aiAction", p.ai_source AS "aiSource", p.created_at AS "createdAt"
         FROM community_group_posts p
         JOIN users u ON u.id = p.author_id
         WHERE p.group_id = $1 AND p.review_status = 'pending'
         ORDER BY p.created_at ASC`,
        [groupId]
      );
      return result.rows;
    },

    async createPost({ groupId, authorId, content, imageUrl, imageModeration, aiLabel, aiConfidence, aiAction, aiSource, reviewStatus, reviewNote, authorTrustPenalty }) {
      const post = await inTransaction(pool, async (db) => {
        const result = await db.query(
          `INSERT INTO community_group_posts
             (group_id, author_id, content, image_url, image_moderation, ai_label, ai_confidence, ai_action, ai_source,
              review_status, reviewed_at, review_note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::varchar,
                   CASE WHEN $10::varchar IN ('approved', 'rejected') THEN CURRENT_TIMESTAMP ELSE NULL END, $11)
           RETURNING id::text AS id, group_id::text AS "groupId", author_id AS "authorId",
                     content, image_url AS "imageUrl", image_moderation AS "imageModeration",
                     review_status AS status, ai_label AS "aiLabel",
                     ai_confidence AS "aiConfidence", ai_action AS "aiAction", ai_source AS "aiSource",
                     review_note AS "reviewNote", reviewed_by AS "reviewedBy", created_at AS "createdAt"`,
          [groupId, authorId, content, imageUrl, imageModeration ? JSON.stringify(imageModeration) : null,
            aiLabel, aiConfidence, aiAction, aiSource, reviewStatus, reviewNote]
        );
        const post = result.rows[0];
        if (post && authorTrustPenalty > 0) {
          await applyTrustPenalty({
            pool: db,
            userId: authorId,
            amount: authorTrustPenalty,
            reason: `Bài viết nhóm #${groupId}, bài #${post.id} bị AI xác định vi phạm: ${aiLabel}`,
            actionType: 'group_post_violation',
            contentId: null,
            notify: false,
            rethrow: true,
          });
        }
        return post;
      });
      if (post && authorTrustPenalty > 0) {
        await notifyGroupPostPenalty(pool, { userId: authorId, amount: authorTrustPenalty, groupId, postId: post.id, label: aiLabel });
      }
      return post;
    },

    async findPostForReview({ groupId, postId }) {
      const result = await pool.query(
        `SELECT id::text AS id, author_id AS "authorId", ai_label AS "aiLabel",
                image_moderation AS "imageModeration",
                review_status AS status
         FROM community_group_posts
         WHERE group_id = $1 AND id = $2 AND review_status = 'pending'`,
        [groupId, postId]
      );
      return result.rows[0] || null;
    },

    async reviewPost({ groupId, postId, reviewerId, decision, reason, authorTrustPenalty, moderatorTrustPenalty }) {
      const reviewed = await inTransaction(pool, async (db) => {
        const result = await db.query(
          `UPDATE community_group_posts p
           SET review_status = $4, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP,
               review_note = $5, updated_at = CURRENT_TIMESTAMP
           WHERE p.group_id = $1 AND p.id = $2 AND p.review_status = 'pending'
             AND EXISTS (
               SELECT 1 FROM community_group_members gm
               WHERE gm.group_id = $1 AND gm.user_id = $3 AND gm.status = 'active'
                 AND gm.role IN ('owner', 'admin', 'moderator')
             )
           RETURNING p.id::text AS id, p.group_id::text AS "groupId", p.author_id AS "authorId",
                     p.content, p.review_status AS status, p.ai_label AS "aiLabel",
                     p.ai_confidence AS "aiConfidence", p.ai_action AS "aiAction",
                     p.review_note AS "reviewNote", p.reviewed_at AS "reviewedAt"`,
          [groupId, postId, reviewerId, decision, reason]
        );
        const post = result.rows[0];
        if (!post) return null;
        if (authorTrustPenalty > 0) {
          await applyTrustPenalty({
            pool: db,
            userId: post.authorId,
            amount: authorTrustPenalty,
            reason: `Bài viết nhóm #${groupId}, bài #${post.id} bị xác nhận vi phạm: ${post.aiLabel}`,
            actionType: 'group_post_violation',
            contentId: null,
            notify: false,
            rethrow: true,
          });
        }
        let moderatorTrustScoreAfter = null;
        let moderatorTrustScoreChange = 0;
        if (moderatorTrustPenalty > 0 && String(post.authorId) !== String(reviewerId)) {
          const current = await db.query(
            `SELECT moderation_score AS score
             FROM community_group_members
             WHERE group_id = $1 AND user_id = $2 AND status = 'active'
               AND role IN ('owner', 'admin', 'moderator')
             FOR UPDATE`,
            [groupId, reviewerId]
          );
          if (current.rows[0]) {
            const previousScore = Number(current.rows[0].score);
            const updated = await db.query(
              `UPDATE community_group_members
               SET moderation_score = GREATEST(0, moderation_score - $3)
               WHERE group_id = $1 AND user_id = $2
               RETURNING moderation_score AS score`,
              [groupId, reviewerId, moderatorTrustPenalty]
            );
            moderatorTrustScoreAfter = Number(updated.rows[0]?.score ?? previousScore);
            moderatorTrustScoreChange = moderatorTrustScoreAfter - previousScore;
          }
        }
        await db.query(
          `INSERT INTO community_group_moderation_logs
             (group_id, actor_id, target_type, target_post_id, action, reason, ai_label, ai_confidence,
              author_trust_score_change, moderator_trust_score_change, moderator_trust_score_after)
           SELECT $1, $2, 'post', p.id, $3, $4, p.ai_label, p.ai_confidence, $6, $7, $8
           FROM community_group_posts p WHERE p.id = $5 AND p.group_id = $1`,
          [groupId, reviewerId, decision, reason, postId, -(authorTrustPenalty || 0), moderatorTrustScoreChange, moderatorTrustScoreAfter]
        );
        return {
          ...post,
          authorTrustPenalty: authorTrustPenalty || 0,
          moderatorTrustPenalty: Math.abs(moderatorTrustScoreChange),
          moderatorTrustScoreAfter,
        };
      });
      if (reviewed && authorTrustPenalty > 0) {
        await notifyGroupPostPenalty(pool, {
          userId: reviewed.authorId,
          amount: authorTrustPenalty,
          groupId,
          postId: reviewed.id,
          label: reviewed.aiLabel,
        });
      }
      return reviewed;
    },

    async reviewMemberRequest({ groupId, userId, reviewerId, decision }) {
      return inTransaction(pool, async (db) => {
        const result = await db.query(
          `UPDATE community_group_members target
           SET status = $4, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
           WHERE target.group_id = $1 AND target.user_id = $2 AND target.status = 'pending'
             AND EXISTS (
               SELECT 1 FROM community_group_members actor
               WHERE actor.group_id = $1 AND actor.user_id = $3 AND actor.status = 'active'
                 AND actor.role IN ('owner', 'admin')
             )
           RETURNING target.user_id AS "userId", target.status, target.role`,
          [groupId, userId, reviewerId, decision]
        );
        const membership = result.rows[0];
        if (!membership) return null;
        await db.query(
          `INSERT INTO community_group_moderation_logs
             (group_id, actor_id, target_type, target_user_id, action)
           VALUES ($1, $2, 'member', $3, $4)`,
          [groupId, reviewerId, userId, decision]
        );
        return membership;
      });
    },

    async updatePost({
      groupId,
      postId,
      content,
      imageUrl,
      imageModeration,
      aiLabel,
      aiConfidence,
      aiAction,
      aiSource,
      reviewStatus,
      reviewNote,
      authorTrustPenalty = 0,
    }) {
      const post = await inTransaction(pool, async (db) => {
        const result = await db.query(
          `WITH updated AS (
             UPDATE community_group_posts
             SET content = $3,
                 image_url = $4,
                 image_moderation = $5,
                 ai_label = $6,
                 ai_confidence = $7,
                 ai_action = $8,
                 ai_source = $9,
                 review_status = $10::varchar,
                 reviewed_at = CASE WHEN $10::varchar IN ('approved', 'rejected') THEN CURRENT_TIMESTAMP ELSE NULL END,
                 review_note = $11,
                 edited_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE group_id = $1 AND id = $2
             RETURNING *
           )
           SELECT updated.id::text AS id, updated.group_id::text AS "groupId", updated.author_id AS "authorId",
                  u.full_name AS "authorName", u.username, u.avatar_url AS "authorAvatar", u.is_verified AS "authorIsVerified",
                  updated.content, updated.image_url AS "imageUrl", updated.image_moderation AS "imageModeration",
                  updated.review_status AS status, updated.ai_label AS "aiLabel",
                  updated.ai_confidence AS "aiConfidence", updated.ai_action AS "aiAction", updated.ai_source AS "aiSource",
                  updated.review_note AS "reviewNote", updated.reviewed_by AS "reviewedBy",
                  updated.reviewed_at AS "reviewedAt", updated.edited_at AS "editedAt", updated.created_at AS "createdAt"
           FROM updated JOIN users u ON u.id = updated.author_id`,
          [
            groupId,
            postId,
            content,
            imageUrl,
            imageModeration ? JSON.stringify(imageModeration) : null,
            aiLabel,
            aiConfidence,
            aiAction,
            aiSource,
            reviewStatus,
            reviewNote,
          ]
        );
        const updatedPost = result.rows[0];
        if (updatedPost && authorTrustPenalty > 0) {
          await applyTrustPenalty({
            pool: db,
            userId: updatedPost.authorId,
            amount: authorTrustPenalty,
            reason: `Bài viết nhóm #${groupId}, bài #${updatedPost.id} sau chỉnh sửa bị AI xác định vi phạm: ${aiLabel}`,
            actionType: 'group_post_violation',
            contentId: null,
            notify: false,
            rethrow: true,
          });
        }
        return updatedPost || null;
      });
      if (post && authorTrustPenalty > 0) {
        await notifyGroupPostPenalty(pool, { userId: post.authorId, amount: authorTrustPenalty, groupId, postId: post.id, label: aiLabel });
      }
      return post;
    },

    async deletePost({ groupId, postId, actorId, logModeration = false, reason = '' }) {
      return inTransaction(pool, async (db) => {
        if (logModeration) {
          await db.query(
            `INSERT INTO community_group_moderation_logs (group_id, actor_id, target_type, target_post_id, action, reason, ai_label, ai_confidence)
             SELECT $1, $2, 'post', p.id, 'deleted', $4, p.ai_label, p.ai_confidence
             FROM community_group_posts p WHERE p.group_id = $1 AND p.id = $3`,
            [groupId, actorId, postId, reason]
          );
        }
        const result = await db.query(
          `DELETE FROM community_group_posts
           WHERE group_id = $1 AND id = $2
           RETURNING id::text AS id, group_id::text AS "groupId", author_id AS "authorId"`,
          [groupId, postId]
        );
        return result.rows[0] || null;
      });
    },

    async createReport({ groupId, reporterId, targetType, targetId, parentPostId = null, reason, details = '' }) {
      const result = await pool.query(
        `INSERT INTO community_group_reports (group_id, reporter_id, target_type, target_id, parent_post_id, reason, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id::text AS id, group_id::text AS "groupId", reporter_id AS "reporterId",
                   target_type AS "targetType", target_id::text AS "targetId",
                   parent_post_id::text AS "parentPostId", reason, details, status, created_at AS "createdAt"`,
        [groupId, reporterId, targetType, targetId, parentPostId, reason, details]
      );
      return result.rows[0] || null;
    },

    async listReports(groupId) {
      const result = await pool.query(
        `SELECT r.id::text AS id, r.group_id::text AS "groupId", r.reporter_id AS "reporterId",
                rep.full_name AS "reporterName", rep.username AS "reporterUsername",
                r.target_type AS "targetType", r.target_id::text AS "targetId",
                r.parent_post_id::text AS "parentPostId", r.reason, r.details, r.status,
                r.admin_notes AS "adminNotes", r.created_at AS "createdAt",
                COALESCE(p.content, c.content, '') AS "targetContent",
                COALESCE(p.image_url, c.image_url) AS "targetImageUrl",
                COALESCE(p.author_id, c.author_id) AS "targetAuthorId",
                COALESCE(pu.full_name, cu.full_name) AS "targetAuthorName",
                COALESCE(p.ai_label, c.ai_label, 'Normal') AS "aiLabel"
         FROM community_group_reports r
         JOIN users rep ON rep.id = r.reporter_id
         LEFT JOIN community_group_posts p ON r.target_type = 'post' AND p.id = r.target_id
         LEFT JOIN users pu ON pu.id = p.author_id
         LEFT JOIN community_group_post_comments c ON r.target_type = 'comment' AND c.id = r.target_id
         LEFT JOIN users cu ON cu.id = c.author_id
         WHERE r.group_id = $1
         ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC`,
        [groupId]
      );
      return result.rows;
    },

    async findReportById({ groupId, reportId }) {
      const result = await pool.query(
        `SELECT r.id::text AS id, r.group_id::text AS "groupId", r.target_type AS "targetType",
                r.target_id::text AS "targetId", r.parent_post_id::text AS "parentPostId",
                r.reason, r.status,
                COALESCE(p.author_id, c.author_id) AS "targetAuthorId",
                COALESCE(p.ai_label, c.ai_label, 'Toxic') AS "aiLabel",
                p.image_moderation AS "postImageModeration",
                c.image_moderation AS "commentImageModeration"
         FROM community_group_reports r
         LEFT JOIN community_group_posts p ON r.target_type = 'post' AND p.id = r.target_id
         LEFT JOIN community_group_post_comments c ON r.target_type = 'comment' AND c.id = r.target_id
         WHERE r.group_id = $1 AND r.id = $2`,
        [groupId, reportId]
      );
      return result.rows[0] || null;
    },

    async reviewReport({ groupId, reportId, reviewerId, status, adminNotes = '', authorTrustPenalty = 0 }) {
      const reviewed = await inTransaction(pool, async (db) => {
        const res = await db.query(
          `UPDATE community_group_reports
           SET status = $3, admin_notes = $4, reviewed_by = $5, reviewed_at = CURRENT_TIMESTAMP
           WHERE group_id = $1 AND id = $2 AND status = 'pending'
           RETURNING id::text AS id, group_id::text AS "groupId", target_type AS "targetType",
                     target_id::text AS "targetId", parent_post_id::text AS "parentPostId",
                     status, admin_notes AS "adminNotes", reviewed_at AS "reviewedAt"`,
          [groupId, reportId, status, adminNotes, reviewerId]
        );
        const report = res.rows[0];
        if (!report) return null;

        let targetAuthorId = null;
        if (status === 'resolved_violation') {
          if (report.targetType === 'post') {
            const pRes = await db.query(
              `UPDATE community_group_posts
               SET review_status = 'rejected', review_note = $3, reviewed_by = $4, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
               WHERE group_id = $1 AND id = $2
               RETURNING author_id AS "authorId"`,
              [groupId, report.targetId, adminNotes || 'Bài viết đã bị gỡ do vi phạm quy định nhóm.', reviewerId]
            );
            targetAuthorId = pRes.rows[0]?.authorId || null;
          } else if (report.targetType === 'comment') {
            const cRes = await db.query(
              `DELETE FROM community_group_post_comments c
               USING community_group_posts p
               WHERE c.id = $1 AND c.post_id = p.id AND p.group_id = $2
               RETURNING c.author_id AS "authorId"`,
              [report.targetId, groupId]
            );
            targetAuthorId = cRes.rows[0]?.authorId || null;
          }
          if (targetAuthorId && authorTrustPenalty > 0) {
            await applyTrustPenalty({
              pool: db,
              userId: targetAuthorId,
              amount: authorTrustPenalty,
              reason: `Báo cáo vi phạm trong nhóm #${groupId} đã được xác nhận`,
              actionType: 'group_report_violation',
              contentId: null,
              notify: false,
              rethrow: true,
            });
          }
        }

        await db.query(
          `INSERT INTO community_group_moderation_logs
             (group_id, actor_id, target_type, target_post_id, target_user_id, action, reason, author_trust_score_change)
           VALUES ($1, $2, 'report', $3, $4, $5, $6, $7)`,
          [
            groupId,
            reviewerId,
            report.targetType === 'post' ? report.targetId : report.parentPostId,
            targetAuthorId,
            status,
            adminNotes,
            status === 'resolved_violation' ? -(authorTrustPenalty || 0) : 0,
          ]
        );
        return {
          ...report,
          targetAuthorId,
          authorTrustPenalty: status === 'resolved_violation' ? authorTrustPenalty : 0,
        };
      });
      if (reviewed?.targetAuthorId && reviewed.authorTrustPenalty > 0) {
        await notifyGroupPostPenalty(pool, {
          userId: reviewed.targetAuthorId,
          amount: reviewed.authorTrustPenalty,
          groupId,
          postId: reviewed.targetType === 'post' ? reviewed.targetId : reviewed.parentPostId,
          label: 'Vi phạm báo cáo nhóm',
        });
      }
      return reviewed;
    },

    async createAppeal({ groupId, postId, userId, appealReason }) {
      const result = await pool.query(
        `INSERT INTO community_group_appeals (group_id, post_id, user_id, appeal_reason)
         VALUES ($1, $2, $3, $4)
         RETURNING id::text AS id, group_id::text AS "groupId", post_id::text AS "postId",
                   user_id AS "userId", appeal_reason AS "appealReason", status, created_at AS "createdAt"`,
        [groupId, postId, userId, appealReason]
      );
      return result.rows[0] || null;
    },

    async listAppeals(groupId) {
      const result = await pool.query(
        `SELECT a.id::text AS id, a.group_id::text AS "groupId", a.post_id::text AS "postId",
                a.user_id AS "userId", u.full_name AS "userName", u.username,
                a.appeal_reason AS "appealReason", a.status, a.admin_notes AS "adminNotes",
                a.created_at AS "createdAt",
                p.content AS "postContent", p.image_url AS "postImageUrl",
                p.ai_label AS "aiLabel", p.ai_confidence AS "aiConfidence"
         FROM community_group_appeals a
         JOIN users u ON u.id = a.user_id
         JOIN community_group_posts p ON p.id = a.post_id
         WHERE a.group_id = $1
         ORDER BY CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END, a.created_at DESC`,
        [groupId]
      );
      return result.rows;
    },

    async reviewAppeal({ groupId, appealId, reviewerId, decision, adminNotes = '' }) {
      return inTransaction(pool, async (db) => {
        const res = await db.query(
          `UPDATE community_group_appeals
           SET status = $3, admin_notes = $4, reviewed_by = $5, reviewed_at = CURRENT_TIMESTAMP
           WHERE group_id = $1 AND id = $2 AND status = 'pending'
           RETURNING id::text AS id, group_id::text AS "groupId", post_id::text AS "postId",
                     user_id AS "userId", status, admin_notes AS "adminNotes", reviewed_at AS "reviewedAt"`,
          [groupId, appealId, decision, adminNotes, reviewerId]
        );
        const appeal = res.rows[0];
        if (!appeal) return null;

        if (decision === 'approved') {
          await db.query(
            `UPDATE community_group_posts
             SET review_status = 'approved', review_note = $3, reviewed_by = $4, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE group_id = $1 AND id = $2`,
            [groupId, appeal.postId, adminNotes || 'Đã chấp nhận khiếu nại và khôi phục bài viết.', reviewerId]
          );
        }

        await db.query(
          `INSERT INTO community_group_moderation_logs
             (group_id, actor_id, target_type, target_post_id, target_user_id, action, reason)
           VALUES ($1, $2, 'appeal', $3, $4, $5, $6)`,
          [groupId, reviewerId, appeal.postId, appeal.userId, decision, adminNotes]
        );
        return appeal;
      });
    },

    async listActiveMemberIds(groupId) {
      const result = await pool.query(
        `SELECT user_id AS id FROM community_group_members WHERE group_id = $1 AND status = 'active'`,
        [groupId]
      );
      return result.rows.map((row) => row.id);
    },

    async removeMember({ groupId, targetUserId, actorId }) {
      const result = await pool.query(
        `UPDATE community_group_members target
         SET status = 'left', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $3
         WHERE target.group_id = $1
           AND target.user_id = $2
           AND target.status = 'active'
           AND target.role <> 'owner'
           AND EXISTS (
             SELECT 1 FROM community_group_members actor
             WHERE actor.group_id = $1 AND actor.user_id = $3
               AND actor.status = 'active'
               AND (actor.role = 'owner' OR (actor.role = 'admin' AND target.role IN ('member', 'moderator')))
           )
         RETURNING target.user_id AS id, target.status`,
        [groupId, targetUserId, actorId]
      );
      return result.rows[0] || null;
    },

    async updateGroupPrivacy({ groupId, privacy, actorId }) {
      const result = await pool.query(
        `UPDATE community_groups g
         SET privacy = $2, updated_at = CURRENT_TIMESTAMP
         WHERE g.id = $1
           AND EXISTS (
             SELECT 1 FROM community_group_members actor
             WHERE actor.group_id = $1 AND actor.user_id = $3
               AND actor.status = 'active'
               AND actor.role IN ('owner', 'admin')
           )
         RETURNING g.id::text AS id, g.name, g.privacy`,
        [groupId, privacy, actorId]
      );
      return result.rows[0] || null;
    },
  };
}

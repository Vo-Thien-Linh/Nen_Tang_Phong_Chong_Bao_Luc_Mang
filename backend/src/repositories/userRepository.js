export function createUserRepository({ pool }) {
  return {
    async findById(userId) {
      const result = await pool.query(
        `SELECT id, username, full_name, avatar_url, cover_url, role, is_verified,
                bio, location, hometown, education, high_school, relationship_status,
                phone, status, cooldown_until, created_at
         FROM users
         WHERE id = $1`,
        [userId]
      );

      return result.rows[0] || null;
    },

    async ensureUserExists({ id, username, fullName, avatarUrl }) {
      const existing = await this.findById(id);
      if (existing) return existing;

      const cleanUsername = (username || `user_${id.replace(/-/g, '').slice(0, 8)}`).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const cleanFullName = fullName || 'Người dùng';

      const result = await pool.query(
        `INSERT INTO users (id, username, full_name, avatar_url, role, status)
         VALUES ($1, $2, $3, $4, 'USER', 'active')
         ON CONFLICT (id) DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, users.full_name)
         RETURNING id, username, full_name, avatar_url, cover_url, role, is_verified,
                   bio, location, hometown, education, high_school, relationship_status,
                   phone, status, cooldown_until, created_at`,
        [id, cleanUsername, cleanFullName, avatarUrl || null]
      );

      return result.rows[0] || null;
    },

    async findProfileById(userId) {
      // Thông tin profile đầy đủ kèm số lượng bài viết và bạn bè
      const result = await pool.query(
        `SELECT
           u.id, u.username, u.full_name, u.avatar_url, u.cover_url,
           u.role, u.is_verified, u.bio, u.location, u.hometown,
           u.education, u.high_school, u.relationship_status,
           u.phone, u.status, u.created_at,
           (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND ai_status != 'hidden')::int AS posts_count,
           (SELECT COUNT(*) FROM friendships
            WHERE (requester_id = u.id OR addressee_id = u.id)
              AND status = 'accepted')::int AS friends_count
         FROM users u
         WHERE u.id = $1`,
        [userId]
      );

      return result.rows[0] || null;
    },

    async updateProfile(userId, fields) {
      // Chỉ cho phép cập nhật các trường an toàn
      const allowed = ['bio', 'location', 'hometown', 'education', 'high_school', 'relationship_status', 'avatar_url', 'cover_url'];
      const updates = [];
      const values = [];
      let paramCount = 1;

      for (const key of allowed) {
        if (fields[key] !== undefined) {
          updates.push(`${key} = $${paramCount}`);
          values.push(fields[key]);
          paramCount++;
        }
      }

      if (updates.length === 0) return null;

      values.push(userId);
      const result = await pool.query(
        `UPDATE users
         SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramCount}
         RETURNING id, username, full_name, avatar_url, cover_url, bio,
                   location, hometown, education, high_school, relationship_status, is_verified`,
        values
      );

      return result.rows[0] || null;
    },

    async findFriends(userId, limit = 6) {
      // Lấy danh sách bạn bè đã chấp nhận
      const result = await pool.query(
        `SELECT u.id, u.username, u.full_name, u.avatar_url, u.is_verified, u.bio, u.location
         FROM friendships f
         JOIN users u ON u.id = CASE
           WHEN f.requester_id = $1 THEN f.addressee_id
           ELSE f.requester_id
         END
         WHERE (f.requester_id = $1 OR f.addressee_id = $1)
           AND f.status = 'accepted'
         ORDER BY f.updated_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    },

    async findUserPosts(userId, viewerId) {
      // Lấy bài viết của một user cụ thể (kèm thông tin bài gốc nếu là bài chia sẻ)
      const result = await pool.query(
        `SELECT
           p.id, p.author_id, p.content, p.image_url, p.privacy,
           p.ai_label, p.ai_confidence, p.ai_status,
           p.likes_count, p.comments_count, p.shares_count,
           p.created_at, p.original_post_id,
           u.username, u.full_name, u.avatar_url, u.is_verified,
           orig_p.id AS orig_id,
           orig_p.content AS orig_content,
           orig_p.image_url AS orig_image_url,
           orig_p.created_at AS orig_created_at,
           orig_p.likes_count AS orig_likes_count,
           orig_p.comments_count AS orig_comments_count,
           orig_p.shares_count AS orig_shares_count,
           orig_u.id AS orig_author_id,
           orig_u.full_name AS orig_author_name,
           orig_u.username AS orig_author_username,
           orig_u.avatar_url AS orig_author_avatar,
           orig_u.is_verified AS orig_author_is_verified
         FROM posts p
         JOIN users u ON u.id = p.author_id
         LEFT JOIN posts orig_p ON orig_p.id = p.original_post_id
         LEFT JOIN users orig_u ON orig_u.id = orig_p.author_id
         WHERE p.author_id = $1
           AND (p.ai_status != 'hidden' OR p.author_id = $2)
         ORDER BY p.created_at DESC`,
        [userId, viewerId || userId]
      );

      if (result.rows.length === 0) return [];

      const postIds = result.rows.map(p => p.id);

      // Lấy reactions
      const reactionResult = await pool.query(
        `SELECT post_id, reaction_type, COUNT(*)::int AS count
         FROM post_reactions
         WHERE post_id = ANY($1::bigint[])
         GROUP BY post_id, reaction_type`,
        [postIds]
      );

      // Lấy my reactions nếu có viewerId
      const myReactionResult = viewerId
        ? await pool.query(
            `SELECT post_id, reaction_type
             FROM post_reactions
             WHERE user_id = $1 AND post_id = ANY($2::bigint[])`,
            [viewerId, postIds]
          )
        : { rows: [] };

      // Lấy comments
      const commentsResult = await pool.query(
        `SELECT c.id, c.post_id, c.content, c.created_at,
                u.id AS author_id, u.full_name, u.username, u.avatar_url
         FROM comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.post_id = ANY($1::bigint[]) AND c.is_hidden = false
         ORDER BY c.created_at ASC`,
        [postIds]
      );

      // Nhóm reactions và comments theo post
      const reactionsByPost = new Map();
      const myReactionByPost = new Map();
      const commentsByPost = new Map();

      for (const row of result.rows) {
        reactionsByPost.set(Number(row.id), { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 });
        commentsByPost.set(Number(row.id), []);
      }

      for (const row of reactionResult.rows) {
        const pid = Number(row.post_id);
        const counts = reactionsByPost.get(pid);
        if (counts && row.reaction_type in counts) {
          counts[row.reaction_type] = row.count;
        }
      }

      for (const row of myReactionResult.rows) {
        myReactionByPost.set(Number(row.post_id), row.reaction_type);
      }

      for (const c of commentsResult.rows) {
        const pid = Number(c.post_id);
        if (commentsByPost.has(pid)) {
          commentsByPost.get(pid).push({
            id: String(c.id),
            author: {
              id: c.author_id,
              name: c.full_name,
              username: c.username,
              avatar: c.avatar_url,
            },
            content: c.content,
            created_at: c.created_at,
          });
        }
      }

      return result.rows.map(post => {
        const pid = Number(post.id);
        const counts = reactionsByPost.get(pid) || {};
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return {
          ...post,
          reaction_counts: counts,
          total_reactions: total,
          my_reaction: myReactionByPost.get(pid) || null,
          comments: commentsByPost.get(pid) || [],
        };
      });
    },
  };
}

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

    async findProfileById(userId, viewerId = null) {
      // Thông tin profile đầy đủ kèm số lượng bài viết và bạn bè
      const result = await pool.query(
        `SELECT
           u.id, u.username, u.full_name, u.avatar_url, u.cover_url,
           u.role, u.is_verified, u.bio, u.location, u.hometown,
           u.education, u.high_school, u.relationship_status,
           u.phone, u.status, u.created_at,
           (SELECT COUNT(*) FROM posts p
            WHERE p.author_id = u.id
              AND (
                p.author_id = $2
                OR (p.ai_status = 'approved'
                    AND (p.image_moderation_status IS NULL OR p.image_moderation_status IN ('safe', 'sensitive')))
              )
              AND (p.image_moderation_status IS NULL
                   OR p.image_moderation_status <> 'rejected_hold'
                   OR p.moderation_expires_at > CURRENT_TIMESTAMP))::int AS posts_count,
           (SELECT COUNT(*) FROM friendships
            WHERE (requester_id = u.id OR addressee_id = u.id)
              AND status = 'accepted')::int AS friends_count
         FROM users u
         WHERE u.id = $1`,
        [userId, viewerId]
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
           p.image_moderation_status, p.image_moderation_safe, p.image_moderation_nsfw,
           p.image_moderation_violence, p.image_moderation_thresholds, p.moderation_expires_at,
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
           AND (
             p.author_id = $2
             OR (p.ai_status = 'approved'
                 AND (p.image_moderation_status IS NULL OR p.image_moderation_status IN ('safe', 'sensitive')))
           )
           AND (p.image_moderation_status IS NULL
                OR p.image_moderation_status <> 'rejected_hold'
                OR p.moderation_expires_at > CURRENT_TIMESTAMP)
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
        `SELECT c.id, c.post_id, c.content, c.image_url, c.image_moderation_status,
                c.image_moderation_safe, c.image_moderation_nsfw, c.image_moderation_violence,
                c.image_moderation_thresholds, c.moderation_expires_at, c.created_at,
                u.id AS author_id, u.full_name, u.username, u.avatar_url
         FROM comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.post_id = ANY($1::bigint[]) AND c.is_hidden = false
           AND (
             c.author_id = $2
             OR c.image_moderation_status IS NULL
             OR c.image_moderation_status IN ('safe', 'sensitive')
           )
           AND (c.image_moderation_status IS NULL
                OR c.image_moderation_status <> 'rejected_hold'
                OR c.moderation_expires_at > CURRENT_TIMESTAMP)
         ORDER BY c.created_at ASC`,
        [postIds, viewerId || userId]
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
            image: c.image_url || null,
            imageModeration: c.image_moderation_status ? {
              status: c.image_moderation_status,
              scores: { safe: c.image_moderation_safe, nsfw: c.image_moderation_nsfw, violence: c.image_moderation_violence },
              thresholds: c.image_moderation_thresholds || null,
              moderationExpiresAt: c.moderation_expires_at || null,
            } : null,
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
          imageModeration: post.image_moderation_status ? {
            status: post.image_moderation_status,
            scores: { safe: post.image_moderation_safe, nsfw: post.image_moderation_nsfw, violence: post.image_moderation_violence },
            thresholds: post.image_moderation_thresholds || null,
            moderationExpiresAt: post.moderation_expires_at || null,
          } : null,
        };
      });
    },

    async findAllUsers({ search = '', role = 'all', page = 1, limit = 10 } = {}) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (search && search.trim()) {
        const queryTerm = `%${search.trim().toLowerCase()}%`;
        conditions.push(`(LOWER(username) LIKE $${paramIndex} OR LOWER(full_name) LIKE $${paramIndex} OR LOWER(COALESCE(email, '')) LIKE $${paramIndex} OR LOWER(COALESCE(phone, '')) LIKE $${paramIndex})`);
        values.push(queryTerm);
        paramIndex++;
      }

      if (role && role !== 'all') {
        conditions.push(`LOWER(role) = $${paramIndex}`);
        values.push(role.trim().toLowerCase());
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM users ${whereClause}`,
        values
      );
      const total = countResult.rows[0]?.total || 0;

      const queryValues = [...values, limitNum, offset];
      const usersResult = await pool.query(
        `SELECT id, username, email, full_name, avatar_url, cover_url, role, status, is_verified, phone, created_at
         FROM users
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        queryValues
      );

      return {
        users: usersResult.rows,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      };
    },

    async countAdmins() {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM users WHERE LOWER(role) = 'admin' AND status = 'active'`
      );
      return result.rows[0]?.count || 0;
    },

    async updateUserRole({ targetUserId, newRole, actorId }) {
      const user = await this.findById(targetUserId);
      if (!user) {
        const error = new Error('Không tìm thấy người dùng');
        error.statusCode = 404;
        throw error;
      }

      const oldRole = (user.role || 'user').toLowerCase();
      const normalizedNewRole = newRole.toLowerCase();

      // Chặn admin tự hạ quyền mình
      if (targetUserId === actorId && normalizedNewRole !== 'admin') {
        const error = new Error('Bạn không thể tự hạ vai trò quản trị viên của chính mình.');
        error.statusCode = 400;
        throw error;
      }

      // Chặn hạ quyền admin cuối cùng
      if (oldRole === 'admin' && normalizedNewRole !== 'admin') {
        const adminCount = await this.countAdmins();
        if (adminCount <= 1) {
          const error = new Error('Không thể hạ vai trò vì đây là tài khoản quản trị viên duy nhất còn lại.');
          error.statusCode = 400;
          throw error;
        }
      }

      const updateResult = await pool.query(
        `UPDATE users
         SET role = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, username, email, full_name, avatar_url, role, status, is_verified`,
        [normalizedNewRole, targetUserId]
      );

      // Ghi audit log
      await pool.query(
        `INSERT INTO role_audit_logs (actor_id, target_user_id, old_role, new_role)
         VALUES ($1, $2, $3, $4)`,
        [actorId, targetUserId, oldRole, normalizedNewRole]
      );

      return updateResult.rows[0];
    },

    async updateVerification({ targetUserId, isVerified }) {
      const user = await this.findById(targetUserId);
      if (!user) {
        const error = new Error('Không tìm thấy người dùng');
        error.statusCode = 404;
        throw error;
      }

      const updateResult = await pool.query(
        `UPDATE users
         SET is_verified = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, username, email, full_name, avatar_url, role, status, is_verified`,
        [Boolean(isVerified), targetUserId]
      );

      return updateResult.rows[0];
    },
  };
}

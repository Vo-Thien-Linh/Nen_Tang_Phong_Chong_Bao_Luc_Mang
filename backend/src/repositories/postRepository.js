const postSelect = `
  SELECT
    p.id,
    p.author_id,
    p.title,
    p.content,
    p.image_url,
    p.privacy,
    p.ai_label,
    p.ai_confidence,
    p.ai_status,
    p.likes_count,
    p.comments_count,
    p.shares_count,
    p.created_at,
    p.updated_at,
    u.username,
    u.full_name,
    u.avatar_url,
    u.is_verified
  FROM posts p
  JOIN users u ON u.id = p.author_id
`;

export function createPostRepository({ pool }) {
  return {
    async createPost({ authorId, title, content, imageUrl, privacy = 'public' }) {
      const result = await pool.query(
        `INSERT INTO posts (author_id, title, content, image_url, privacy)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [authorId, title, content, imageUrl, privacy]
      );

      return this.findById(result.rows[0].id);
    },

    async findById(postId) {
      const result = await pool.query(
        `${postSelect}
         WHERE p.id = $1`,
        [postId]
      );

      return result.rows[0] || null;
    },

    async findVisiblePosts({ viewerId }) {
      const params = [];
      let visibilityWhere = `p.ai_status = 'approved'`;

      if (viewerId) {
        params.push(viewerId);
        visibilityWhere = `(p.ai_status = 'approved' OR p.author_id = $1)`;
      }

      const result = await pool.query(
        `${postSelect}
         WHERE ${visibilityWhere}
         ORDER BY p.created_at DESC`,
        params
      );

      return result.rows;
    },
  };
}

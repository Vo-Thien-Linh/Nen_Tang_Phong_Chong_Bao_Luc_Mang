const postSelect = `
  SELECT
    p.id,
    p.author_id,
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
        },
        content: c.content,
        created_at: c.created_at,
      });
    }
  }

  return posts.map((post) => {
    const pid = Number(post.id);
    const reactionData = reactionDataByPost.get(pid);
    return {
      ...post,
      reaction_counts: reactionData?.counts || emptyReactionCounts(),
      total_reactions: reactionData?.total || 0,
      my_reaction: reactionData?.myReaction || null,
      comments: commentsByPost.get(pid) || [],
    };
  });
}

export function createPostRepository({ pool }) {
  return {
    async createPost({ authorId, content, imageUrl, privacy = 'public' }) {
      const result = await pool.query(
        `INSERT INTO posts (author_id, content, image_url, privacy)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [authorId, content, imageUrl, privacy]
      );

      return this.findById(result.rows[0].id);
    },

    async findById(postId) {
      const result = await pool.query(
        `${postSelect}
         WHERE p.id = $1`,
        [postId]
      );

      if (!result.rows[0]) return null;

      const commentResult = await pool.query(
        `SELECT c.id, c.post_id, c.content, c.created_at,
                u.id AS author_id, u.full_name, u.username, u.avatar_url
         FROM comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.post_id = $1 AND c.is_hidden = false
         ORDER BY c.created_at ASC`,
        [postId]
      );

      const post = attachReactionAndCommentsData(result.rows, [], [], commentResult.rows)[0];

      // Nếu là bài chia sẻ, lấy thêm thông tin bài gốc
      if (post && post.original_post_id) {
        const originalResult = await pool.query(
          `SELECT p.id, p.content, p.image_url, p.created_at, p.ai_status,
                  u.id AS author_id, u.full_name, u.username, u.avatar_url
           FROM posts p
           JOIN users u ON u.id = p.author_id
           WHERE p.id = $1`,
          [post.original_post_id]
        );
        post.original_post = originalResult.rows[0] || null;
      }

      return post;
    },

    async updatePost({ postId, authorId, content, imageUrl }) {
      const result = await pool.query(
        `UPDATE posts
         SET content = $3, image_url = $4, edited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND author_id = $2
         RETURNING id`,
        [postId, authorId, content, imageUrl]
      );

      if (!result.rows[0]) {
        const error = new Error('Bài viết không tồn tại');
        error.statusCode = 404;
        throw error;
      }

      return this.findById(result.rows[0].id);
    },

    async deletePost({ postId, authorId }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        const result = await client.query(
          `DELETE FROM posts
           WHERE id = $1 AND author_id = $2
           RETURNING id`,
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

    async createComment({ postId, authorId, content }) {
      const res = await pool.query(
        `INSERT INTO comments (post_id, author_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, post_id, author_id, content, created_at`,
        [postId, authorId, content]
      );

      await pool.query(
        `UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1`,
        [postId]
      );

      const detail = await pool.query(
        `SELECT c.id, c.post_id, c.content, c.created_at,
                u.id AS author_id, u.full_name, u.username, u.avatar_url
         FROM comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.id = $1`,
        [res.rows[0].id]
      );

      return detail.rows[0];
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
        `SELECT c.id, c.post_id, c.content, c.created_at,
                u.id AS author_id, u.full_name, u.username, u.avatar_url
         FROM comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.post_id = ANY($1::bigint[]) AND c.is_hidden = false
         ORDER BY c.created_at ASC`,
        [postIds]
      );

      const posts = attachReactionAndCommentsData(result.rows, countResult.rows, myReactionResult.rows, commentsResult.rows);

      // Lấy thông tin bài gốc cho các bài chia sẻ
      const originalPostIds = posts
        .filter((p) => p.original_post_id)
        .map((p) => p.original_post_id);

      if (originalPostIds.length > 0) {
        const originalPostsResult = await pool.query(
          `SELECT p.id, p.content, p.image_url, p.created_at, p.ai_status,
                  u.id AS author_id, u.full_name, u.username, u.avatar_url
           FROM posts p
           JOIN users u ON u.id = p.author_id
           WHERE p.id = ANY($1::bigint[])`,
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

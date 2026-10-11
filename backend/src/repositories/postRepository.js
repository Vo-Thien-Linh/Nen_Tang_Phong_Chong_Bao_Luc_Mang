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

const emptyReactionCounts = () => ({
  like: 0,
  love: 0,
  haha: 0,
  wow: 0,
  sad: 0,
  angry: 0,
});

function attachReactionData(posts, countRows = [], myReactionRows = []) {
  const reactionDataByPost = new Map();

  for (const post of posts) {
    reactionDataByPost.set(Number(post.id), {
      counts: emptyReactionCounts(),
      total: 0,
      myReaction: null,
    });
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

  return posts.map((post) => {
    const reactionData = reactionDataByPost.get(Number(post.id));
    return {
      ...post,
      reaction_counts: reactionData?.counts || emptyReactionCounts(),
      total_reactions: reactionData?.total || 0,
      my_reaction: reactionData?.myReaction || null,
    };
  });
}

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

      return attachReactionData(result.rows, countResult.rows, myReactionResult.rows);
    },
  };
}

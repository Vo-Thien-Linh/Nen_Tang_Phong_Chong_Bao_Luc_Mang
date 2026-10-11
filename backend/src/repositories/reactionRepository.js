const emptyCounts = () => ({
  like: 0,
  love: 0,
  haha: 0,
  wow: 0,
  sad: 0,
  angry: 0,
});

function mapCounts(rows) {
  const counts = emptyCounts();
  for (const row of rows) {
    counts[row.reaction_type] = Number(row.count);
  }
  return counts;
}

export function createReactionRepository({ pool }) {
  return {
    async setReaction({ userId, postId, reactionType }) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const postResult = await client.query(
          `SELECT id, author_id, likes_count
           FROM posts
           WHERE id = $1 AND ai_status = 'approved'
           FOR UPDATE`,
          [postId]
        );

        const post = postResult.rows[0];
        if (!post) {
          const error = new Error('Bài viết không tồn tại');
          error.statusCode = 404;
          throw error;
        }

        const currentResult = await client.query(
          `SELECT reaction_type
           FROM post_reactions
           WHERE user_id = $1 AND post_id = $2`,
          [userId, postId]
        );
        const currentReaction = currentResult.rows[0]?.reaction_type || null;

        let action;
        let myReaction;

        if (!currentReaction) {
          await client.query(
            `INSERT INTO post_reactions (user_id, post_id, reaction_type)
             VALUES ($1, $2, $3)`,
            [userId, postId, reactionType]
          );
          await client.query(
            `UPDATE posts
             SET likes_count = likes_count + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [postId]
          );

          if (post.author_id !== userId) {
            await client.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
               VALUES ($1, $2, 'like', $3, $4)`,
              [post.author_id, userId, 'đã thả icon vào bài viết của bạn', postId]
            );
          }

          action = 'created';
          myReaction = reactionType;
        } else if (currentReaction === reactionType) {
          await client.query(
            `DELETE FROM post_reactions
             WHERE user_id = $1 AND post_id = $2`,
            [userId, postId]
          );
          await client.query(
            `UPDATE posts
             SET likes_count = GREATEST(likes_count - 1, 0), updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [postId]
          );
          action = 'removed';
          myReaction = null;
        } else {
          await client.query(
            `UPDATE post_reactions
             SET reaction_type = $3, created_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND post_id = $2`,
            [userId, postId, reactionType]
          );
          action = 'updated';
          myReaction = reactionType;
        }

        const countResult = await client.query(
          `SELECT reaction_type, COUNT(*)::int AS count
           FROM post_reactions
           WHERE post_id = $1
           GROUP BY reaction_type`,
          [postId]
        );
        const totalResult = await client.query(
          `SELECT likes_count
           FROM posts
           WHERE id = $1`,
          [postId]
        );

        await client.query('COMMIT');

        return {
          action,
          myReaction,
          totalCount: Number(totalResult.rows[0]?.likes_count || 0),
          counts: mapCounts(countResult.rows),
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

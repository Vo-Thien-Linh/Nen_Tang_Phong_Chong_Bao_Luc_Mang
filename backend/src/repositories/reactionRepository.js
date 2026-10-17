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
    async setReaction({ userId, postId, reactionType, forceRemove = false }) {
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

        const isRevoke = forceRemove || (!reactionType && currentReaction) || (reactionType && currentReaction === reactionType);

        if (isRevoke) {
          if (currentReaction) {
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
          }
          action = 'removed';
          myReaction = null;
        } else if (!currentReaction) {
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
            const reactionLabels = {
              like: 'đã thích bài viết của bạn',
              love: 'đã thả tim bài viết của bạn',
              haha: 'đã thả haha vào bài viết của bạn',
              wow: 'đã thả bất ngờ vào bài viết của bạn',
              sad: 'đã thả buồn vào bài viết của bạn',
              angry: 'đã thả tức giận vào bài viết của bạn',
            };
            const notifContent = reactionLabels[reactionType] || 'đã bày tỏ cảm xúc về bài viết của bạn';
            await client.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
               VALUES ($1, $2, 'like', $3, $4)`,
              [post.author_id, userId, notifContent, postId]
            );
          }

          action = 'created';
          myReaction = reactionType;
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
        await client.query('COMMIT');

        const counts = mapCounts(countResult.rows);
        const totalCount = Object.values(counts).reduce((total, count) => total + count, 0);

        return {
          action,
          myReaction,
          totalCount,
          totalReactions: totalCount,
          counts,
          reactionCounts: counts,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async getPostReactions({ postId }) {
      try {
        const cleanId = Number(String(postId).replace(/^post-/, ''));
        if (Number.isNaN(cleanId)) return [];

        const result = await pool.query(
          `SELECT pr.reaction_type, pr.created_at, u.id, u.full_name AS name, u.avatar_url AS avatar, u.username
           FROM post_reactions pr
           JOIN users u ON pr.user_id = u.id
           WHERE pr.post_id = $1
           ORDER BY pr.created_at DESC`,
          [cleanId]
        );
        return result.rows.map(r => ({
          userId: r.id,
          name: r.name,
          avatar: r.avatar,
          username: r.username,
          reactionType: r.reaction_type,
          createdAt: r.created_at
        }));
      } catch (err) {
        return [];
      }
    },
  };
}

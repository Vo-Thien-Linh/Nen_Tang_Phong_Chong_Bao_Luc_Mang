export function createNotificationRepository({ pool }) {
  return {
    async listByUser({ recipientId, limit = 30, offset = 0, filter = 'all' }) {
      const params = [recipientId];
      let filterCondition = '';

      if (filter === 'unread') {
        filterCondition = 'AND n.is_read = FALSE';
      } else if (filter === 'interaction') {
        filterCondition = "AND n.type IN ('like', 'comment', 'share', 'reaction')";
      } else if (filter === 'system') {
        filterCondition = "AND n.type IN ('system', 'ai_moderation', 'report', 'appeal', 'warning')";
      }

      params.push(limit);
      params.push(offset);

      const query = `
        SELECT 
          n.id,
          n.recipient_id,
          n.actor_id,
          n.type,
          n.content,
          n.target_post_id,
          n.is_read,
          n.created_at,
          u.full_name AS actor_name,
          u.username AS actor_username,
          u.avatar_url AS actor_avatar,
          p.content AS post_content,
          p.image_url AS post_image
        FROM notifications n
        LEFT JOIN users u ON u.id = n.actor_id
        LEFT JOIN posts p ON p.id = n.target_post_id
        WHERE n.recipient_id = $1 ${filterCondition}
          AND (p.image_moderation_status IS DISTINCT FROM 'rejected_final'
               OR (n.type = 'system' AND n.content LIKE 'Sau khi xem%'))
        ORDER BY n.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, params);
      return result.rows;
    },

    async getUnreadCount(recipientId) {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM notifications n
         LEFT JOIN posts p ON p.id = n.target_post_id
         WHERE n.recipient_id = $1 AND n.is_read = FALSE
           AND (p.image_moderation_status IS DISTINCT FROM 'rejected_final'
                OR (n.type = 'system' AND n.content LIKE 'Sau khi xem%'))`,
        [recipientId]
      );
      return result.rows[0]?.count || 0;
    },

    async markAsRead({ id, recipientId }) {
      const result = await pool.query(
        `UPDATE notifications 
         SET is_read = TRUE 
         WHERE id = $1 AND recipient_id = $2 
         RETURNING id, is_read`,
        [id, recipientId]
      );
      return result.rows[0] || null;
    },

    async markAllAsRead({ recipientId }) {
      const result = await pool.query(
        `UPDATE notifications 
         SET is_read = TRUE 
         WHERE recipient_id = $1 AND is_read = FALSE
         RETURNING id`,
        [recipientId]
      );
      return result.rows.length;
    },

    async deleteNotification({ id, recipientId }) {
      const result = await pool.query(
        `DELETE FROM notifications 
         WHERE id = $1 AND recipient_id = $2 
         RETURNING id`,
        [id, recipientId]
      );
      return result.rows[0] || null;
    },

    async clearReadNotifications({ recipientId }) {
      const result = await pool.query(
        `DELETE FROM notifications 
         WHERE recipient_id = $1 AND is_read = TRUE
         RETURNING id`,
        [recipientId]
      );
      return result.rows.length;
    },

    async createNotification({ recipientId, actorId = null, type, content, targetPostId = null }) {
      const result = await pool.query(
        `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [recipientId, actorId, type, content, targetPostId]
      );
      return result.rows[0];
    }
  };
}

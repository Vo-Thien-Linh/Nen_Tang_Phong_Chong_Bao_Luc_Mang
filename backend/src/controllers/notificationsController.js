function formatRelativeTime(createdAt) {
  if (!createdAt) return 'Vừa xong';
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return 'Vừa xong';

  const diffMs = Date.now() - createdDate.getTime();
  if (diffMs < 60_000) return 'Vừa xong';

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;

  if (diffDays < 30) {
    const diffWeeks = Math.floor(diffDays / 7);
    return diffWeeks <= 1 ? 'tuần trước' : `${diffWeeks} tuần trước`;
  }

  if (diffDays < 365) {
    const diffMonths = Math.max(1, Math.floor(diffDays / 30));
    return `${diffMonths} tháng trước`;
  }

  const day = String(createdDate.getDate()).padStart(2, '0');
  const month = String(createdDate.getMonth() + 1).padStart(2, '0');
  const year = createdDate.getFullYear();
  return `${day}/${month}/${year}`;
}

export function createNotificationsController({ notificationRepository }) {
  return {
    async listNotifications(req, res, next) {
      try {
        const userId = req.user.id;
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
        const filter = req.query.filter || 'all';

        const [items, unreadCount] = await Promise.all([
          notificationRepository.listByUser({
            recipientId: userId,
            limit,
            offset,
            filter,
          }),
          notificationRepository.getUnreadCount(userId),
        ]);

        const mappedItems = items.map((row) => ({
          id: String(row.id),
          type: row.type,
          content: row.content,
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
          time: formatRelativeTime(row.created_at),
          user: ['ai_moderation', 'system', 'warning', 'report', 'appeal', 'report_receipt'].includes(row.type)
            ? {
                id: 'system',
                name: 'Thông báo hệ thống',
                username: 'system',
                avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
              }
            : row.actor_id
              ? {
                  id: row.actor_id,
                  name: row.actor_name || 'Người dùng',
                  username: row.actor_username || '',
                  avatar:
                    row.actor_avatar ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
                }
              : {
                  id: 'system',
                  name: 'Thông báo hệ thống',
                  username: 'system',
                  avatar:
                    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
                },
          snapshot: row.payload || null,
          targetPost: row.target_post_id && row.payload?.type !== 'moderation_removal'
            ? {
                id: String(row.target_post_id),
                contentSnippet: row.post_content
                  ? row.post_content.length > 70
                    ? row.post_content.slice(0, 70) + '...'
                    : row.post_content
                  : '',
                image: row.post_image || null,
              }
            : null,
        }));

        res.json({
          success: true,
          data: mappedItems,
          unreadCount: Number(unreadCount),
        });
      } catch (error) {
        next(error);
      }
    },

    async getUnreadCount(req, res, next) {
      try {
        const userId = req.user.id;
        const unreadCount = await notificationRepository.getUnreadCount(userId);
        res.json({
          success: true,
          unreadCount: Number(unreadCount),
        });
      } catch (error) {
        next(error);
      }
    },

    async markAsRead(req, res, next) {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const updated = await notificationRepository.markAsRead({
          id,
          recipientId: userId,
        });

        if (!updated) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy thông báo',
          });
        }

        const unreadCount = await notificationRepository.getUnreadCount(userId);

        res.json({
          success: true,
          message: 'Đã đánh dấu thông báo là đã đọc',
          unreadCount: Number(unreadCount),
        });
      } catch (error) {
        next(error);
      }
    },

    async markAllAsRead(req, res, next) {
      try {
        const userId = req.user.id;
        await notificationRepository.markAllAsRead({ recipientId: userId });
        res.json({
          success: true,
          message: 'Đã đánh dấu tất cả thông báo là đã đọc',
          unreadCount: 0,
        });
      } catch (error) {
        next(error);
      }
    },

    async deleteNotification(req, res, next) {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const deleted = await notificationRepository.deleteNotification({
          id,
          recipientId: userId,
        });

        if (!deleted) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy thông báo',
          });
        }

        const unreadCount = await notificationRepository.getUnreadCount(userId);

        res.json({
          success: true,
          message: 'Đã xóa thông báo thành công',
          unreadCount: Number(unreadCount),
        });
      } catch (error) {
        next(error);
      }
    },

    async clearReadNotifications(req, res, next) {
      try {
        const userId = req.user.id;
        const deletedCount = await notificationRepository.clearReadNotifications({
          recipientId: userId,
        });
        res.json({
          success: true,
          message: `Đã dọn dẹp ${deletedCount} thông báo đã đọc`,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

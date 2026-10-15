import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { createNotificationRepository } from '../repositories/notificationRepository.js';
import { createNotificationsController } from '../controllers/notificationsController.js';

export function createNotificationsRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const notificationRepository = createNotificationRepository({ pool });
  const notificationsController = createNotificationsController({ notificationRepository });
  const { requireAuth } = createAuthMiddleware({ userRepository });

  // Tất cả các hành động liên quan đến thông báo đều cần đăng nhập
  router.get('/', requireAuth, notificationsController.listNotifications);
  router.get('/unread-count', requireAuth, notificationsController.getUnreadCount);
  router.patch('/read-all', requireAuth, notificationsController.markAllAsRead);
  router.patch('/:id/read', requireAuth, notificationsController.markAsRead);
  router.delete('/read', requireAuth, notificationsController.clearReadNotifications);
  router.delete('/:id', requireAuth, notificationsController.deleteNotification);

  return router;
}

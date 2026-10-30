import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { createUsersController, formatUserProfile, formatFriend } from '../controllers/usersController.js';

export { formatUserProfile, formatFriend };

export function createUsersRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const { requireAuth, optionalAuth, requireRole } = createAuthMiddleware({ userRepository });
  const usersController = createUsersController({ userRepository, pool });

  /**
   * Quản trị viên lấy danh sách toàn bộ người dùng hệ thống
   */
  router.get('/', requireRole('admin'), usersController.listUsers);

  /**
   * Cập nhật vai trò người dùng (user / moderator / admin)
   */
  router.patch('/:userId/role', requireRole('admin'), usersController.updateRole);

  /**
   * Cấp hoặc thu hồi tích xanh
   */
  router.patch('/:userId/verification', requireRole('admin'), usersController.updateVerification);

  /**
   * Áp dụng hoặc gỡ bỏ xử phạt người dùng (ban / unban / clear_cooldown)
   */
  router.post('/:userId/sanction', requireRole('moderator'), usersController.updateSanction);

  /**
   * Lấy thông tin trang cá nhân
   */
  router.get('/:userId/profile', optionalAuth, usersController.getProfile);

  /**
   * Cập nhật thông tin trang cá nhân
   */
  router.patch('/:userId/profile', requireAuth, usersController.updateProfile);

  /**
   * Lấy danh sách bạn bè
   */
  router.get('/:userId/friends', optionalAuth, usersController.getFriends);

  /**
   * Lấy tất cả bài viết của một người dùng
   */
  router.get('/:userId/posts', optionalAuth, usersController.getUserPosts);

  /**
   * Lấy lịch sử điểm uy tín của người dùng
   */
  router.get('/:userId/trust-history', requireAuth, usersController.getTrustHistory);

  return router;
}

import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { createAppealRepository } from '../repositories/appealRepository.js';
import { createAppealsController } from '../controllers/appealsController.js';

export function createAppealsRouter({ pool, userRepository }) {
  const router = express.Router();
  const userRepo = userRepository || createUserRepository({ pool });
  const { requireRole } = createAuthMiddleware({ userRepository: userRepo });
  const appealRepository = createAppealRepository({ pool });
  const appealsController = createAppealsController({ appealRepository });

  /**
   * GET /api/appeals
   * Lấy danh sách toàn bộ khiếu nại
   */
  router.get('/', requireRole('moderator'), appealsController.listAppeals);

  /**
   * POST /api/appeals
   * Gửi khiếu nại quyết định kiểm duyệt
   */
  router.post('/', appealsController.createAppeal);

  /**
   * PATCH /api/appeals/:id
   * Xử lý giải quyết khiếu nại (chấp thuận hoặc từ chối)
   */
  router.patch('/:id', requireRole('moderator'), appealsController.resolveAppeal);

  return router;
}


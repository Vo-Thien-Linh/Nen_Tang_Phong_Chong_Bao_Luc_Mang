import express from 'express';
import { createAuthMiddleware } from '../../../../backend/src/middleware/auth.js';
import { createUserRepository } from '../../../../backend/src/repositories/userRepository.js';
import { createAppealRepository } from '../../../../backend/src/repositories/appealRepository.js';
import { createAppealsController } from '../../../../backend/src/controllers/appealsController.js';

export function createAppealsRouter({ pool, userRepository }) {
  const router = express.Router();
  const userRepo = userRepository || createUserRepository({ pool });
  const { requireAuth, requireRole } = createAuthMiddleware({ userRepository: userRepo });
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
  router.post('/', requireAuth, appealsController.createAppeal);

  /**
   * PATCH /api/appeals/:id
   * Xử lý giải quyết khiếu nại (chấp thuận hoặc từ chối)
   */
  router.patch('/:id', requireRole('moderator'), appealsController.resolveAppeal);

  return router;
}


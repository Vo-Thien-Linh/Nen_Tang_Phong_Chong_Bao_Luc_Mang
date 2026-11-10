import express from 'express';
import { createAuthMiddleware } from '../../../../backend/src/middleware/auth.js';
import { createUserRepository } from '../../../../backend/src/repositories/userRepository.js';
import { createReportRepository } from '../../../../backend/src/repositories/reportRepository.js';
import { createReportsController } from '../../../../backend/src/controllers/reportsController.js';
import { createPostRepository } from '../../../../backend/src/repositories/postRepository.js';

export function createReportsRouter({ pool, userRepository, postRepository }) {
  const router = express.Router();
  const userRepo = userRepository || createUserRepository({ pool });
  const { requireAuth, requireRole } = createAuthMiddleware({ userRepository: userRepo });
  const reportRepository = createReportRepository({ pool });
  const reportsController = createReportsController({
    reportRepository,
    postRepository: postRepository || createPostRepository({ pool }),
  });

  /**
   * GET /api/reports
   * Lấy danh sách báo cáo vi phạm
   */
  router.get('/', requireRole('moderator'), reportsController.listReports);

  /**
   * POST /api/reports
   * Gửi báo cáo người dùng mới
   */
  router.post('/', requireAuth, reportsController.createReport);

  /**
   * PATCH /api/reports/:id
   * Xử lý báo cáo vi phạm (duyệt vi phạm hoặc bác bỏ)
   */
  router.patch('/:id', requireRole('moderator'), reportsController.resolveReport);

  return router;
}


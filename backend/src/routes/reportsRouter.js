import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { createReportRepository } from '../repositories/reportRepository.js';
import { createReportsController } from '../controllers/reportsController.js';

export function createReportsRouter({ pool, userRepository }) {
  const router = express.Router();
  const userRepo = userRepository || createUserRepository({ pool });
  const { requireRole } = createAuthMiddleware({ userRepository: userRepo });
  const reportRepository = createReportRepository({ pool });
  const reportsController = createReportsController({ reportRepository });

  /**
   * GET /api/reports
   * Lấy danh sách báo cáo vi phạm
   */
  router.get('/', requireRole('moderator'), reportsController.listReports);

  /**
   * POST /api/reports
   * Gửi báo cáo người dùng mới
   */
  router.post('/', reportsController.createReport);

  /**
   * PATCH /api/reports/:id
   * Xử lý báo cáo vi phạm (duyệt vi phạm hoặc bác bỏ)
   */
  router.patch('/:id', requireRole('moderator'), reportsController.resolveReport);

  return router;
}


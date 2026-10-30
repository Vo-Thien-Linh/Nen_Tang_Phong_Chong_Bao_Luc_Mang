import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { createAdminRepository } from '../repositories/adminRepository.js';
import { createAdminController } from '../controllers/adminController.js';

export function createAdminRouter({ pool, userRepository }) {
  const router = express.Router();
  const userRepo = userRepository || createUserRepository({ pool });
  const { requireRole } = createAuthMiddleware({ userRepository: userRepo });
  const adminRepository = createAdminRepository({ pool });
  const adminController = createAdminController({ adminRepository });

  /**
   * GET /api/admin/stats
   * Thống kê KPI Tổng quan Dashboard
   */
  router.get('/stats', requireRole('admin'), adminController.getStats);

  /**
   * POST /api/admin/override-ai-label
   * Hiệu chỉnh nhãn AI thủ công
   */
  router.post('/override-ai-label', requireRole('moderator'), adminController.createAiOverride);

  /**
   * GET /api/admin/ai-overrides
   * Lấy danh sách nhật ký hiệu chỉnh nhãn AI
   */
  router.get('/ai-overrides', requireRole('moderator'), adminController.listAiOverrides);

  /**
   * GET /api/admin/ai-overrides/export
   * Xuất danh sách nhật ký hiệu chỉnh nhãn AI dạng CSV UTF-8 BOM
   */
  router.get('/ai-overrides/export', requireRole('moderator'), adminController.exportAiOverridesCsv);

  /**
   * GET /api/admin/ai-overrides/export-excel
   * Xuất danh sách nhật ký hiệu chỉnh nhãn AI dạng Excel (.xlsx) chuẩn cột A -> H
   */
  router.get('/ai-overrides/export-excel', requireRole('moderator'), adminController.exportAiOverridesExcel);

  /**
   * GET /api/admin/moderation/export-uncertain-excel
   * Xuất danh sách ảnh phân vân (Pending Review) ra file Excel để Retrain mô hình AI
   */
  router.get('/moderation/export-uncertain-excel', requireRole('moderator'), adminController.exportUncertainExcel);

  return router;
}


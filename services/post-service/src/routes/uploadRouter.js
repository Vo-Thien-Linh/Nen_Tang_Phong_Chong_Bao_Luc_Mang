import express from 'express';
import cloudinary, { upload, uploadStoryMedia } from '../../../../backend/src/config/cloudinary.js';
import { uploadController } from '../../../../backend/src/controllers/uploadController.js';
import { createAuthMiddleware } from '../../../../backend/src/middleware/auth.js';
import { createUserRepository } from '../../../../backend/src/repositories/userRepository.js';
import { consumeCloudinaryCleanupTicket, verifyCloudinaryCleanupTicket } from '../../../../backend/src/utils/cloudinaryCleanupTicket.js';

export function createUploadRouter({ pool }) {
  const router = express.Router();
  const { requireAuth } = createAuthMiddleware({ userRepository: createUserRepository({ pool }) });

  /**
   * POST /api/upload
   * Tải ảnh bài viết lên Cloudinary
   */
  router.post('/', requireAuth, upload.single('image'), uploadController.uploadImage);

  router.post('/cleanup', requireAuth, async (req, res, next) => {
    try {
      const publicId = verifyCloudinaryCleanupTicket({
        ticket: req.body?.cleanupToken,
        userId: req.user.id,
        imageUrl: req.body?.imageUrl,
      });
      if (!publicId) return res.json({ success: true, deleted: false });
      const result = await cloudinary.uploader.destroy(publicId);
      if (result?.result === 'error') {
        const error = new Error('Cloudinary không xóa được ảnh');
        error.statusCode = 502;
        throw error;
      }
      consumeCloudinaryCleanupTicket(req.body.cleanupToken);
      return res.json({ success: true, deleted: result?.result === 'ok' });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/upload/story-media
   * Tải ảnh hoặc video (max 60s/60MB) cho Tin lên Cloudinary
   */
  router.post('/story-media', requireAuth, uploadStoryMedia.single('media'), uploadController.uploadStoryMedia);

  return router;
}


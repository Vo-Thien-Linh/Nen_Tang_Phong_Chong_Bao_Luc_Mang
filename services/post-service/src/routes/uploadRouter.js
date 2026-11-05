import express from 'express';
import { upload, uploadStoryMedia } from '../../../../backend/src/config/cloudinary.js';
import { uploadController } from '../../../../backend/src/controllers/uploadController.js';
import { createAuthMiddleware } from '../../../../backend/src/middleware/auth.js';
import { createUserRepository } from '../../../../backend/src/repositories/userRepository.js';

export function createUploadRouter({ pool }) {
  const router = express.Router();
  const { requireAuth } = createAuthMiddleware({ userRepository: createUserRepository({ pool }) });

  /**
   * POST /api/upload
   * Tải ảnh bài viết lên Cloudinary
   */
  router.post('/', requireAuth, upload.single('image'), uploadController.uploadImage);

  /**
   * POST /api/upload/story-media
   * Tải ảnh hoặc video (max 60s/60MB) cho Tin lên Cloudinary
   */
  router.post('/story-media', requireAuth, uploadStoryMedia.single('media'), uploadController.uploadStoryMedia);

  return router;
}


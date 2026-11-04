import express from 'express';
import { upload } from '../../../../backend/src/config/cloudinary.js';
import { uploadController } from '../../../../backend/src/controllers/uploadController.js';
import { createAuthMiddleware } from '../../../../backend/src/middleware/auth.js';
import { createUserRepository } from '../../../../backend/src/repositories/userRepository.js';

export function createUploadRouter({ pool }) {
  const router = express.Router();
  const { requireAuth } = createAuthMiddleware({ userRepository: createUserRepository({ pool }) });

  /**
   * POST /api/upload
   * Tải ảnh lên Cloudinary
   */
  router.post('/', requireAuth, upload.single('image'), uploadController.uploadImage);

  return router;
}


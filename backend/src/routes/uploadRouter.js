import express from 'express';
import { upload } from '../config/cloudinary.js';
import { uploadController } from '../controllers/uploadController.js';

export function createUploadRouter() {
  const router = express.Router();

  /**
   * POST /api/upload
   * Tải ảnh lên Cloudinary
   */
  router.post('/', upload.single('image'), uploadController.uploadImage);

  return router;
}


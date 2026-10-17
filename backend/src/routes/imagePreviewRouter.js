import express from 'express';
import multer from 'multer';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { previewImageBytes } from '../services/imageModerationClient.js';

export function createImagePreviewRouter({ pool }) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  const { requireAuth } = createAuthMiddleware({ userRepository: createUserRepository({ pool }) });
  router.post('/', requireAuth, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Chưa có ảnh' });
    const result = await previewImageBytes(req.file);
    res.json({ success: true, data: result });
  });
  return router;
}

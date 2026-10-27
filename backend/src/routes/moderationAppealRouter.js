import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { appealImageModeration } from '../services/imageModerationReviewService.js';

export function createModerationAppealRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const { requireAuth } = createAuthMiddleware({ userRepository });
  router.post('/:postId/appeal', requireAuth, async (req, res, next) => {
    await submitAppeal(req, res, next, pool, 'post', req.params.postId);
  });
  router.post('/:postId/comments/:commentId/appeal', requireAuth, async (req, res, next) => {
    await submitAppeal(req, res, next, pool, 'comment', req.params.commentId);
  });
  return router;
}

async function submitAppeal(req, res, next, pool, contentType, contentId) {
  try {
    const result = await appealImageModeration({ pool, contentType, contentId, authorId: req.user.id });
    if (!result.ok) return res.status(result.statusCode).json({ success: false, message: result.message });
    return res.json({ success: true, data: result.data });
  } catch (error) { return next(error); }
}

import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { createHashtagRepository } from '../repositories/hashtagRepository.js';
import { getHashtagTrendingDays } from '../config/hashtagConfig.js';
import { normalizeHashtag } from '../utils/hashtag.js';
import { mapPostToResponse } from '../controllers/postsController.js';

export function createHashtagsRouter({ pool, postRepository }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const { requireAuth } = createAuthMiddleware({ userRepository });
  const hashtagRepository = createHashtagRepository({ pool, postRepository });

  router.get('/trending', requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 5));
      const data = await hashtagRepository.findTrending({
        limit,
        days: getHashtagTrendingDays(),
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:tag/posts', requireAuth, async (req, res, next) => {
    try {
      const tag = normalizeHashtag(decodeURIComponent(req.params.tag || ''));
      if (!tag) return res.status(400).json({ success: false, message: 'Hashtag không hợp lệ' });
      const result = await hashtagRepository.findPosts({
        tag,
        page: req.query.page,
        limit: req.query.limit,
        viewerId: req.user.id,
      });
      res.json({
        success: true,
        data: result.posts.map((post) => mapPostToResponse(post, req.user.id)),
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

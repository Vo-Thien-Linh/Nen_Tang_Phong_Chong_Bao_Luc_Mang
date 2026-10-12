import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createPostsController } from '../controllers/postsController.js';
import { createPostRepository } from '../repositories/postRepository.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { createPostService } from '../services/postService.js';
import { moderationHook } from '../services/moderationHook.js';

export function createPostsRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const postRepository = createPostRepository({ pool });
  const postService = createPostService({ postRepository, moderationHook });
  const postsController = createPostsController({ postService, postRepository });
  const { requireAuth, optionalAuth } = createAuthMiddleware({ userRepository });

  router.get('/', optionalAuth, postsController.listPosts);
  router.post('/', requireAuth, postsController.createPost);
  router.post('/:postId/comments', requireAuth, postsController.createComment);

  return router;
}

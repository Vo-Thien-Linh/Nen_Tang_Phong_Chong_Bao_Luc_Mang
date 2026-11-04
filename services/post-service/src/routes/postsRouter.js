import express from 'express';
import { createAuthMiddleware } from '../../../../backend/src/middleware/auth.js';
import { createPostsController } from '../../../../backend/src/controllers/postsController.js';
import { createPostRepository } from '../../../../backend/src/repositories/postRepository.js';
import { createUserRepository } from '../../../../backend/src/repositories/userRepository.js';
import { createPostService } from '../../../../backend/src/services/postService.js';
import { moderationHook } from '../../../../backend/src/services/moderationHook.js';
import { moderateImageUrl } from '../../../../backend/src/services/imageModerationClient.js';

export function createPostsRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const postRepository = createPostRepository({ pool });
  const postService = createPostService({ postRepository, moderationHook, imageModerationClient: moderateImageUrl });
  const postsController = createPostsController({ postService, postRepository, imageModerationClient: moderateImageUrl });
  const { requireAuth, optionalAuth } = createAuthMiddleware({ userRepository });

  router.get('/', optionalAuth, postsController.listPosts);
  router.get('/:postId', optionalAuth, postsController.getPost);
  router.post('/', requireAuth, postsController.createPost);
  router.put('/:postId', requireAuth, postsController.editPost);
  router.delete('/:postId', requireAuth, postsController.deletePost);
  router.post('/:postId/comments', requireAuth, postsController.createComment);
  router.post('/:postId/share', requireAuth, postsController.sharePost);

  return router;
}

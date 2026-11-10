import express from 'express';
import { createAuthMiddleware } from '../../../../backend/src/middleware/auth.js';
import { createPostReactionsController } from '../../../../backend/src/controllers/postReactionsController.js';
import { createReactionRepository } from '../../../../backend/src/repositories/reactionRepository.js';
import { createUserRepository } from '../../../../backend/src/repositories/userRepository.js';
import { createReactionService } from '../../../../backend/src/services/reactionService.js';

export function createPostReactionsRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const reactionRepository = createReactionRepository({ pool });
  const reactionService = createReactionService({ reactionRepository });
  const postReactionsController = createPostReactionsController({ reactionService });
  const { requireAuth } = createAuthMiddleware({ userRepository });

  router.put('/:postId/reaction', requireAuth, postReactionsController.reactToPost);
  router.get('/:postId/reactions', requireAuth, postReactionsController.listPostReactions);

  return router;
}

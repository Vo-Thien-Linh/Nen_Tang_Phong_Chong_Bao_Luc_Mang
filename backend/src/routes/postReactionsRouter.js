import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createPostReactionsController } from '../controllers/postReactionsController.js';
import { createReactionRepository } from '../repositories/reactionRepository.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { createReactionService } from '../services/reactionService.js';

export function createPostReactionsRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const reactionRepository = createReactionRepository({ pool });
  const reactionService = createReactionService({ reactionRepository });
  const postReactionsController = createPostReactionsController({ reactionService });
  const { requireAuth } = createAuthMiddleware({ userRepository });

  router.put('/:postId/reaction', requireAuth, postReactionsController.reactToPost);

  return router;
}

import { isValidReactionType, normalizeReactionType } from './reactionTypes.js';

export function createReactionService({ reactionRepository }) {
  return {
    async reactToPost({ user, postId, type }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để thả icon');
        error.statusCode = 401;
        throw error;
      }

      const reactionType = normalizeReactionType(type);
      if (!isValidReactionType(reactionType)) {
        const error = new Error('Loại cảm xúc không hợp lệ');
        error.statusCode = 400;
        throw error;
      }

      return reactionRepository.setReaction({
        userId: user.id,
        postId,
        reactionType,
      });
    },
  };
}

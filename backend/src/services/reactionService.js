import { isValidReactionType, normalizeReactionType } from './reactionTypes.js';

export function createReactionService({ reactionRepository }) {
  return {
    async reactToPost({ user, postId, type = 'like', action }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để thả icon');
        error.statusCode = 401;
        throw error;
      }

      // Thu hồi cảm xúc rõ ràng khi action là 'remove' hoặc type là null / rỗng
      if (action === 'remove' || type === null || type === '' || type === 'none') {
        return reactionRepository.setReaction({
          userId: user.id,
          postId,
          reactionType: null,
          forceRemove: true,
        });
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
        forceRemove: false,
      });
    },

    async getPostReactions({ postId }) {
      if (!postId) return [];
      if (typeof reactionRepository.getPostReactions === 'function') {
        return reactionRepository.getPostReactions({ postId });
      }
      return [];
    },
  };
}

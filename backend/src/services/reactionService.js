import { isValidReactionType, normalizeReactionType } from './reactionTypes.js';

function resolveReactionCommand({ user, type = 'like', action }) {
  if (!user?.id) {
    const error = new Error('Bạn cần đăng nhập để thả icon');
    error.statusCode = 401;
    throw error;
  }

  if (action === 'remove' || type === null || type === '' || type === 'none') {
    return { reactionType: null, forceRemove: true };
  }

  const reactionType = normalizeReactionType(type);
  if (!isValidReactionType(reactionType)) {
    const error = new Error('Loại cảm xúc không hợp lệ');
    error.statusCode = 400;
    throw error;
  }

  return { reactionType, forceRemove: false };
}

export function createReactionService({ reactionRepository }) {
  return {
    async reactToPost({ user, postId, type = 'like', action }) {
      const cmd = resolveReactionCommand({ user, type, action });
      return reactionRepository.setReaction({
        userId: user.id,
        postId,
        reactionType: cmd.reactionType,
        forceRemove: cmd.forceRemove,
      });
    },

    async reactToComment({ user, postId, commentId, type = 'like', action }) {
      const cmd = resolveReactionCommand({ user, type, action });
      return reactionRepository.setCommentReaction({
        userId: user.id,
        postId,
        commentId,
        reactionType: cmd.reactionType,
        forceRemove: cmd.forceRemove,
      });
    },

    async getPostReactions({ user, postId }) {
      if (!postId) return [];
      if (typeof reactionRepository.getPostReactions === 'function') {
        return reactionRepository.getPostReactions({ postId, viewerId: user?.id || null });
      }
      return [];
    },
  };
}

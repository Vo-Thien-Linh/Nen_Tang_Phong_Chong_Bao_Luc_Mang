export function getFinalRejectionEvent({ id, type, postId }) {
  if (type === 'post') return { type: 'POST_DELETED', postId: String(id) };
  if (type === 'comment') return { type: 'COMMENT_DELETED', postId: String(postId), commentId: String(id) };
  return null;
}

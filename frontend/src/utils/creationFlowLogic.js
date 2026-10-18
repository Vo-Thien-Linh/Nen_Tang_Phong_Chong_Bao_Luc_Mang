export function prependCreatedPost(posts, newPost) {
  if (!newPost || posts.some((post) => String(post.id) === String(newPost.id))) return posts;
  return [newPost, ...posts];
}

export function incrementPostCountOnce(user, newPost, alreadyAdded) {
  if (!user || alreadyAdded || String(newPost?.author?.id || newPost?.author_id) !== String(user.id)) return user;
  return { ...user, postsCount: Number(user.postsCount || 0) + 1 };
}

export function appendCreatedComment(post, comment) {
  if (!post || !comment || (post.comments || []).some((item) => String(item.id) === String(comment.id))) return post;
  const isHidden = Boolean(comment.is_hidden || comment.isHidden || comment.ai_status === 'hidden' || comment.aiStatus === 'hidden');
  return {
    ...post,
    comments: [...(post.comments || []), comment],
    commentsCount: isHidden ? Number(post.commentsCount || 0) : Number(post.commentsCount || 0) + 1,
  };
}

export function canStartCreation(isPending) {
  return !isPending;
}

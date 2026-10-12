export function isOwnPost(post, currentUser) {
  return Boolean(post?.author?.id && currentUser?.id && String(post.author.id) === String(currentUser.id));
}

export function canEditPost(post, currentUser) {
  return isOwnPost(post, currentUser) && post?.moderationStatus !== 'hidden' && post?.aiStatus?.status !== 'hidden';
}

export function canDeletePost(post, currentUser) {
  return isOwnPost(post, currentUser);
}

export function canReportPost(post, currentUser) {
  return !isOwnPost(post, currentUser);
}

export function cancelEditPost(originalPost) {
  return originalPost;
}

export function applyUpdatedPostToList(posts, updatedPost) {
  return posts.map((post) => {
    if (String(post.id) !== String(updatedPost.id)) return post;

    return {
      ...post,
      content: updatedPost.content,
      image: updatedPost.image ?? null,
      createdAt: updatedPost.createdAt ?? post.createdAt,
      createdAtIso: updatedPost.createdAtIso ?? post.createdAtIso,
      editedAt: updatedPost.editedAt ?? post.editedAt,
      isEdited: Boolean(updatedPost.isEdited ?? updatedPost.editedAt ?? post.isEdited),
      aiStatus: updatedPost.aiStatus ?? post.aiStatus,
      moderationStatus: updatedPost.moderationStatus ?? post.moderationStatus,
      inlineNotice: updatedPost.inlineNotice ?? post.inlineNotice ?? null,
    };
  });
}

export function removePostFromList(posts, postId) {
  return posts.filter((post) => String(post.id) !== String(postId));
}

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
  if (!Array.isArray(posts) || !updatedPost) return posts;
  return posts.map((post) => {
    if (String(post.id) !== String(updatedPost.id)) {
      if (String(post.originalPost?.id) !== String(updatedPost.id)) return post;
      return { ...post, originalPost: { ...post.originalPost, ...updatedPost } };
    }

    return {
      ...post,
      ...updatedPost,
      content: updatedPost.content ?? post.content,
      image: updatedPost.image ?? updatedPost.image_url ?? post.image ?? null,
      createdAt: updatedPost.createdAt ?? post.createdAt,
      createdAtIso: updatedPost.createdAtIso ?? post.createdAtIso,
      editedAt: updatedPost.editedAt ?? post.editedAt,
      isEdited: Boolean(updatedPost.isEdited ?? updatedPost.editedAt ?? post.isEdited),
      aiStatus: updatedPost.aiStatus ?? post.aiStatus,
      moderationStatus: updatedPost.moderationStatus ?? post.moderationStatus,
      imageModeration: updatedPost.imageModeration ?? post.imageModeration,
      image_moderation_status: updatedPost.image_moderation_status ?? post.image_moderation_status,
      image_moderation_label: updatedPost.image_moderation_label ?? post.image_moderation_label,
      comments: updatedPost.comments ?? post.comments,
      commentsCount: updatedPost.commentsCount ?? updatedPost.comments_count ?? post.commentsCount,
      inlineNotice: updatedPost.inlineNotice ?? post.inlineNotice ?? null,
    };
  });
}

export function removePostFromList(posts, postId) {
  return posts.filter((post) => String(post.id) !== String(postId));
}

export async function runPostDeleteAction({ deleteRequest, onSuccess }) {
  const result = await deleteRequest();
  onSuccess?.(result);
  return result;
}

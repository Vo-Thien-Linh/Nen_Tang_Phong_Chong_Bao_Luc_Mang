export function markPostWithNotice(post, notice) {
  return {
    ...post,
    inlineNotice: notice,
  };
}

export function markDeletedPostNotice(post, message = 'Xóa bài viết thành công') {
  return markPostWithNotice(post, {
    type: 'delete',
    tone: 'danger',
    message,
  });
}

export function markEditPostNotice(post, message = 'Cập nhật bài viết thành công') {
  return markPostWithNotice(post, {
    type: 'edit',
    tone: 'success',
    message,
  });
}

export function isDeletedNoticePost(post) {
  return post?.inlineNotice?.type === 'delete';
}

/**
 * Kiểm tra xem bài viết có bị ẩn cứng (do vi phạm bạo lực, thù ghét hoặc ảnh bị từ chối) hay không
 */
export function isHardHiddenPost(post) {
  if (!post) return false;

  // 1. Kiểm tra trạng thái AI (PhoBERT)
  const aiStatus = post.ai_status || post.aiStatus?.status || post.moderationStatus;
  if (aiStatus === 'hidden') return true;

  // 2. Kiểm tra cờ ẩn trực tiếp
  if (post.isHidden || post.is_hidden) return true;

  // 3. Kiểm tra nhãn bạo lực / thù ghét khi không được duyệt
  const aiLabel = post.ai_label || post.aiLabel || post.aiStatus?.label;
  if ((aiLabel === 'Violence' || aiLabel === 'Hate Speech') && aiStatus !== 'approved') return true;

  // 4. Kiểm tra trạng thái kiểm duyệt hình ảnh bị từ chối / giữ lại (Bạo lực)
  const imageStatus = post.imageModeration?.status || post.image_moderation_status;
  if (['rejected_hold', 'rejected_admin', 'appeal_pending', 'rejected_final'].includes(imageStatus)) {
    return true;
  }

  return false;
}

export function countVisiblePosts(posts = []) {
  return posts.filter((post) => !isDeletedNoticePost(post) && !isHardHiddenPost(post)).length;
}

export function clearPostNotice(posts = [], postId) {
  return posts.map((post) => (
    String(post.id) === String(postId)
      ? { ...post, inlineNotice: null }
      : post
  ));
}

export function removeDeletedNotice(posts = [], postId) {
  return posts.filter((post) => !(String(post.id) === String(postId) && isDeletedNoticePost(post)));
}

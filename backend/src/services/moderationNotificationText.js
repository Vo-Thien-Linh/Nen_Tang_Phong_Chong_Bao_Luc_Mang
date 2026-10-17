export function moderationRejectionNotification(contentType = 'post') {
  return contentType === 'comment'
    ? 'Bình luận của bạn chứa ảnh bị từ chối sau khi quản trị viên xem xét'
    : 'Bài viết của bạn chứa ảnh bị từ chối sau khi quản trị viên xem xét';
}

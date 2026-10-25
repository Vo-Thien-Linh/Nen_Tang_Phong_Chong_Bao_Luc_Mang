export function moderationRejectionNotification(contentType = 'post') {
  return contentType === 'comment'
    ? 'Bình luận của bạn chứa ảnh bị từ chối sau khi quản trị viên xem xét'
    : 'Bài viết của bạn chứa ảnh bị từ chối sau khi quản trị viên xem xét';
}

const imageReviewTypeName = (contentType) => contentType === 'comment' ? 'Bình luận' : 'Bài viết';

export function getModerationNoticeText(contentType = 'post', status = '') {
  const type = imageReviewTypeName(contentType);
  if (status === 'rejected_admin') {
    return `${type} của bạn vi phạm tiêu chuẩn cộng đồng nên chúng tôi không cho phép hiển thị trên bảng feed.`;
  }
  if (status === 'appeal_pending') return 'Khiếu nại của bạn đang được xem xét';
  if (status === 'pending_review') return 'Đang chờ quản trị viên duyệt';
  if (status === 'rejected_hold') return moderationRejectionNotification(contentType);
  return '';
}

export function imageReviewNotification(contentType = 'post', stage = 'first', decision = 'safe') {
  const type = imageReviewTypeName(contentType);
  const lowerType = contentType === 'comment' ? 'bình luận' : 'bài viết';
  if (stage === 'first') {
    if (decision === 'safe') return `${type} của bạn đã được duyệt`;
    if (decision === 'nsfw') return `${type} của bạn đã được duyệt và được đánh dấu là nội dung nhạy cảm`;
    return getModerationNoticeText(contentType, 'rejected_admin');
  }
  if (decision === 'safe') return `Khiếu nại của bạn đã được chấp nhận. ${type} đã được đăng bình thường.`;
  if (decision === 'nsfw') return `Khiếu nại của bạn đã được chấp nhận. ${type} đã được đăng với cảnh báo nội dung nhạy cảm.`;
  return `Sau khi xem xét lại, ${lowerType} của bạn vẫn vi phạm tiêu chuẩn cộng đồng. Quyết định này là cuối cùng và ${lowerType} đã bị ẩn hoàn toàn.`;
}

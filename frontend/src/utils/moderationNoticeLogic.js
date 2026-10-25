export function moderationViolationNotice(contentType = 'post') {
  return contentType === 'comment'
    ? 'Bình luận của bạn vi phạm quy định cộng đồng'
    : 'Bài viết của bạn vi phạm quy định cộng đồng';
}

export function getModerationNoticeText(contentType = 'post', status = '') {
  const typeName = contentType === 'comment' ? 'Bình luận' : 'Bài viết';
  if (status === 'rejected_admin') {
    return `${typeName} của bạn vi phạm tiêu chuẩn cộng đồng nên chúng tôi không cho phép hiển thị trên bảng feed.`;
  }
  if (status === 'appeal_pending') return 'Khiếu nại của bạn đang được xem xét';
  if (status === 'pending_review') return 'Đang chờ quản trị viên duyệt';
  if (status === 'rejected_hold') return moderationViolationNotice(contentType);
  return '';
}

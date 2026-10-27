const moderationTypeName = (contentType) => contentType === 'comment' ? 'Bình luận' : 'Bài viết';

export function moderationViolationNotice(contentType = 'post') {
  return `${moderationTypeName(contentType)} của bạn đã vi phạm tiêu chuẩn cộng đồng.`;
}

export function moderationRejectionNotification(contentType = 'post') {
  return moderationViolationNotice(contentType);
}

export function getModerationNoticeText(contentType = 'post', status = '') {
  if (status === 'rejected_admin' || status === 'rejected_hold') {
    return moderationViolationNotice(contentType);
  }
  if (status === 'appeal_pending') return 'Khiếu nại của bạn đang được xem xét.';
  if (status === 'pending_review') return 'Đang chờ quản trị viên duyệt.';
  if (status === 'sensitive') {
    return contentType === 'comment'
      ? 'Bình luận của bạn được gắn nhãn nhạy cảm nên những người dùng khác sẽ thấy nội dung này bị che mờ.'
      : 'Ảnh trong bài viết của bạn được gắn nhãn nhạy cảm nên những người dùng khác sẽ thấy ảnh này bị che mờ.';
  }
  return '';
}

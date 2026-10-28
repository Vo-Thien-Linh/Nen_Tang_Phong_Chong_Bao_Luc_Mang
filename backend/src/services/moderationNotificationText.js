import {
  getModerationNoticeText,
  moderationRejectionNotification,
} from '../../../shared/moderationNoticeText.js';

export { getModerationNoticeText, moderationRejectionNotification };

const imageReviewTypeName = (contentType) => contentType === 'comment' ? 'Bình luận' : 'Bài viết';

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
  return `Sau khi xem xét lại, ${lowerType} của bạn vẫn vi phạm tiêu chuẩn cộng đồng nên đã bị xóa.`;
}

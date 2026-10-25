export function moderationRejectionNotification(contentType = 'post') {
  return contentType === 'comment'
    ? 'Bình luận của bạn chứa ảnh bị từ chối sau khi quản trị viên xem xét'
    : 'Bài viết của bạn chứa ảnh bị từ chối sau khi quản trị viên xem xét';
}

const imageReviewTypeName = (contentType) => contentType === 'comment' ? 'BÃ¬nh luáº­n' : 'BÃ i viáº¿t';

export function getModerationNoticeText(contentType = 'post', status = '') {
  const type = imageReviewTypeName(contentType);
  if (status === 'rejected_admin') {
    return `${type} cá»§a báº¡n vi pháº¡m tiÃªu chuáº©n cá»™ng Ä‘á»“ng nÃªn chÃºng tÃ´i khÃ´ng cho phÃ©p hiá»ƒn thá»‹ trÃªn báº£ng feed.`;
  }
  if (status === 'appeal_pending') return 'Khiáº¿u náº¡i cá»§a báº¡n Ä‘ang Ä‘Æ°á»£c xem xÃ©t';
  if (status === 'pending_review') return 'Äang chá» quáº£n trá»‹ viÃªn duyá»‡t';
  if (status === 'rejected_hold') return moderationRejectionNotification(contentType);
  return '';
}

export function imageReviewNotification(contentType = 'post', stage = 'first', decision = 'safe') {
  const type = imageReviewTypeName(contentType);
  const lowerType = contentType === 'comment' ? 'bÃ¬nh luáº­n' : 'bÃ i viáº¿t';
  if (stage === 'first') {
    if (decision === 'safe') return `${type} cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t`;
    if (decision === 'nsfw') return `${type} cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t vÃ  Ä‘Æ°á»£c Ä‘Ã¡nh dáº¥u lÃ  ná»™i dung nháº¡y cáº£m`;
    return getModerationNoticeText(contentType, 'rejected_admin');
  }
  if (decision === 'safe') return `Khiáº¿u náº¡i cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c cháº¥p nháº­n. ${type} Ä‘Ã£ Ä‘Æ°á»£c Ä‘Äƒng bÃ¬nh thÆ°á»ng.`;
  if (decision === 'nsfw') return `Khiáº¿u náº¡i cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c cháº¥p nháº­n. ${type} Ä‘Ã£ Ä‘Æ°á»£c Ä‘Äƒng vá»›i cáº£nh bÃ¡o ná»™i dung nháº¡y cáº£m.`;
  return `Sau khi xem xÃ©t láº¡i, ${lowerType} cá»§a báº¡n váº«n vi pháº¡m tiÃªu chuáº©n cá»™ng Ä‘á»“ng. Quyáº¿t Ä‘á»‹nh nÃ y lÃ  cuá»‘i cÃ¹ng vÃ  ${lowerType} Ä‘Ã£ bá»‹ áº©n hoÃ n toÃ n.`;
}

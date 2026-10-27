import { getModerationNoticeText } from './moderationNotificationText.js';

const REVIEW_ONLY_STATUSES = new Set(['pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending', 'rejected_final']);
const AUTHOR_REVIEW_STATUSES = new Set(['pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending']);

export function formatImageModerationForViewer(imageModeration, contentType, authorId, viewerId) {
  if (!imageModeration?.status) return null;

  const status = imageModeration.status;
  const isAuthor = authorId != null && viewerId != null && String(authorId) === String(viewerId);
  const authorCanSeeReview = isAuthor && AUTHOR_REVIEW_STATUSES.has(status);
  if (REVIEW_ONLY_STATUSES.has(status) && !authorCanSeeReview) return null;
  if (!['safe', 'sensitive'].includes(status) && !authorCanSeeReview) return null;

  const {
    noticeText: _noticeText,
    noticeType: _noticeType,
    canAppeal: _canAppeal,
    appealedAt: _appealedAt,
    ...publicFields
  } = imageModeration;
  const appealedAt = imageModeration.appealedAt
    ?? imageModeration.image_moderation_appealed_at
    ?? null;

  if (!authorCanSeeReview) {
    if (isAuthor && status === 'sensitive') {
      return {
        ...publicFields,
        status,
        noticeType: 'sensitive_author',
        noticeText: getModerationNoticeText(contentType, status),
      };
    }
    return { ...publicFields, status };
  }

  return {
    ...publicFields,
    status,
    noticeText: getModerationNoticeText(contentType, status),
    noticeType: status,
    canAppeal: ['rejected_admin', 'rejected_hold'].includes(status),
    appealedAt: appealedAt || null,
  };
}

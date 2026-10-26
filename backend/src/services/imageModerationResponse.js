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
    remainingSeconds: _remainingSeconds,
    ...publicFields
  } = imageModeration;
  const moderationExpiresAt = imageModeration.moderationExpiresAt
    ?? imageModeration.moderation_expires_at
    ?? null;
  const appealedAt = imageModeration.appealedAt
    ?? imageModeration.image_moderation_appealed_at
    ?? null;

  if (!authorCanSeeReview) {
    return { ...publicFields, status, moderationExpiresAt };
  }

  const expiryTime = moderationExpiresAt ? new Date(moderationExpiresAt).getTime() : Number.NaN;
  return {
    ...publicFields,
    status,
    moderationExpiresAt,
    remainingSeconds: Number.isFinite(expiryTime)
      ? Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000))
      : null,
    noticeText: getModerationNoticeText(contentType, status),
    noticeType: status,
    canAppeal: ['rejected_admin', 'rejected_hold'].includes(status)
      && (status !== 'rejected_hold' || (Number.isFinite(expiryTime) && expiryTime > Date.now())),
    appealedAt: appealedAt || null,
  };
}

import { getModerationNoticeText } from './moderationNoticeLogic.js';

export function getImageReviewNotice(status, contentType = 'post', canAppeal = false) {
  return {
    visible: ['rejected_admin', 'appeal_pending', 'pending_review', 'rejected_hold'].includes(status),
    text: getModerationNoticeText(contentType, status),
    showAppealButton: status === 'rejected_admin' || (status === 'rejected_hold' && canAppeal),
    removeFromFeed: status === 'rejected_final',
  };
}

export function canSubmitImageAppeal(status, isSubmitting = false) {
  return !isSubmitting && ['rejected_admin', 'rejected_hold'].includes(status);
}

export function applyImageReviewQueueResult(items, item, { succeeded = false, status = 0 } = {}) {
  if (!succeeded && status !== 409) return items;
  return items.filter((entry) => !(entry.type === item.type && String(entry.id) === String(item.id)));
}

export function areImageReviewActionsDisabled(pendingKey) {
  return pendingKey != null;
}

export function getPreviousImageDecisionLabel(item) {
  return item?.previousDecision?.label || null;
}

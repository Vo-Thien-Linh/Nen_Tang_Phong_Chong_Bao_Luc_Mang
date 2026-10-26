import { getModerationNoticeText } from './moderationNoticeLogic.js';

export function getImageReviewNotice(status, contentType = 'post', canAppeal = false) {
  return {
    visible: ['rejected_admin', 'appeal_pending', 'pending_review', 'rejected_hold'].includes(status),
    text: getModerationNoticeText(contentType, status),
    showAppealButton: status === 'rejected_admin' || (status === 'rejected_hold' && canAppeal),
    removeFromFeed: status === 'rejected_final',
  };
}

export function shouldShowPostAiLabel(post) {
  return Boolean(post?.aiStatus)
    && !['pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending'].includes(post.imageModeration?.status);
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

export function getImageReviewFailure(error) {
  return {
    removeItem: error?.status === 409,
    pendingKey: null,
    toast: { type: 'error', message: error?.message || 'Không thể cập nhật quyết định.' },
  };
}

const PUBLISHED_STATUSES = new Set(['safe', 'sensitive']);

function decisionStatus(decision, rejectedStatus) {
  if (decision === 'safe') return 'safe';
  if (decision === 'nsfw') return 'sensitive';
  if (decision === 'violence') return rejectedStatus;
  return null;
}

export function transitionImageModeration({ status, action, decision, appealedAt = null, expiresAt = null, now = new Date() }) {
  if (action === 'first_review') {
    if (status !== 'pending_review') return { ok: false, statusCode: 409, reason: 'handled' };
    const nextStatus = decisionStatus(decision, 'rejected_admin');
    if (!nextStatus) return { ok: false, statusCode: 400, reason: 'invalid_decision' };
    return {
      ok: true,
      stage: 'first',
      previousStatus: status,
      nextStatus,
      visibleToOthers: PUBLISHED_STATUSES.has(nextStatus),
      notifyAuthor: true,
      allowAppeal: nextStatus === 'rejected_admin',
    };
  }

  if (action === 'appeal') {
    if (appealedAt) return { ok: false, statusCode: 409, reason: 'already_appealed' };
    if (status === 'rejected_hold' && (!expiresAt || new Date(expiresAt) <= new Date(now))) {
      return { ok: false, statusCode: 410, reason: 'expired' };
    }
    if (!['rejected_admin', 'rejected_hold'].includes(status)) {
      return { ok: false, statusCode: 409, reason: 'not_appealable' };
    }
    return {
      ok: true,
      stage: 'appeal',
      previousStatus: status,
      nextStatus: 'appeal_pending',
      visibleToOthers: false,
      notifyAuthor: false,
      allowAppeal: false,
    };
  }

  if (action === 'final_review') {
    if (status !== 'appeal_pending') return { ok: false, statusCode: 409, reason: 'handled' };
    const nextStatus = decisionStatus(decision, 'rejected_final');
    if (!nextStatus) return { ok: false, statusCode: 400, reason: 'invalid_decision' };
    return {
      ok: true,
      stage: 'final',
      previousStatus: status,
      nextStatus,
      visibleToOthers: PUBLISHED_STATUSES.has(nextStatus),
      notifyAuthor: true,
      allowAppeal: false,
    };
  }

  return { ok: false, statusCode: 400, reason: 'invalid_action' };
}

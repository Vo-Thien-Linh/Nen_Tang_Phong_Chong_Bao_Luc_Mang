const publishedImagePredicate = `(p.image_moderation_status IS NULL OR p.image_moderation_status IN ('safe', 'sensitive'))`;
const authorReviewPredicate = `(p.author_id = $VIEWER AND p.image_moderation_status IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending'))`;

export const POST_PRIVACY_VALUES = Object.freeze(['public', 'friends', 'only_me']);

export function normalizePostPrivacy(value) {
  if (value === 'private') return 'only_me';
  return POST_PRIVACY_VALUES.includes(value) ? value : 'public';
}

export function canViewerSeePost({
  viewerId,
  authorId,
  privacy,
  friendshipStatus = null,
  blocked = false,
  aiStatus = 'approved',
  imageModerationStatus = null,
}) {
  const isAuthor = viewerId != null && authorId != null && String(viewerId) === String(authorId);
  if (imageModerationStatus === 'rejected_final') return false;

  const moderationVisible = aiStatus === 'approved'
    || (isAuthor && ['pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending'].includes(imageModerationStatus));
  if (!moderationVisible) return false;
  if (isAuthor) return true;
  if (blocked) return false;

  const normalizedPrivacy = normalizePostPrivacy(privacy);
  if (normalizedPrivacy === 'public') return true;
  return normalizedPrivacy === 'friends' && friendshipStatus === 'accepted';
}

export function buildPostVisibilityPredicate(viewerParam = null, { publicOnly = false, tableAlias = 'p' } = {}) {
  const column = (name) => `${tableAlias}.${name}`;
  const publishedImage = `(${column('image_moderation_status')} IS NULL OR ${column('image_moderation_status')} IN ('safe', 'sensitive'))`;
  const authorReview = viewerParam
    ? `(${column('author_id')} = ${viewerParam} AND ${column('image_moderation_status')} IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending'))`
    : null;
  const aiPredicate = viewerParam
    ? `(${column('ai_status')} = 'approved' OR ${column('author_id')} = ${viewerParam})`
    : `${column('ai_status')} = 'approved'`;
  const imagePredicate = viewerParam
    ? `(${publishedImage} OR ${authorReview})`
    : publishedImage;
  if (publicOnly) return `(${aiPredicate}) AND ${imagePredicate} AND COALESCE(${column('privacy')}, 'public') = 'public'`;
  if (!viewerParam) return `(${aiPredicate}) AND ${imagePredicate} AND COALESCE(${column('privacy')}, 'public') = 'public'`;

  const friendshipPredicate = `EXISTS (
    SELECT 1 FROM friendships f
    WHERE f."status" = 'accepted'
      AND ((f."requester_id" = ${column('author_id')} AND f."addressee_id" = ${viewerParam})
        OR (f."addressee_id" = ${column('author_id')} AND f."requester_id" = ${viewerParam}))
  )`;
  const privacyPredicate = `(
    ${column('author_id')} = ${viewerParam}
    OR COALESCE(${column('privacy')}, 'public') = 'public'
    OR (COALESCE(${column('privacy')}, 'public') = 'friends' AND ${friendshipPredicate})
  )`;
  const blockedPredicate = `NOT EXISTS (
    SELECT 1 FROM friendships blocked_f
    WHERE blocked_f."status" = 'blocked'
      AND ((blocked_f."requester_id" = ${column('author_id')} AND blocked_f."addressee_id" = ${viewerParam})
        OR (blocked_f."addressee_id" = ${column('author_id')} AND blocked_f."requester_id" = ${viewerParam}))
  )`;
  return `(${aiPredicate}) AND ${imagePredicate} AND (${column('author_id')} = ${viewerParam} OR (${blockedPredicate} AND ${privacyPredicate}))`;
}

export const publishedPostPredicate = `p.ai_status = 'approved' AND ${publishedImagePredicate}`;

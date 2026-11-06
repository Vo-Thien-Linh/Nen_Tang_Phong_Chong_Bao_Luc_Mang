const publishedImagePredicate = `(p.image_moderation_status IS NULL OR p.image_moderation_status IN ('safe', 'sensitive'))`;
const authorReviewPredicate = `(p.author_id = $VIEWER AND p.image_moderation_status IN ('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending'))`;

export function buildPostVisibilityPredicate(viewerParam = null, { publicOnly = false } = {}) {
  const aiPredicate = viewerParam ? `(p.ai_status = 'approved' OR p.author_id = ${viewerParam})` : `p.ai_status = 'approved'`;
  const imagePredicate = viewerParam
    ? `(${publishedImagePredicate} OR ${authorReviewPredicate.replace('$VIEWER', viewerParam)})`
    : publishedImagePredicate;
  const privacyPredicate = publicOnly
    ? (viewerParam ? `(p.privacy = 'public' OR p.author_id = ${viewerParam})` : `p.privacy = 'public'`)
    : null;
  return `(${aiPredicate}) AND ${imagePredicate}${privacyPredicate ? ` AND ${privacyPredicate}` : ''}`;
}

export const publishedPostPredicate = `p.ai_status = 'approved' AND ${publishedImagePredicate}`;

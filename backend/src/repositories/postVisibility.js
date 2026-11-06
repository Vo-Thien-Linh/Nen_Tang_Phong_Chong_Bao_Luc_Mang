const publishedPostPredicate = `p.ai_status = 'approved'
  AND (p.image_moderation_status IS NULL OR p.image_moderation_status IN ('safe', 'sensitive'))`;

export function buildPostVisibilityPredicate(viewerParam = null, { publicOnly = false } = {}) {
  const published = publicOnly ? `(${publishedPostPredicate} AND p.privacy = 'public')` : publishedPostPredicate;
  if (!viewerParam) return published;
  return `(${published} OR p.author_id = ${viewerParam})`;
}

export { publishedPostPredicate };

export function getPostEngagementScore(post) {
  if (!post) return 0;
  const reactions = Number(
    post.totalReactions ??
    post.likesCount ??
    (post.reactionCounts
      ? Object.values(post.reactionCounts).reduce((a, b) => a + Number(b || 0), 0)
      : 0)
  ) || 0;
  const comments = (Array.isArray(post.comments) ? post.comments.length : Number(post.commentsCount || 0)) || 0;
  const shares = Number(post.sharesCount || 0);
  return (reactions * 1.5) + (comments * 3) + (shares * 4);
}

/**
 * Snapshot initial hot post IDs per feed refresh so live comments/replies/reactions
 * never yank a post out of the user's current scroll position on Home.
 */
export function selectHotPostIdsSnapshot(postsList = [], threshold = 6) {
  const hotIds = new Set();
  for (const p of postsList) {
    if (p && !p.inlineNotice && getPostEngagementScore(p) >= threshold) {
      hotIds.add(String(p.id));
    }
  }
  return hotIds;
}

export function rankAndInterleaveFeed(postsList = [], seed = 0, frozenHotIds = null) {
  if (!Array.isArray(postsList) || postsList.length <= 2) return postsList;

  const useFrozen = frozenHotIds instanceof Set;
  const hotIds = useFrozen ? frozenHotIds : selectHotPostIdsSnapshot(postsList);

  const scored = postsList.map((p) => ({
    ...p,
    _score: getPostEngagementScore(p),
  }));

  const hotPosts = scored
    .filter((p) => hotIds.has(String(p.id)) && !p.inlineNotice)
    .sort((a, b) => b._score - a._score);

  if (hotPosts.length === 0) return postsList;

  const actualHotIds = new Set(hotPosts.map((p) => String(p.id)));
  const regularPosts = scored.filter((p) => !actualHotIds.has(String(p.id)));

  const hotOffset = seed % Math.max(1, hotPosts.length);
  const rotatedHotPosts = [
    ...hotPosts.slice(hotOffset),
    ...hotPosts.slice(0, hotOffset),
  ];

  const result = [];
  const seenIds = new Set();
  let rIdx = 0;
  let hIdx = 0;

  const startWithHot = (seed % 2 === 1) && rotatedHotPosts.length > 0;
  if (startWithHot) {
    const firstHot = { ...rotatedHotPosts[hIdx++], isHotPost: true };
    seenIds.add(String(firstHot.id));
    result.push(firstHot);
  }

  while (rIdx < regularPosts.length || hIdx < rotatedHotPosts.length) {
    if (rIdx < regularPosts.length) {
      const reg = regularPosts[rIdx++];
      if (!seenIds.has(String(reg.id))) {
        seenIds.add(String(reg.id));
        result.push(reg);
      }
    }
    if (hIdx < rotatedHotPosts.length) {
      const hot = { ...rotatedHotPosts[hIdx++], isHotPost: true };
      if (!seenIds.has(String(hot.id))) {
        seenIds.add(String(hot.id));
        result.push(hot);
      }
    }
    if (rIdx < regularPosts.length && hIdx % 2 === 0) {
      const reg2 = regularPosts[rIdx++];
      if (!seenIds.has(String(reg2.id))) {
        seenIds.add(String(reg2.id));
        result.push(reg2);
      }
    }
  }

  return result;
}


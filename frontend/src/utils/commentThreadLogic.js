export function isCommentSoftHidden(comment) {
  if (!comment) return false;
  const imgStatus = comment.imageModeration?.status || comment.image_moderation_status;
  return Boolean(
    comment.is_soft_hidden ||
    comment.isSoftHidden ||
    comment.ai_label === 'Toxic' ||
    comment.aiLabel === 'Toxic' ||
    comment.image_label === 'NSFW' ||
    comment.imageLabel === 'NSFW' ||
    imgStatus === 'sensitive'
  );
}

export function getCommentSortTimestamp(comment) {
  if (!comment) return 0;
  const rawDate = comment.createdAt || comment.created_at;
  if (rawDate) {
    const parsed = Date.parse(rawDate);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const timeStr = String(comment.time || '');
  if (timeStr === 'Vừa xong' || timeStr === 'Just now') {
    const idStr = String(comment.id || '');
    if (idStr.startsWith('cmt-')) {
      const ts = Number(idStr.slice(4));
      if (Number.isFinite(ts)) return ts;
    }
    return Date.now();
  }
  const numId = Number(comment.id);
  return Number.isFinite(numId) ? numId : 0;
}

export function compareCommentsNewestFirst(a, b) {
  const aSoft = isCommentSoftHidden(a);
  const bSoft = isCommentSoftHidden(b);
  if (aSoft !== bSoft) return aSoft ? 1 : -1;

  const aTime = getCommentSortTimestamp(a);
  const bTime = getCommentSortTimestamp(b);
  if (bTime !== aTime) return bTime - aTime;

  const aId = Number(a?.id);
  const bId = Number(b?.id);
  if (Number.isFinite(aId) && Number.isFinite(bId) && bId !== aId) {
    return bId - aId;
  }
  return 0;
}

/**
 * Build a multi-level comment tree sorted newest-first at every level.
 * Orphan comments whose parent is missing/filtered are safely promoted to root.
 */
export function buildCommentTree(comments = []) {
  if (!Array.isArray(comments) || comments.length === 0) return [];

  const uniqueMap = new Map();
  for (const comment of comments) {
    if (!comment || comment.id == null) continue;
    const key = String(comment.id);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, { ...comment, replies: [] });
    }
  }

  const roots = [];
  for (const node of uniqueMap.values()) {
    const rawParentId = node.parentId ?? node.parent_id ?? null;
    const parentKey = rawParentId !== null && rawParentId !== undefined && String(rawParentId).trim() !== ''
      ? String(rawParentId)
      : null;

    if (parentKey && parentKey !== String(node.id) && uniqueMap.has(parentKey)) {
      uniqueMap.get(parentKey).replies.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTreeRecursive = (nodes, visited = new Set()) => {
    nodes.sort(compareCommentsNewestFirst);
    for (const node of nodes) {
      const idKey = String(node.id);
      if (visited.has(idKey)) {
        node.replies = [];
        continue;
      }
      visited.add(idKey);
      if (node.replies.length > 0) {
        sortTreeRecursive(node.replies, new Set(visited));
      }
    }
  };

  sortTreeRecursive(roots);
  return roots;
}


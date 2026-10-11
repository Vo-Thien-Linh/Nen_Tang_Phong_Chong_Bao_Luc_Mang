export const REACTIONS = [
  { id: 'like', label: 'Thích', emoji: '👍', color: 'text-blue-600' },
  { id: 'love', label: 'Yêu thích', emoji: '❤️', color: 'text-rose-600' },
  { id: 'haha', label: 'Haha', emoji: '😄', color: 'text-yellow-500' },
  { id: 'wow', label: 'Wow', emoji: '😮', color: 'text-amber-500' },
  { id: 'sad', label: 'Buồn', emoji: '😢', color: 'text-amber-600' },
  { id: 'angry', label: 'Phẫn nộ', emoji: '😡', color: 'text-orange-600' },
];

const REACTION_ORDER = REACTIONS.map((reaction) => reaction.id);

export function normalizeReactionCounts(counts = {}) {
  return REACTIONS.reduce((normalized, reaction) => {
    normalized[reaction.id] = Number(counts[reaction.id] || 0);
    return normalized;
  }, {});
}

export function getGivenReactionCounts(counts = {}) {
  const normalized = normalizeReactionCounts(counts);

  return REACTIONS
    .map((reaction) => ({
      ...reaction,
      count: normalized[reaction.id],
    }))
    .filter((reaction) => reaction.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return REACTION_ORDER.indexOf(a.id) - REACTION_ORDER.indexOf(b.id);
    });
}

export function getSummaryReactions(counts = {}, limit = 3) {
  return getGivenReactionCounts(counts).slice(0, limit);
}

export function hasReactionCounts(counts = {}) {
  return getGivenReactionCounts(counts).length > 0;
}

export function applyReactionCounts({ counts = {}, previousReaction, nextReaction }) {
  const nextCounts = normalizeReactionCounts(counts);

  if (previousReaction && nextCounts[previousReaction] !== undefined) {
    nextCounts[previousReaction] = Math.max(0, nextCounts[previousReaction] - 1);
  }

  if (nextReaction && nextCounts[nextReaction] !== undefined) {
    nextCounts[nextReaction] += 1;
  }

  return nextCounts;
}

export function applyReactionState({ currentReaction, totalCount, selectedReaction = 'like' }) {
  if (currentReaction === selectedReaction) {
    return {
      action: 'removed',
      myReaction: null,
      totalCount: Math.max(0, totalCount - 1),
    };
  }

  return {
    action: currentReaction ? 'updated' : 'created',
    myReaction: selectedReaction,
    totalCount: currentReaction ? totalCount : totalCount + 1,
  };
}

export function rollbackReactionState({ previousReaction, previousCount, error }) {
  return {
    myReaction: previousReaction,
    totalCount: previousCount,
    errorMessage: error?.message === 'Bài viết không tồn tại' ? error.message : 'Thả icon thất bại',
  };
}

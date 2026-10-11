export const REACTIONS = [
  { id: 'like', label: 'Thích', emoji: '👍', color: 'text-blue-600' },
  { id: 'love', label: 'Yêu thích', emoji: '❤️', color: 'text-rose-600' },
  { id: 'haha', label: 'Haha', emoji: '😄', color: 'text-yellow-500' },
  { id: 'wow', label: 'Wow', emoji: '😮', color: 'text-amber-500' },
  { id: 'sad', label: 'Buồn', emoji: '😢', color: 'text-amber-600' },
  { id: 'angry', label: 'Phẫn nộ', emoji: '😡', color: 'text-orange-600' },
];

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

export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

export function normalizeReactionType(type) {
  return type || 'like';
}

export function isValidReactionType(type) {
  return REACTION_TYPES.includes(type);
}

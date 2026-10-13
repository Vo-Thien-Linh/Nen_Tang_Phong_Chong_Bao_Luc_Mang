export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

export function normalizeReactionType(type) {
  if (!type) return null;
  return String(type).trim().toLowerCase();
}

export function isValidReactionType(type) {
  return REACTION_TYPES.includes(type);
}


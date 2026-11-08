import { splitHashtagText } from './hashtag.js';

export const HASHTAG_HIGHLIGHT_CLASS = 'font-bold text-blue-600 dark:text-blue-400';

export function getHashtagHighlightParts(text) {
  return splitHashtagText(text).map((part) => (
    part.type === 'hashtag' ? { ...part, className: HASHTAG_HIGHLIGHT_CLASS } : part
  ));
}

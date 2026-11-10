import { normalizeHashtag } from './hashtag.js';

export function parseHashtagHash(value) {
  const raw = String(value || '').replace(/^#/, '');
  if (!raw.startsWith('hashtag/')) return null;
  try {
    return normalizeHashtag(decodeURIComponent(raw.slice('hashtag/'.length)));
  } catch {
    return null;
  }
}

export function buildHashtagHash(tag) {
  const normalized = normalizeHashtag(tag);
  return normalized ? `#hashtag/${encodeURIComponent(normalized)}` : null;
}

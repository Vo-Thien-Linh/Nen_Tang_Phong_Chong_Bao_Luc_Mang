const HASHTAG_PATTERN = /(^|[\s\p{Ps}\p{Pi}])#([\p{L}\p{N}_]{1,50})(?![\p{L}\p{N}_])/gu;

export function normalizeHashtag(value) {
  const raw = String(value || '').replace(/^#/, '').normalize('NFC');
  if (!/^[\p{L}\p{N}_]{1,50}$/u.test(raw) || !/\p{L}/u.test(raw)) return null;
  return raw.toLocaleLowerCase().normalize('NFC');
}

export function extractHashtags(text, max = 10) {
  const source = String(text || '').normalize('NFC');
  const found = [];
  const seen = new Set();

  for (const match of source.matchAll(HASHTAG_PATTERN)) {
    const displayTag = match[2];
    const tag = normalizeHashtag(displayTag);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    found.push({ tag, displayTag });
    if (found.length >= max) break;
  }

  return found;
}

export function splitHashtagText(text) {
  const source = String(text || '').normalize('NFC');
  const parts = [];
  let cursor = 0;
  let match;
  const pattern = new RegExp(HASHTAG_PATTERN.source, HASHTAG_PATTERN.flags);

  while ((match = pattern.exec(source))) {
    const start = match.index + match[1].length;
    if (start > cursor) parts.push({ type: 'text', value: source.slice(cursor, start) });
    const displayTag = match[2];
    const tag = normalizeHashtag(displayTag);
    if (!tag) {
      parts.push({ type: 'text', value: source.slice(start, pattern.lastIndex) });
    } else {
      parts.push({ type: 'hashtag', value: `#${displayTag}`, tag, displayTag });
    }
    cursor = pattern.lastIndex;
  }

  if (cursor < source.length) parts.push({ type: 'text', value: source.slice(cursor) });
  return parts.length ? parts : [{ type: 'text', value: source }];
}

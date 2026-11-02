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

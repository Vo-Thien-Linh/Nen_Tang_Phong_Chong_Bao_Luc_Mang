import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getHashtagHighlightParts, HASHTAG_HIGHLIGHT_CLASS } from '../src/utils/hashtagHighlight.js';
import { buildHashtagHash } from '../src/utils/hashtagRouteLogic.js';

const composerSource = readFileSync(new URL('../src/components/CreatePostCard.jsx', import.meta.url), 'utf8');
const linkSource = readFileSync(new URL('../src/components/HashtagText.jsx', import.meta.url), 'utf8');

test('hashtag parts receive bold blue styling while normal text stays plain', () => {
  const parts = getHashtagHighlightParts('Normal #LinhvaBien text');
  assert.equal(parts[0].className, undefined);
  assert.equal(parts[1].className, HASHTAG_HIGHLIGHT_CLASS);
  assert.match(HASHTAG_HIGHLIGHT_CLASS, /font-bold/);
  assert.match(HASHTAG_HIGHLIGHT_CLASS, /text-blue-600/);
});

test('composer highlights multiple Vietnamese hashtags and preserves newlines', () => {
  const text = 'Trời xanh #SinhViên\nHôm nay #BTLProject';
  const parts = getHashtagHighlightParts(text);
  assert.deepEqual(parts.filter((part) => part.type === 'hashtag').map((part) => part.tag), ['sinhviên', 'btlproject']);
  assert.equal(parts.map((part) => part.value).join(''), text);
});

test('textarea remains the source of truth for cursor, selection, copy, and paste', () => {
  assert.match(composerSource, /value=\{content\}/);
  assert.match(composerSource, /onChange=\{\(e\) =>/);
  assert.match(composerSource, /content: content\.trim\(\)/);
  assert.match(composerSource, /onScroll=\{syncHashtagHighlightScroll\}/);
});

test('published hashtag links use the existing hashtag route and dark-mode styling', () => {
  assert.equal(buildHashtagHash('LinhvaBien'), '#hashtag/linhvabien');
  assert.match(linkSource, /#hashtag\/\$\{encodeURIComponent\(part\.tag\)\}/);
  assert.match(linkSource, /hover:text-blue-700/);
  assert.match(HASHTAG_HIGHLIGHT_CLASS, /dark:text-blue-400/);
});

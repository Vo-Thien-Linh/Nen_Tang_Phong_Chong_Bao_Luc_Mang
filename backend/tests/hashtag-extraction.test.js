import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHashtags, normalizeHashtag } from '../../shared/hashtag.js';

test('extract simple hashtags from text', () => {
  assert.deepEqual(extractHashtags('Hôm nay #BTLProject xong rồi #Wings'), [
    { tag: 'btlproject', displayTag: 'BTLProject' },
    { tag: 'wings', displayTag: 'Wings' },
  ]);
});

test('extract vietnamese hashtags with diacritics', () => {
  assert.deepEqual(extractHashtags('#SinhViênKhoaHọc #ĐờiSống'), [
    { tag: 'sinhviênkhoahọc', displayTag: 'SinhViênKhoaHọc' },
    { tag: 'đờisống', displayTag: 'ĐờiSống' },
  ]);
});

test('normalize hashtags to lower case NFC', () => {
  const decomposed = `#Caf${'e\u0301'}`;
  assert.equal(normalizeHashtag(decomposed), 'café');
  assert.equal(normalizeHashtag('#WINGS'), 'wings');
});

test('ignore hashtag inside a word or url', () => {
  assert.deepEqual(extractHashtags('abc#def http://x.com/#top #real'), [
    { tag: 'real', displayTag: 'real' },
  ]);
});

test('ignore numeric only hashtags', () => {
  assert.deepEqual(extractHashtags('#123 #2026abc #abc123'), [
    { tag: '2026abc', displayTag: '2026abc' },
    { tag: 'abc123', displayTag: 'abc123' },
  ]);
});

test('deduplicate repeated hashtags', () => {
  assert.deepEqual(extractHashtags('#Topic #topic #TOPIC'), [
    { tag: 'topic', displayTag: 'Topic' },
  ]);
});

test('limit hashtags per post to ten', () => {
  const text = Array.from({ length: 12 }, (_, index) => `#Tag${index + 1}`).join(' ');
  assert.equal(extractHashtags(text).length, 10);
  assert.equal(extractHashtags(text).at(-1).tag, 'tag10');
});

test('stop hashtag at punctuation', () => {
  assert.deepEqual(extractHashtags('Use #One, #Two. Then #Three!'), [
    { tag: 'one', displayTag: 'One' },
    { tag: 'two', displayTag: 'Two' },
    { tag: 'three', displayTag: 'Three' },
  ]);
});

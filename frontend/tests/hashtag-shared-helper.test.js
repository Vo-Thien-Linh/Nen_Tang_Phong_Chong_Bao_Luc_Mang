import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHashtags as frontendExtract, splitHashtagText } from '../../shared/hashtag.js';
import { extractHashtags as backendExtract } from '../../shared/hashtag.js';

test('both sides extract identical hashtags', () => {
  const text = 'Việt #SinhViênKhoaHọc, #Wings #123 and #Wings.';
  assert.deepEqual(frontendExtract(text), backendExtract(text));
});

test('split hashtag text preserves plain text and hashtag tokens', () => {
  assert.deepEqual(splitHashtagText('Hello #Wings world'), [
    { type: 'text', value: 'Hello ' },
    { type: 'hashtag', value: '#Wings', tag: 'wings', displayTag: 'Wings' },
    { type: 'text', value: ' world' },
  ]);
});

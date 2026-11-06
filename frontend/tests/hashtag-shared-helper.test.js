import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHashtags as frontendExtract, splitHashtagText } from '../src/utils/hashtag.js';
import { extractHashtags as backendExtract } from '../../backend/src/utils/hashtag.js';

test('both sides extract identical hashtags', () => {
  const text = 'Việt #SinhViênKhoaHọc, #Wings #123 and #Wings.';
  assert.deepEqual(frontendExtract(text), backendExtract(text));
});

test('backend and frontend hashtag helpers stay identical on boundary cases', () => {
  const cases = [
    '#SinhViênKhoaHọc #ĐờiSống',
    '#WINGS #wings',
    'http://example.com/#top #real',
    '#123 #abc123',
    '#Topic #topic #TOPIC',
    Array.from({ length: 12 }, (_, index) => `#Tag${index + 1}`).join(' '),
    `#${'a'.repeat(50)} #${'b'.repeat(51)}`,
  ];

  for (const text of cases) {
    assert.deepEqual(frontendExtract(text), backendExtract(text), text);
  }
});

test('split hashtag text preserves plain text and hashtag tokens', () => {
  assert.deepEqual(splitHashtagText('Hello #Wings world'), [
    { type: 'text', value: 'Hello ' },
    { type: 'hashtag', value: '#Wings', tag: 'wings', displayTag: 'Wings' },
    { type: 'text', value: ' world' },
  ]);
});

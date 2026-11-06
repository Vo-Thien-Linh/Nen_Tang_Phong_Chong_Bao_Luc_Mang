import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHashtags as frontendExtract } from '../../shared/hashtag.js';
import { extractHashtags as backendExtract } from '../../shared/hashtag.js';

test('both sides extract identical hashtags', () => {
  const text = 'Việt #SinhViênKhoaHọc, #Wings #123 and #Wings.';
  assert.deepEqual(frontendExtract(text), backendExtract(text));
});

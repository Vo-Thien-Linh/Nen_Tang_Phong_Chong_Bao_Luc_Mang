import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHashtags, normalizeHashtag } from '../../shared/hashtag.js';

test('extract simple hashtags from text', () => {
  assert.deepEqual(extractHashtags('Hôm nay #BTLProject xong rồi #Wings'), [
    { tag: 'btlproject', displayTag: 'BTLProject' },
    { tag: 'wings', displayTag: 'Wings' },
  ]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getHashtagTrendingDays } from '../src/config/hashtagConfig.js';

test('use seven days by default', () => {
  assert.equal(getHashtagTrendingDays({}), 7);
});

test('fall back to default for invalid days', () => {
  for (const value of ['', '0', '-2', 'not-a-number', 'Infinity']) {
    assert.equal(getHashtagTrendingDays({ HASHTAG_TRENDING_DAYS: value }), 7);
  }
  assert.equal(getHashtagTrendingDays({ HASHTAG_TRENDING_DAYS: '14' }), 14);
});

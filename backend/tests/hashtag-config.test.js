import test from 'node:test';
import assert from 'node:assert/strict';
import { getHashtagTrendingDays } from '../src/config/hashtagConfig.js';

test('use seven days by default', () => {
  assert.equal(getHashtagTrendingDays({}), 7);
});

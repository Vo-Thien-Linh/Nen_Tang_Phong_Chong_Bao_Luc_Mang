import test from 'node:test';
import assert from 'node:assert/strict';
import { getSummaryReactions } from '../src/utils/reactionLogic.js';

test('break ties by fixed reaction order', () => {
  const result = getSummaryReactions({
    counts: {
      like: 2,
      love: 2,
      haha: 2,
      wow: 2,
      sad: 0,
      angry: 0,
    },
  });

  assert.deepEqual(result.map((reaction) => reaction.id), ['like', 'love', 'haha']);
});

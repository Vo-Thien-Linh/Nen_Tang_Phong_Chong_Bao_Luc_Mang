import test from 'node:test';
import assert from 'node:assert/strict';
import { getSummaryReactions } from '../src/utils/reactionLogic.js';

test('show top three normally when viewer reaction is already in top three', () => {
  const result = getSummaryReactions({
    counts: {
      like: 9,
      love: 6,
      haha: 4,
      wow: 2,
      sad: 1,
      angry: 0,
    },
    myReaction: 'haha',
  });

  assert.deepEqual(result.map((reaction) => reaction.id), ['like', 'love', 'haha']);
});

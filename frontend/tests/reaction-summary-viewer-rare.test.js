import test from 'node:test';
import assert from 'node:assert/strict';
import { getSummaryReactions } from '../src/utils/reactionLogic.js';

test('always include viewer reaction even when it is not in top three', () => {
  const result = getSummaryReactions({
    counts: {
      like: 10,
      love: 8,
      haha: 6,
      wow: 4,
      sad: 1,
      angry: 0,
    },
    myReaction: 'sad',
  });

  assert.equal(result.some((reaction) => reaction.id === 'sad'), true);
  assert.deepEqual(result.map((reaction) => reaction.id), ['like', 'love', 'sad']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getSummaryReactions } from '../src/utils/reactionLogic.js';

test('keep top two other reactions when viewer reacts with a rare type', () => {
  const result = getSummaryReactions({
    counts: {
      like: 5,
      love: 3,
      haha: 0,
      wow: 2,
      sad: 1,
      angry: 0,
    },
    myReaction: 'sad',
  });

  assert.deepEqual(result.map((reaction) => reaction.id), ['like', 'love', 'sad']);
});

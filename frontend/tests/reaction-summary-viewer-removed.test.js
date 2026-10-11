import test from 'node:test';
import assert from 'node:assert/strict';
import { getSummaryReactions } from '../src/utils/reactionLogic.js';

test('hide viewer reaction after the viewer removes it', () => {
  const result = getSummaryReactions({
    counts: {
      like: 5,
      love: 3,
      haha: 2,
      wow: 0,
      sad: 0,
      angry: 0,
    },
    myReaction: null,
  });

  assert.equal(result.some((reaction) => reaction.id === 'sad'), false);
  assert.deepEqual(result.map((reaction) => reaction.id), ['like', 'love', 'haha']);
});

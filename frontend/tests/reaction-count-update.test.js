import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReactionCounts } from '../src/utils/reactionLogic.js';

test('update counts immediately when user changes reaction', () => {
  const result = applyReactionCounts({
    counts: {
      like: 2,
      love: 1,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    },
    previousReaction: 'like',
    nextReaction: 'love',
  });

  assert.equal(result.like, 1);
  assert.equal(result.love, 2);
});

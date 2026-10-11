import test from 'node:test';
import assert from 'node:assert/strict';
import { getSummaryReactions, hasReactionCounts } from '../src/utils/reactionLogic.js';

test('hide summary icons when post has no reactions', () => {
  const counts = {
    like: 0,
    love: 0,
    haha: 0,
    wow: 0,
    sad: 0,
    angry: 0,
  };

  assert.deepEqual(getSummaryReactions(counts), []);
  assert.equal(hasReactionCounts(counts), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getGivenReactionCounts } from '../src/utils/reactionLogic.js';

test('show only reaction types that have been given', () => {
  const result = getGivenReactionCounts({
    like: 2,
    love: 0,
    haha: 1,
    wow: 0,
    sad: 0,
    angry: 0,
  });

  assert.deepEqual(result.map((reaction) => reaction.id), ['like', 'haha']);
});

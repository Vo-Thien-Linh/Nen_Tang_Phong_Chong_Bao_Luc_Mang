import test from 'node:test';
import assert from 'node:assert/strict';
import { getSummaryReactions } from '../src/utils/reactionLogic.js';

test('limit summary icons to top three by count', () => {
  const result = getSummaryReactions({
    like: 4,
    love: 8,
    haha: 2,
    wow: 8,
    sad: 1,
    angry: 7,
  });

  assert.deepEqual(result.map((reaction) => reaction.id), ['love', 'wow', 'angry']);
});

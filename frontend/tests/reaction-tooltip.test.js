import test from 'node:test';
import assert from 'node:assert/strict';
import { getGivenReactionCounts } from '../src/utils/reactionLogic.js';

test('list reaction counts by type for hover tooltip', () => {
  const result = getGivenReactionCounts({
    like: 1,
    love: 3,
    haha: 0,
    wow: 2,
    sad: 0,
    angry: 0,
  });

  assert.deepEqual(
    result.map(({ id, label, count }) => ({ id, label, count })),
    [
      { id: 'love', label: 'Yêu thích', count: 3 },
      { id: 'wow', label: 'Wow', count: 2 },
      { id: 'like', label: 'Thích', count: 1 },
    ]
  );
});

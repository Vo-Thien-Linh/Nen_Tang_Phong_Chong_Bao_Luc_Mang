import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReactionState } from '../src/utils/reactionLogic.js';

test('remove reaction when same icon is clicked and decrease count', () => {
  const result = applyReactionState({
    currentReaction: 'love',
    selectedReaction: 'love',
    totalCount: 8,
  });

  assert.deepEqual(result, {
    action: 'removed',
    myReaction: null,
    totalCount: 7,
  });
});

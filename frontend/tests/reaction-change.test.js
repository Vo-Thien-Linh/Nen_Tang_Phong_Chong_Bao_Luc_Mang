import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReactionState } from '../src/utils/reactionLogic.js';

test('change reaction type and keep total count unchanged', () => {
  const result = applyReactionState({
    currentReaction: 'like',
    selectedReaction: 'haha',
    totalCount: 4,
  });

  assert.deepEqual(result, {
    action: 'updated',
    myReaction: 'haha',
    totalCount: 4,
  });
});

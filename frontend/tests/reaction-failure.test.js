import test from 'node:test';
import assert from 'node:assert/strict';
import { rollbackReactionState } from '../src/utils/reactionLogic.js';

test('keep previous state and show failure message on system error', () => {
  const result = rollbackReactionState({
    previousReaction: 'sad',
    previousCount: 12,
    error: new Error('database is down'),
  });

  assert.deepEqual(result, {
    myReaction: 'sad',
    totalCount: 12,
    errorMessage: 'Thả icon thất bại',
  });
});

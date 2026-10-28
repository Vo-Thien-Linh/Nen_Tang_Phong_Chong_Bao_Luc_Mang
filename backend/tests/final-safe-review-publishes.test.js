import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionImageModeration } from '../src/services/imageModerationState.js';

test('final safe publishes the item', () => {
  const result = transitionImageModeration({ status: 'appeal_pending', action: 'final_review', decision: 'safe' });

  assert.equal(result.nextStatus, 'safe');
  assert.equal(result.visibleToOthers, true);
});

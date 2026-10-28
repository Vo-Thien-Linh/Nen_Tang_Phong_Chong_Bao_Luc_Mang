import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionImageModeration } from '../src/services/imageModerationState.js';

test('first review safe publishes the item', () => {
  const result = transitionImageModeration({ status: 'pending_review', action: 'first_review', decision: 'safe' });
  assert.equal(result.nextStatus, 'safe');
  assert.equal(result.visibleToOthers, true);
});

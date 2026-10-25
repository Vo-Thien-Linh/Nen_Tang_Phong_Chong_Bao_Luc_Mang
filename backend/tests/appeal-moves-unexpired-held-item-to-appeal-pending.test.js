import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionImageModeration } from '../src/services/imageModerationState.js';

test("appeal moves unexpired held item to appeal pending", () => {
  const result = transitionImageModeration({ status: 'rejected_hold', action: 'appeal', expiresAt: '2030-01-01T00:00:00Z', now: '2029-12-31T00:00:00Z' });
  assert.equal(result.nextStatus, 'appeal_pending'); assert.equal(result.visibleToOthers, false);
  
});


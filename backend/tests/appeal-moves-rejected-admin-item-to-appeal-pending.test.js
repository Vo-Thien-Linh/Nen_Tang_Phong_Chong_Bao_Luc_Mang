import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionImageModeration } from '../src/services/imageModerationState.js';

test("appeal moves rejected admin item to appeal pending", () => {
  const result = transitionImageModeration({ status: 'rejected_admin', action: 'appeal' });
  assert.equal(result.nextStatus, 'appeal_pending'); assert.equal(result.visibleToOthers, false);
  
});


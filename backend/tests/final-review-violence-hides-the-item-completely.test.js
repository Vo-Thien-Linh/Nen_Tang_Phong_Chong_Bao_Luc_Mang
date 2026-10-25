import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionImageModeration } from '../src/services/imageModerationState.js';

test("final review violence hides the item completely", () => {
  const result = transitionImageModeration({ status: 'appeal_pending', action: 'final_review', decision: 'violence' });
  assert.equal(result.nextStatus, 'rejected_final'); assert.equal(result.visibleToOthers, false);
  
});


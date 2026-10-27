import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionImageModeration } from '../src/services/imageModerationState.js';

test("final review nsfw publishes the item as sensitive", () => {
  const result = transitionImageModeration({ status: 'appeal_pending', action: 'final_review', decision: 'nsfw' });
  assert.equal(result.nextStatus, 'sensitive'); assert.equal(result.visibleToOthers, true);
  
});


import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionImageModeration } from '../src/services/imageModerationState.js';

test("first review nsfw publishes the item", () => {
  const result = transitionImageModeration({ status: 'pending_review', action: 'first_review', decision: 'nsfw' });
  assert.equal(result.nextStatus, 'sensitive'); assert.equal(result.visibleToOthers, true);
  
});


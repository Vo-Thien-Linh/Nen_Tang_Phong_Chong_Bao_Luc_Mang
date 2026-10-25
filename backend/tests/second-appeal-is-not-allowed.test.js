import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionImageModeration } from '../src/services/imageModerationState.js';

test("second appeal is not allowed", () => {
  const result = transitionImageModeration({ status: 'appeal_pending', action: 'appeal', appealedAt: '2029-01-01T00:00:00Z' });
  assert.equal(result.ok, false); assert.equal(result.statusCode, 409);
  
});


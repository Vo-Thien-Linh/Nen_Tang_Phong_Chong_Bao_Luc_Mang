import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionImageModeration } from '../src/services/imageModerationState.js';

test("final rejection cannot be appealed again", () => {
  const result = transitionImageModeration({ status: 'rejected_final', action: 'appeal' });
  assert.equal(result.ok, false); assert.equal(result.statusCode, 409);
  
});


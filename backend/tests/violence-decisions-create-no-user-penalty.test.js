import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionImageModeration } from '../src/services/imageModerationState.js';

test("violence decisions create no user penalty", () => {
  const result = transitionImageModeration({ status: 'pending_review', action: 'first_review', decision: 'violence' });
  assert.equal(result.nextStatus, 'rejected_admin');
  assert.equal(Object.hasOwn(result, 'penalty'), false);
});


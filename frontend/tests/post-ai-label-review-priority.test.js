import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowPostAiLabel } from '../src/utils/imageModerationReviewLogic.js';

test('moderation notice takes priority over the normal ai label', () => {
  const post = { aiStatus: { label: 'Normal' } };
  for (const status of ['pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending']) {
    assert.equal(shouldShowPostAiLabel({ ...post, imageModeration: { status } }), false);
  }
  assert.equal(shouldShowPostAiLabel({ ...post, imageModeration: { status: 'sensitive' } }), true);
  assert.equal(shouldShowPostAiLabel(post), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowPostAiLabel } from '../src/utils/imageModerationReviewLogic.js';

test('toxic label is unchanged for published posts', () => {
  const post = { aiStatus: { label: 'Toxic' }, imageModeration: null };
  assert.equal(shouldShowPostAiLabel(post), true);
  assert.equal(post.aiStatus.label, 'Toxic');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldHideContentForViewer, canSubmitImageAppeal } from '../src/utils/imageModerationReviewLogic.js';
import { getModerationNoticeText } from '../src/utils/moderationNoticeLogic.js';

test('author sees own rejected admin post without overlay but with notice', () => {
  assert.equal(shouldHideContentForViewer({ isAuthor: true, status: 'rejected_admin', isSensitive: true }), false);
  assert.match(getModerationNoticeText('post', 'rejected_admin'), /không cho phép hiển thị/i);
  assert.equal(canSubmitImageAppeal('rejected_admin'), true);
});

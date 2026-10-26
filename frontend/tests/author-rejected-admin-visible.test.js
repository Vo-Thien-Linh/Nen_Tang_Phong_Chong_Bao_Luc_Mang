import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldHideContentForViewer, canSubmitImageAppeal } from '../src/utils/imageModerationReviewLogic.js';
import { getModerationNoticeText } from '../src/utils/moderationNoticeLogic.js';

test('author sees own rejected admin post without overlay but with notice', () => {
  assert.equal(shouldHideContentForViewer({ isAuthor: true, status: 'rejected_admin', isSensitive: true }), false);
  assert.equal(getModerationNoticeText('post', 'rejected_admin'), 'Bài viết của bạn đã vi phạm tiêu chuẩn cộng đồng.');
  assert.equal(canSubmitImageAppeal('rejected_admin'), true);
});

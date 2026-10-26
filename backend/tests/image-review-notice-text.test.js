import test from 'node:test';
import assert from 'node:assert/strict';
import { getModerationNoticeText, imageReviewNotification } from '../src/services/moderationNotificationText.js';

test('rejected admin post notice uses post wording', () => {
  assert.match(getModerationNoticeText('post', 'rejected_admin'), /^Bài viết của bạn/);
});

test('rejected admin comment notice uses comment wording', () => {
  assert.match(getModerationNoticeText('comment', 'rejected_admin'), /^Bình luận của bạn/);
});

test('appeal pending notice says the appeal is under review', () => {
  assert.equal(getModerationNoticeText('post', 'appeal_pending'), 'Khiếu nại của bạn đang được xem xét.');
});

test('final violence notification confirms permanent removal using comment wording', () => {
  const message = imageReviewNotification('comment', 'final', 'violence');
  assert.match(message, /^Sau khi xem xét lại, bình luận của bạn/);
  assert.match(message, /đã bị xóa\.$/);
});

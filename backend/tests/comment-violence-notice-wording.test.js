import test from 'node:test';
import assert from 'node:assert/strict';
import { getModerationNoticeText, moderationRejectionNotification } from '../src/services/moderationNotificationText.js';

test('violence notice for a comment says the comment violated standards', () => {
  const expected = 'Bình luận của bạn đã vi phạm tiêu chuẩn cộng đồng.';
  assert.equal(getModerationNoticeText('comment', 'rejected_admin'), expected);
  assert.equal(getModerationNoticeText('comment', 'rejected_hold'), expected);
  assert.equal(moderationRejectionNotification('comment'), expected);
});

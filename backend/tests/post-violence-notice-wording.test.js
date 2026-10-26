import test from 'node:test';
import assert from 'node:assert/strict';
import { getModerationNoticeText, moderationRejectionNotification } from '../src/services/moderationNotificationText.js';

test('violence notice for a post says đã vi phạm', () => {
  const expected = 'Bài viết của bạn đã vi phạm tiêu chuẩn cộng đồng.';
  assert.equal(getModerationNoticeText('post', 'rejected_admin'), expected);
  assert.equal(getModerationNoticeText('post', 'rejected_hold'), expected);
  assert.equal(moderationRejectionNotification('post'), expected);
});

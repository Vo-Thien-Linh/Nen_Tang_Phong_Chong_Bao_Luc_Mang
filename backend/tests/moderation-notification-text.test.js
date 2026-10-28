import test from 'node:test';
import assert from 'node:assert/strict';
import { moderationRejectionNotification } from '../src/services/moderationNotificationText.js';

test('admin rejection notification names a post', () => {
  assert.equal(
    moderationRejectionNotification('post'),
    'Bài viết của bạn đã vi phạm tiêu chuẩn cộng đồng.',
  );
});

test('admin rejection notification names a comment', () => {
  assert.equal(
    moderationRejectionNotification('comment'),
    'Bình luận của bạn đã vi phạm tiêu chuẩn cộng đồng.',
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { moderationRejectionNotification } from '../src/services/moderationNotificationText.js';

test('admin rejection notification names a post', () => {
  assert.equal(
    moderationRejectionNotification('post'),
    'Bài viết của bạn chứa ảnh bị từ chối sau khi quản trị viên xem xét',
  );
});

test('admin rejection notification names a comment', () => {
  assert.equal(
    moderationRejectionNotification('comment'),
    'Bình luận của bạn chứa ảnh bị từ chối sau khi quản trị viên xem xét',
  );
});

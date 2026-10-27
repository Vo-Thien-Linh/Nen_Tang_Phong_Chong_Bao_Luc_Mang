import test from 'node:test';
import assert from 'node:assert/strict';
import { getNotificationSnapshotPreview } from '../src/utils/notificationSnapshotLogic.js';

test('notification without snapshot still renders its existing post preview', () => {
  const notification = { targetPost: { contentSnippet: 'Older notification content', image: null } };
  const preview = getNotificationSnapshotPreview(notification);

  assert.equal(preview.isRemoval, false);
  assert.equal(preview.content, '');
  assert.equal(notification.targetPost.contentSnippet, 'Older notification content');
});

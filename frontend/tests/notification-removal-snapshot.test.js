import test from 'node:test';
import assert from 'node:assert/strict';
import { getNotificationSnapshotPreview } from '../src/utils/notificationSnapshotLogic.js';

test('notification shows removed content and image from the snapshot', () => {
  const preview = getNotificationSnapshotPreview({
    snapshot: {
      type: 'moderation_removal',
      contentType: 'post',
      content: 'Removed post text',
      imageUrls: ['https://cdn.example/removed.jpg'],
      createdAt: '2026-10-20T12:00:00.000Z',
    },
  });

  assert.equal(preview.isRemoval, true);
  assert.equal(preview.content, 'Removed post text');
  assert.deepEqual(preview.images, ['https://cdn.example/removed.jpg']);
});

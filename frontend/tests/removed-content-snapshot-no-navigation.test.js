import test from 'node:test';
import assert from 'node:assert/strict';
import { getNotificationNavigationTarget } from '../src/utils/notificationSnapshotLogic.js';

test('removed content snapshot notice has no navigation', () => {
  const removedNotice = {
    targetPostId: 'post-removed',
    targetPost: { id: 'post-removed' },
    snapshot: { type: 'moderation_removal', content: 'Removed content' },
  };

  assert.equal(getNotificationNavigationTarget(removedNotice), null);
});

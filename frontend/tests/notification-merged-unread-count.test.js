import test from 'node:test';
import assert from 'node:assert/strict';
import { countMergedUnreadNotifications } from '../src/utils/notificationMergeLogic.js';

test('unread count merges local and server notifications without double count', () => {
  const serverItems = [{ id: '14' }, { id: 'notif-shared' }];
  const localItems = [
    { id: 'notif-shared', isRead: false },
    { id: 'notif-local-unread', isRead: false },
    { id: 'notif-local-unread', isRead: false },
    { id: 'local-read', isRead: true },
    { id: 'database-id', isRead: false },
  ];

  assert.equal(countMergedUnreadNotifications(4, serverItems, localItems), 5);
});

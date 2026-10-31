import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLegacyMockNotificationId,
  isLocalNotificationId,
  mergeNotificationItems,
  countMergedUnreadNotifications,
  countUnreadNotificationItems,
} from '../src/utils/notificationMergeLogic.js';

test('isLegacyMockNotificationId identifies mock ids and preserves genuine local ids', () => {
  assert.equal(isLegacyMockNotificationId('notif-1'), true);
  assert.equal(isLegacyMockNotificationId('notif-2'), true);
  assert.equal(isLegacyMockNotificationId('notif-3'), true);
  assert.equal(isLegacyMockNotificationId('notif-4'), true);
  assert.equal(isLegacyMockNotificationId('notif-5'), true);

  // Genuine dynamic local notifications
  assert.equal(isLegacyMockNotificationId('notif-1730000000000'), false);
  assert.equal(isLegacyMockNotificationId('notif-shared'), false);
  assert.equal(isLegacyMockNotificationId('notif-local-unread'), false);
  assert.equal(isLegacyMockNotificationId('local-123'), false);
  assert.equal(isLegacyMockNotificationId('123'), false);
});

test('mergeNotificationItems filters out legacy mock items', () => {
  const serverItems = [
    { id: '101', type: 'like', isRead: false },
    { id: '102', type: 'comment', isRead: false },
  ];
  const localItems = [
    { id: 'notif-1', type: 'like', isRead: false }, // mock
    { id: 'notif-2', type: 'comment', isRead: false }, // mock
    { id: 'notif-1730000000000', type: 'system', isRead: false }, // genuine local
  ];

  const merged = mergeNotificationItems(serverItems, localItems);
  assert.equal(merged.length, 3);
  assert.ok(!merged.some((item) => item.id === 'notif-1'));
  assert.ok(!merged.some((item) => item.id === 'notif-2'));
  assert.ok(merged.some((item) => item.id === '101'));
  assert.ok(merged.some((item) => item.id === 'notif-1730000000000'));
});

test('countMergedUnreadNotifications does not count legacy mock items', () => {
  const serverItems = [{ id: '101', isRead: false }];
  const localItems = [
    { id: 'notif-1', isRead: false }, // mock
    { id: 'notif-2', isRead: false }, // mock
    { id: 'notif-1730000000000', isRead: false }, // genuine local
  ];

  // serverUnreadCount is 1 (id 101), only 1 genuine local unread -> total 2
  const total = countMergedUnreadNotifications(1, serverItems, localItems);
  assert.equal(total, 2);
});

test('countUnreadNotificationItems excludes legacy mock notifications', () => {
  const items = [
    { id: 'notif-1', isRead: false },
    { id: 'notif-2', isRead: false },
    { id: '101', isRead: false },
    { id: '102', isRead: true },
  ];

  assert.equal(countUnreadNotificationItems(items), 1);
});

test('tab counts are consistent: sum of interaction, system, and other items match total', () => {
  const isInteractionType = (type) => ['like', 'comment', 'share', 'reaction'].includes(type);
  const isSystemType = (type) =>
    ['system', 'ai_moderation', 'moderation_alert', 'report', 'appeal', 'warning', 'report_receipt'].includes(type);

  const notifications = [
    { id: '1', type: 'like', isRead: false },
    { id: '2', type: 'reaction', isRead: false },
    { id: '3', type: 'comment', isRead: false },
    { id: '4', type: 'share', isRead: true },
    { id: '5', type: 'system', isRead: false },
    { id: '6', type: 'ai_moderation', isRead: true },
  ];

  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const interactionCount = notifications.filter((n) => isInteractionType(n.type)).length;
  const systemCount = notifications.filter((n) => isSystemType(n.type)).length;

  assert.equal(totalCount, 6);
  assert.equal(unreadCount, 4);
  assert.equal(interactionCount, 4);
  assert.equal(systemCount, 2);
  assert.equal(interactionCount + systemCount, totalCount);

  // When filtering by 'unread', tab counts do NOT change
  const unreadSubset = notifications.filter((n) => !n.isRead);
  assert.equal(unreadSubset.length, unreadCount);
  // Full list preserves counts
  assert.equal(notifications.length, totalCount);
});


import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeNotificationItems } from '../src/utils/notificationMergeLogic.js';
import { getModerationNoticeText } from '../src/utils/moderationNoticeLogic.js';
import { imageReviewNotification } from '../../backend/src/services/moderationNotificationText.js';

test('image review notices survive notification merge', () => {
  const localNotices = [
    { id: 'notif-hidden', type: 'ai_moderation', status: 'rejected_admin', content: getModerationNoticeText('post', 'rejected_admin'), isRead: false },
    { id: 'notif-sensitive', type: 'ai_moderation', status: 'sensitive', content: getModerationNoticeText('post', 'sensitive'), isRead: false },
    { id: 'notif-pending', type: 'ai_moderation', status: 'pending_review', content: getModerationNoticeText('post', 'pending_review'), isRead: false },
    { id: 'notif-appeal', type: 'appeal', status: 'appeal_pending', content: getModerationNoticeText('post', 'appeal_pending'), isRead: false },
    { id: 'notif-image-appeal', type: 'appeal', content: imageReviewNotification('post', 'final', 'safe'), isRead: false },
  ];

  const merged = mergeNotificationItems([{ id: 'server-1', type: 'like', content: 'A reaction' }], localNotices);

  for (const notice of localNotices) {
    const result = merged.find((item) => item.id === notice.id);
    assert.ok(result, `${notice.status || 'image appeal'} notice remains in the merged list`);
    assert.equal(result.content, notice.content);
  }
});

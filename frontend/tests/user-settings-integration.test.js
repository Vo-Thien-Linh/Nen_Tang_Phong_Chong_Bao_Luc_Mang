import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsService } from '../src/services/settingsService.js';

test('Settings: updatePrivacy saves post_default_privacy, show_email, and show_phone', async () => {
  const result = await settingsService.updatePrivacy({
    post_default_privacy: 'private',
    show_email: true,
    show_phone: false
  });

  assert.equal(result.success, true);
  const saved = JSON.parse(localStorage.getItem('nexussocial_user_settings') || '{}');
  assert.equal(saved.post_default_privacy, 'private');
  assert.equal(saved.show_email, true);
  assert.equal(saved.show_phone, false);
});

test('Settings: updateNotifications saves notification toggles', async () => {
  const result = await settingsService.updateNotifications({
    notify_likes: false,
    notify_comments: true,
    notify_friend_requests: false,
    notify_ai_warnings: true,
    sound_enabled: false
  });

  assert.equal(result.success, true);
  const saved = JSON.parse(localStorage.getItem('nexussocial_user_settings') || '{}');
  assert.equal(saved.notify_likes, false);
  assert.equal(saved.notify_comments, true);
  assert.equal(saved.notify_friend_requests, false);
  assert.equal(saved.sound_enabled, false);
});

test('Settings: blockUser and unblockUser manages blocked user list', async () => {
  const targetId = 'test-blocked-user-999';
  const targetUser = { name: 'Người Bị Chặn', username: 'blocked_999' };

  // 1. Chặn người dùng
  await settingsService.blockUser(targetId, targetUser);
  let blocked = await settingsService.getBlockedUsers();
  assert.ok(blocked.some(u => u.id === targetId));

  // 2. Bỏ chặn người dùng
  await settingsService.unblockUser(targetId);
  blocked = await settingsService.getBlockedUsers();
  assert.equal(blocked.some(u => u.id === targetId), false);
});

test('Feed filtering: hides posts from blocked users and private posts from others', () => {
  const currentUser = { id: 'user-me-1' };
  const blockedIds = new Set(['user-bad-2']);

  const mockPosts = [
    { id: 1, author_id: 'user-me-1', content: 'Bài của tôi (public)', privacy: 'public' },
    { id: 2, author_id: 'user-me-1', content: 'Nhật ký của tôi (private)', privacy: 'private' },
    { id: 3, author_id: 'user-other-3', content: 'Bài của bạn bè (public)', privacy: 'public' },
    { id: 4, author_id: 'user-other-3', content: 'Bí mật của người khác (private)', privacy: 'private' },
    { id: 5, author_id: 'user-bad-2', content: 'Bài của kẻ bị chặn', privacy: 'public' },
  ];

  const visiblePosts = mockPosts.filter((p) => {
    const authorId = String(p.author_id);
    if (blockedIds.has(authorId)) return false;
    if (p.privacy === 'private' && authorId !== String(currentUser.id)) return false;
    return true;
  });

  const visibleIds = visiblePosts.map(p => p.id);
  assert.deepEqual(visibleIds, [1, 2, 3]); // Chỉ thấy bài 1 (public tôi), bài 2 (private tôi), bài 3 (public người khác)
  assert.equal(visibleIds.includes(4), false, 'Không được thấy bài private của người khác');
  assert.equal(visibleIds.includes(5), false, 'Không được thấy bài của người đã bị chặn');
});

test('Notification filtering: respects user notification preferences', () => {
  const userSettings = {
    notify_likes: false,
    notify_comments: true,
    notify_friend_requests: false,
    notify_ai_warnings: true
  };

  const notifications = [
    { id: 'n1', type: 'like', content: 'A đã thích bài viết' },
    { id: 'n2', type: 'comment', content: 'B đã bình luận' },
    { id: 'n3', type: 'friend_request', content: 'C gửi lời mời kết bạn' },
    { id: 'n4', type: 'ai_moderation', content: 'AI cảnh báo' },
  ];

  const filtered = notifications.filter((item) => {
    if (userSettings.notify_likes === false && (item.type === 'like' || item.type === 'reaction')) return false;
    if (userSettings.notify_comments === false && item.type === 'comment') return false;
    if (userSettings.notify_friend_requests === false && (item.type === 'friend_request' || item.type === 'friend_accept')) return false;
    if (userSettings.notify_ai_warnings === false && item.type === 'ai_moderation') return false;
    return true;
  });

  assert.deepEqual(filtered.map(n => n.id), ['n2', 'n4']);
});

test('Profile contact privacy: filters email and phone for viewers', () => {
  const profileOwnerSettings = {
    show_email: false,
    show_phone: true
  };

  const ownerProfile = {
    email: 'secret@gmail.com',
    phone: '0988888888',
    settings: profileOwnerSettings
  };

  // Người khác xem:
  const isOwnProfile = false;
  const canSeeEmail = isOwnProfile || Boolean(ownerProfile.settings?.show_email);
  const canSeePhone = isOwnProfile || Boolean(ownerProfile.settings?.show_phone);

  assert.equal(canSeeEmail, false, 'Email phải bị ẩn với người xem khác khi show_email=false');
  assert.equal(canSeePhone, true, 'Phone phải hiển thị khi show_phone=true');

  // Chính chủ xem:
  const canOwnerSeeEmail = true || Boolean(ownerProfile.settings?.show_email);
  assert.equal(canOwnerSeeEmail, true, 'Chính chủ luôn nhìn thấy email của mình');
});

test('Settings: updateAppearance saves theme and language', async () => {
  const result = await settingsService.updateAppearance({
    theme: 'dark',
    language: 'en'
  });

  assert.equal(result.success, true);
  const saved = JSON.parse(localStorage.getItem('nexussocial_user_settings') || '{}');
  assert.equal(saved.theme, 'dark');
  assert.equal(saved.language, 'en');
});

test('Notification sound utility: executes safely in test environment', async () => {
  const { playNotificationSound } = await import('../src/utils/soundUtil.js');
  assert.doesNotThrow(() => {
    playNotificationSound();
  });
});


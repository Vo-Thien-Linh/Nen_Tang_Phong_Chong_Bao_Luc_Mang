import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getReactionFriendshipView, resolveReactionFriendshipStatus } from '../src/utils/reactionFriendship.js';

const modalSource = readFileSync(new URL('../src/components/PostReactionsModal.jsx', import.meta.url), 'utf8');

test('friend row shows friends label instead of add button', () => {
  assert.deepEqual(getReactionFriendshipView('friends'), { kind: 'label', label: 'Bạn bè', disabled: true });
});

test('stranger row shows add friend button', () => {
  assert.deepEqual(getReactionFriendshipView('none'), { kind: 'add', label: 'Kết bạn', disabled: false });
});

test('pending sent row shows request sent label', () => {
  assert.deepEqual(getReactionFriendshipView('pending_sent'), { kind: 'label', label: 'Đã gửi lời mời', disabled: true });
});

test('pending received row shows request received label', () => {
  assert.deepEqual(getReactionFriendshipView('pending_received'), { kind: 'label', label: 'Đã gửi lời mời cho bạn', disabled: true });
});

test('own and blocked rows show no button', () => {
  assert.equal(getReactionFriendshipView('self').kind, 'hidden');
  assert.equal(getReactionFriendshipView('blocked').kind, 'hidden');
});

test('successful friend request switches the row to request sent', () => {
  assert.equal(resolveReactionFriendshipStatus('none', 'pending_sent'), 'pending_sent');
  assert.match(modalSource, /friendService\.sendFriendRequest\(userId\)/);
  assert.match(modalSource, /\[userId\]: 'pending_sent'/);
});

test('failed friend request does not mark the row as sent', () => {
  assert.equal(resolveReactionFriendshipStatus('none', undefined), 'none');
  assert.match(modalSource, /catch \{[\s\S]*delete next\[userId\]/);
});

test('modal uses server friendship status instead of a friends list', () => {
  assert.match(modalSource, /reactor\.friendshipStatus \|\| reactor\.friendship_status/);
  assert.doesNotMatch(modalSource, /getFriendsList/);
});

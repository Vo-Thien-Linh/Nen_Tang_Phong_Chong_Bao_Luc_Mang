import test from 'node:test';
import assert from 'node:assert/strict';

// Reducer / update logic mirrors MessagesView state transitions
function applyRecallToMessages(messages, recalledMessageId) {
  return messages.map((m) =>
    String(m.id) === String(recalledMessageId)
      ? {
          ...m,
          text: 'Tin nhắn đã được thu hồi',
          isRecalled: true,
          mediaUrl: null,
          status: 'recalled',
        }
      : m
  );
}

function applyRecallToConversations(conversations, conversationId) {
  return conversations.map((c) =>
    String(c.id) === String(conversationId)
      ? {
          ...c,
          lastMessage: 'Tin nhắn đã được thu hồi',
        }
      : c
  );
}

function applyBlockToConversation(conversation, blockerId) {
  return {
    ...conversation,
    status: 'blocked',
    blockedBy: blockerId,
  };
}

function applyUnblockToConversation(conversation) {
  return {
    ...conversation,
    status: 'accepted',
    blockedBy: null,
  };
}

function canSendMessage(conversation, currentUserId) {
  if (!conversation) return false;
  if (conversation.status === 'blocked') return false;
  return true;
}

test('applyRecallToMessages: marks message as recalled and clears media', () => {
  const initialMessages = [
    { id: 1, text: 'Hello', senderId: 'current', isRecalled: false, mediaUrl: null, status: 'sent' },
    { id: 2, text: 'Secret info', senderId: 'current', isRecalled: false, mediaUrl: 'https://img.com/1.png', status: 'sent' }
  ];

  const updated = applyRecallToMessages(initialMessages, 2);
  assert.equal(updated.length, 2);
  assert.equal(updated[1].isRecalled, true);
  assert.equal(updated[1].text, 'Tin nhắn đã được thu hồi');
  assert.equal(updated[1].mediaUrl, null);
  assert.equal(updated[1].status, 'recalled');
  assert.equal(updated[0].isRecalled, false);
});

test('applyRecallToConversations: updates lastMessage preview', () => {
  const convs = [
    { id: '10', lastMessage: 'Bi mat khong the tiet lo' },
    { id: '20', lastMessage: 'Tro chuyen khac' }
  ];

  const updated = applyRecallToConversations(convs, '10');
  assert.equal(updated[0].lastMessage, 'Tin nhắn đã được thu hồi');
  assert.equal(updated[1].lastMessage, 'Tro chuyen khac');
});

test('conversation block and unblock state transitions and send restrictions', () => {
  const currentUserId = 'user-1';
  let conv = { id: 'conv-100', status: 'accepted', blockedBy: null };

  // 1. Initial state: can send
  assert.equal(canSendMessage(conv, currentUserId), true);

  // 2. Block conversation
  conv = applyBlockToConversation(conv, currentUserId);
  assert.equal(conv.status, 'blocked');
  assert.equal(conv.blockedBy, currentUserId);
  assert.equal(canSendMessage(conv, currentUserId), false);

  // 3. Unblock conversation
  conv = applyUnblockToConversation(conv);
  assert.equal(conv.status, 'accepted');
  assert.equal(conv.blockedBy, null);
  assert.equal(canSendMessage(conv, currentUserId), true);
});

const LABELS = {
  friends: 'Bạn bè',
  pending_sent: 'Đã gửi lời mời',
  pending_received: 'Đã gửi lời mời cho bạn',
  none: 'Kết bạn',
};

export function getReactionFriendshipView(status = 'none') {
  if (status === 'self' || status === 'blocked') {
    return { kind: 'hidden', label: '', disabled: true };
  }
  if (status === 'friends') {
    return { kind: 'label', label: LABELS.friends, disabled: true };
  }
  if (status === 'pending_sent') {
    return { kind: 'label', label: LABELS.pending_sent, disabled: true };
  }
  if (status === 'pending_received') {
    return { kind: 'label', label: LABELS.pending_received, disabled: true };
  }
  return { kind: 'add', label: LABELS.none, disabled: false };
}

export function resolveReactionFriendshipStatus(serverStatus, localStatus) {
  return localStatus || serverStatus || 'none';
}

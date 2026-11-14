export function deriveFriendshipStatus({ viewerId, reactorId, status, requesterId, addresseeId }) {
  if (!viewerId || !reactorId) return 'none';

  const viewer = String(viewerId);
  const reactor = String(reactorId);
  if (viewer === reactor) return 'self';

  if (status === 'accepted') return 'friends';
  if (status === 'blocked') return 'blocked';
  if (status === 'pending') {
    if (String(requesterId) === viewer && String(addresseeId) === reactor) return 'pending_sent';
    if (String(requesterId) === reactor && String(addresseeId) === viewer) return 'pending_received';
  }

  return 'none';
}

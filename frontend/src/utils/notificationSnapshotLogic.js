export function getNotificationSnapshotPreview(notification) {
  const snapshot = notification?.snapshot;
  if (snapshot?.type !== 'moderation_removal') {
    return { isRemoval: false, content: '', images: [] };
  }
  return {
    isRemoval: true,
    content: snapshot.content || snapshot.excerpt || '',
    images: Array.isArray(snapshot.imageUrls) ? snapshot.imageUrls.filter(Boolean) : [],
    createdAt: snapshot.createdAt || null,
    contentType: snapshot.contentType || null,
  };
}

export function getNotificationNavigationTarget(notification) {
  if (getNotificationSnapshotPreview(notification).isRemoval) return null;
  return notification?.targetPost?.id || notification?.targetPostId || null;
}

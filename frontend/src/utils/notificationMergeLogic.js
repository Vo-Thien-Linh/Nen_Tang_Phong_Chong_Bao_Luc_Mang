const LOCAL_NOTIFICATION_PREFIXES = ['notif-', 'local-'];

export function isLocalNotificationId(id) {
  return LOCAL_NOTIFICATION_PREFIXES.some((prefix) => String(id).startsWith(prefix));
}

function getNotificationTimestamp(item) {
  for (const value of [item.createdAtIso, item.createdAt, item.created_at]) {
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  if (isLocalNotificationId(item.id)) {
    const timestamp = Number(String(item.id).replace(/\D/g, ''));
    if (timestamp > 1_000_000_000_000) return timestamp;
  }

  return 0;
}

export function mergeNotificationItems(serverItems = [], localItems = []) {
  const serverById = new Map(serverItems.map((item) => [String(item.id), item]));
  const localById = new Map();
  for (const item of localItems) {
    if (isLocalNotificationId(item.id)) localById.set(String(item.id), item);
  }

  const distinctLocals = [...localById.values()].filter((item) => !serverById.has(String(item.id)));
  return [...distinctLocals, ...serverById.values()].sort(
    (a, b) => getNotificationTimestamp(b) - getNotificationTimestamp(a)
  );
}

export function countUnreadNotificationItems(items = []) {
  const uniqueById = new Map(items.map((item) => [String(item.id), item]));
  return [...uniqueById.values()].filter((item) => !item.isRead).length;
}

export function countMergedUnreadNotifications(serverUnreadCount, serverItems = [], localItems = []) {
  const serverIds = new Set(serverItems.map((item) => String(item.id)));
  const localById = new Map();
  for (const item of localItems) {
    if (isLocalNotificationId(item.id)) localById.set(String(item.id), item);
  }

  const localUnreadCount = [...localById.values()].filter(
    (item) => !item.isRead && !serverIds.has(String(item.id))
  ).length;
  return Math.max(0, Number(serverUnreadCount) || 0) + localUnreadCount;
}

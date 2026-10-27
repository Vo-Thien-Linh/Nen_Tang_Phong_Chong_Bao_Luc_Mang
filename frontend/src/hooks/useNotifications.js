import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchNotifications,
  fetchUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationApi,
  clearReadNotificationsApi,
} from '../api/client';
import { initialNotifications } from '../data/mockData';
import {
  countMergedUnreadNotifications,
  countUnreadNotificationItems,
  isLocalNotificationId,
  mergeNotificationItems,
} from '../utils/notificationMergeLogic';

// Helper lưu trữ thông báo cục bộ / hệ thống / admin vào LocalStorage theo userId
const getStoredLocalNotifs = (userId) => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`nexussocial_local_notifs_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredLocalNotifs = (userId, notifs) => {
  if (!userId) return;
  try {
    const localOnly = notifs.filter((n) =>
      String(n.id).startsWith('notif-') || String(n.id).startsWith('local-')
    );
    localStorage.setItem(`nexussocial_local_notifs_${userId}`, JSON.stringify(localOnly.slice(0, 30)));
  } catch {
    // ignore
  }
};

export function useNotifications({ currentUser, activeTab }) {
  const [notifications, setNotifications] = useState(() => {
    const stored = getStoredLocalNotifs(currentUser?.id);
    return mergeNotificationItems(initialNotifications, stored);
  });
  const [unreadCount, setUnreadCount] = useState(() => {
    const stored = getStoredLocalNotifs(currentUser?.id);
    return countUnreadNotificationItems(mergeNotificationItems(initialNotifications, stored));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [toastNotification, setToastNotification] = useState(null);

  const prevUnreadCountRef = useRef(unreadCount);
  const prevItemsRef = useRef(notifications);
  const activeUserIdRef = useRef(currentUser?.id || null);

  useEffect(() => {
    const userId = currentUser?.id || null;
    if (activeUserIdRef.current === userId) return;
    activeUserIdRef.current = userId;
    const nextItems = mergeNotificationItems(initialNotifications, getStoredLocalNotifs(userId));
    setNotifications(nextItems);
    setUnreadCount(countUnreadNotificationItems(nextItems));
    prevItemsRef.current = nextItems;
    prevUnreadCountRef.current = countUnreadNotificationItems(nextItems);
  }, [currentUser?.id]);

  // Hàm tải danh sách thông báo từ Backend (Hợp nhất dữ liệu DB và thông báo hệ thống cục bộ)
  const refreshNotifications = useCallback(
    async (filter = activeFilter, showSpinner = false) => {
      if (!currentUser?.id) return;
      if (showSpinner) setIsLoading(true);

      try {
        const res = await fetchNotifications({
          userId: currentUser.id,
          limit: 40,
          filter,
        });

        if (res.success && Array.isArray(res.data)) {
          // Lấy danh sách thông báo hệ thống / admin từ LocalStorage
          const storedLocals = getStoredLocalNotifs(currentUser.id);

          setNotifications((prev) => {
            const currentLocals = prev.filter((item) => isLocalNotificationId(item.id));

            // Kiểm tra xem có thông báo mới tinh chưa có ở danh sách trước không
            if (prevItemsRef.current.length > 0 && res.data.length > 0) {
              const latestItem = res.data[0];
              const isAlreadyExisted = prevItemsRef.current.some(
                (p) => String(p.id) === String(latestItem.id)
              );
              // Nếu có item mới xuất hiện và chưa đọc, kích hoạt Toast
              if (!isAlreadyExisted && !latestItem.isRead && activeTab !== 'notifications') {
                setToastNotification(latestItem);
              }
            }

            const merged = mergeNotificationItems(res.data, [...storedLocals, ...currentLocals]);
            prevItemsRef.current = merged;
            return merged;
          });

          if (typeof res.unreadCount === 'number') {
            const storedLocals = getStoredLocalNotifs(currentUser.id);
            const mergedUnreadCount = countMergedUnreadNotifications(res.unreadCount, res.data, storedLocals);
            setUnreadCount(mergedUnreadCount);
            prevUnreadCountRef.current = mergedUnreadCount;
          }
        }
      } catch (err) {
        console.warn('Lỗi khi fetch notifications (dùng mock fallback):', err.message);
      } finally {
        if (showSpinner) setIsLoading(false);
      }
    },
    [currentUser?.id, activeFilter, activeTab]
  );

  // Khi đăng nhập hoặc đổi filter -> tải lại danh sách
  useEffect(() => {
    if (currentUser?.id) {
      // Nạp thông báo cục bộ đã lưu của user này
      const stored = getStoredLocalNotifs(currentUser.id);
      if (stored.length > 0) {
        setNotifications((prev) => {
          const map = new Map();
          [...stored, ...prev].forEach((item) => map.set(String(item.id), item));
          return Array.from(map.values());
        });
      }
      refreshNotifications(activeFilter, true);
    }
  }, [currentUser?.id, activeFilter, refreshNotifications]);

  // Khi chuyển sang tab notifications -> refresh danh sách mới nhất
  useEffect(() => {
    if (activeTab === 'notifications' && currentUser?.id) {
      refreshNotifications(activeFilter, false);
    }
  }, [activeTab, currentUser?.id, activeFilter, refreshNotifications]);

  // Smart Polling kiểm tra unread count mỗi 25 giây
  useEffect(() => {
    if (!currentUser?.id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetchUnreadNotificationsCount({ userId: currentUser.id });
        if (res.success && typeof res.unreadCount === 'number') {
          const storedLocals = getStoredLocalNotifs(currentUser.id);
          const serverItems = prevItemsRef.current.filter((item) => !isLocalNotificationId(item.id));
          const totalUnread = countMergedUnreadNotifications(res.unreadCount, serverItems, storedLocals);

          if (totalUnread > prevUnreadCountRef.current) {
            refreshNotifications(activeFilter, false);
          }
          setUnreadCount(totalUnread);
          prevUnreadCountRef.current = totalUnread;
        }
      } catch {
        // Polling âm thầm bỏ qua lỗi mạng tạm thời
      }
    }, 25000);

    return () => clearInterval(interval);
  }, [currentUser?.id, activeFilter, refreshNotifications]);

  // Tự đóng toast sau 4.5 giây
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Đánh dấu 1 thông báo là đã đọc
  const handleMarkAsRead = async (id) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (String(n.id) === String(id) ? { ...n, isRead: true } : n));
      saveStoredLocalNotifs(currentUser?.id, updated);
      return updated;
    });
    const currentItem = notifications.find((item) => String(item.id) === String(id));
    if (currentItem && !currentItem.isRead) setUnreadCount((prev) => Math.max(0, prev - 1));

    // Nếu là ID từ database backend, đồng bộ lên server
    if (currentUser?.id && !String(id).startsWith('notif-') && !String(id).startsWith('local-')) {
      try {
        const res = await markNotificationAsRead({
          userId: currentUser.id,
          notificationId: id,
        });
        if (res.success && typeof res.unreadCount === 'number') {
          const storedLocals = getStoredLocalNotifs(currentUser.id);
          const serverItems = prevItemsRef.current.filter((item) => !isLocalNotificationId(item.id));
          setUnreadCount(countMergedUnreadNotifications(res.unreadCount, serverItems, storedLocals));
        }
      } catch (err) {
        console.error('Lỗi đánh dấu đã đọc:', err);
      }
    }
  };

  // Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, isRead: true }));
      saveStoredLocalNotifs(currentUser?.id, updated);
      return updated;
    });
    setUnreadCount(0);

    if (currentUser?.id) {
      try {
        await markAllNotificationsAsRead({ userId: currentUser.id });
      } catch (err) {
        console.error('Lỗi đánh dấu tất cả đã đọc:', err);
      }
    }
  };

  // Xóa 1 thông báo
  const handleDeleteNotification = async (id) => {
    const target = notifications.find((n) => String(n.id) === String(id));
    setNotifications((prev) => {
      const updated = prev.filter((n) => String(n.id) !== String(id));
      saveStoredLocalNotifs(currentUser?.id, updated);
      return updated;
    });
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    if (currentUser?.id && !String(id).startsWith('notif-') && !String(id).startsWith('local-')) {
      try {
        await deleteNotificationApi({
          userId: currentUser.id,
          notificationId: id,
        });
      } catch (err) {
        console.error('Lỗi xóa thông báo:', err);
      }
    }
  };

  // Xóa tất cả thông báo đã đọc
  const handleClearReadNotifications = async () => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => !n.isRead);
      saveStoredLocalNotifs(currentUser?.id, updated);
      return updated;
    });

    if (currentUser?.id) {
      try {
        await clearReadNotificationsApi({ userId: currentUser.id });
      } catch (err) {
        console.error('Lỗi xóa thông báo đã đọc:', err);
      }
    }
  };

  // Thêm thông báo hệ thống / cảnh báo trực tiếp từ frontend (Report, Appeal, Admin action)
  const addLocalNotification = (notif) => {
    const nowIso = new Date().toISOString();
    const newNotif = {
      ...notif,
      id: notif.id || `notif-${Date.now()}`,
      type: notif.type || 'system',
      user: notif.user || {
        id: 'system',
        name: 'Thông báo hệ thống',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
      },
      content: notif.content || '',
      createdAt: notif.createdAt || notif.created_at || nowIso,
      created_at: notif.created_at || notif.createdAt || nowIso,
      time: notif.time || 'Vừa xong',
      isRead: notif.isRead ?? false,
      targetPost: notif.targetPost || null,
    };

    setNotifications((prev) => {
      const nextList = mergeNotificationItems([], [newNotif, ...prev]);
      saveStoredLocalNotifs(currentUser?.id, nextList);
      return nextList;
    });
    setUnreadCount((prev) => prev + 1);
    setToastNotification(newNotif);
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    activeFilter,
    setActiveFilter,
    toastNotification,
    setToastNotification,
    refreshNotifications,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDeleteNotification,
    handleClearReadNotifications,
    addLocalNotification,
  };
}

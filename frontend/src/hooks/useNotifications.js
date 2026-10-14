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

export function useNotifications({ currentUser, activeTab }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(
    () => initialNotifications.filter((n) => !n.isRead).length
  );
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [toastNotification, setToastNotification] = useState(null);

  const prevUnreadCountRef = useRef(unreadCount);
  const prevItemsRef = useRef(notifications);

  // Hàm tải danh sách thông báo từ Backend
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

          setNotifications(res.data);
          prevItemsRef.current = res.data;
          if (typeof res.unreadCount === 'number') {
            setUnreadCount(res.unreadCount);
            prevUnreadCountRef.current = res.unreadCount;
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
          // Nếu số lượng chưa đọc tăng lên -> tải lại full danh sách
          if (res.unreadCount > prevUnreadCountRef.current) {
            refreshNotifications(activeFilter, false);
          }
          setUnreadCount(res.unreadCount);
          prevUnreadCountRef.current = res.unreadCount;
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
    // Optimistic update ngay lập tức trên UI
    setNotifications((prev) =>
      prev.map((n) => (String(n.id) === String(id) ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    if (currentUser?.id) {
      try {
        const res = await markNotificationAsRead({
          userId: currentUser.id,
          notificationId: id,
        });
        if (res.success && typeof res.unreadCount === 'number') {
          setUnreadCount(res.unreadCount);
        }
      } catch (err) {
        console.error('Lỗi đánh dấu đã đọc:', err);
      }
    }
  };

  // Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
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
    setNotifications((prev) => prev.filter((n) => String(n.id) !== String(id)));
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    if (currentUser?.id) {
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
    setNotifications((prev) => prev.filter((n) => !n.isRead));

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
    const newNotif = {
      id: notif.id || `notif-${Date.now()}`,
      type: notif.type || 'system',
      user: notif.user || {
        name: 'Nexus Admin Shield',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
      },
      content: notif.content || '',
      time: 'Vừa xong',
      createdAt: new Date().toISOString(),
      isRead: false,
      targetPost: notif.targetPost || null,
    };

    setNotifications((prev) => [newNotif, ...prev]);
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

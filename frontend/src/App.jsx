import { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './components/Navbar';
import HomeView from './components/HomeView';
import FriendsView from './components/FriendsView';
import MessagesView from './components/MessagesView';
import NotificationsView from './components/NotificationsView';
import NotificationToast from './components/NotificationToast';
import ProfileView from './components/ProfileView';
import AdminDashboardView from './components/AdminDashboardView';
import ModeratorView from './components/ModeratorView';
import SettingsView from './components/SettingsView';
import PostDetailView from './components/PostDetailView';
import { useNotifications } from './hooks/useNotifications';
import AiModerationModal from './components/AiModerationModal';
import { appendCreatedComment, incrementPostCountOnce, prependCreatedPost, replacePostComments } from './utils/creationFlowLogic';
import { handleRealtimeFeedEvent } from './utils/realtimeFeedLogic';
import ReportModal from './components/ReportModal';
import AppealModal from './components/AppealModal';
import AuthModal from './components/AuthModal';
import { authService } from './services/authService';
import { hasRole, ROLES, getDefaultTabForUser, normalizeRole } from './utils/rbac';
import { 
  currentUser as initialUser, 
  initialPosts, 
  initialNotifications, 
  initialReports, 
  initialAppeals, 
  initialAiOverrides,
  initialUsersList
} from './data/mockData';
import { 
  fetchPosts, 
  fetchPostById, 
  createComment, 
  updatePost, 
  deletePost, 
  sharePost, 
  updateUserSanctionApi, 
  resolveReportApi,
  createReportApi,
  fetchReportsList,
  fetchAppealsList,
  createAppealApi,
  resolveAppealApi,
  fetchAiOverridesList,
  createAiOverrideApi
} from './api/client';
import { applyUpdatedPostToList, runPostDeleteAction } from './utils/postActionLogic';
import { getNotificationNavigationTarget } from './utils/notificationSnapshotLogic';
import { closePostMenu, togglePostMenu } from './utils/menuLogic';
import {
  clearPostNotice,
  countVisiblePosts,
  isHardHiddenPost,
  markDeletedPostNotice,
  markEditPostNotice,
  removeDeletedNotice,
} from './utils/noticeLogic';

const configuredUserId = import.meta.env.VITE_CURRENT_USER_ID?.trim();
const currentUserWithEnvId = configuredUserId
  ? { ...initialUser, id: configuredUserId }
  : initialUser;
const initialFeedWarning = '';

export default function App() {
  // Trạng thái Xác thực người dùng (Auth)
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login'); // 'login' | 'register'
  const [authNoticeMessage, setAuthNoticeMessage] = useState('');
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'friends' | 'messages' | 'notifications' | 'profile' | 'admin' | 'post'
  const [posts, setPosts] = useState(initialPosts);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [focusedPostTarget, setFocusedPostTarget] = useState(null);
  const [viewedPostDetail, setViewedPostDetail] = useState(null); // Chi tiết bài viết khi xem từ thông báo
  const [feedRefreshKey, setFeedRefreshKey] = useState(() => {
    try {
      const saved = sessionStorage.getItem('wings_feed_refresh_key');
      return saved !== null ? Number(saved) : 1;
    } catch {
      return 1;
    }
  }); // Bộ đếm xoay vòng đề xuất bài viết bảng tin (lưu session để F5 giữ nguyên bài)
  const createdPostIdsRef = useRef(new Set());
  const pendingCommentKeysRef = useRef(new Set());
  const [openPostMenuId, setOpenPostMenuId] = useState(null);
  const [feedWarning, setFeedWarning] = useState(initialFeedWarning);
  const {
    notifications,
    unreadCount,
    isLoading: notifLoading,
    activeFilter: notifFilter,
    setActiveFilter: setNotifFilter,
    toastNotification,
    setToastNotification,
    refreshNotifications,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDeleteNotification,
    handleClearReadNotifications,
    addLocalNotification,
  } = useNotifications({ currentUser, activeTab });
  
  // Quản lý Chế độ Giao diện Sáng / Tối (Theme Mode)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('nexussocial_theme') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('nexussocial_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSetTheme = (newTheme) => {
    setTheme(newTheme);
  };
  
  // Dữ liệu quản trị kiểm duyệt & Người dùng
  const [reports, setReports] = useState(initialReports);
  const [appeals, setAppeals] = useState(initialAppeals);
  const [aiOverrides, setAiOverrides] = useState(initialAiOverrides);
  const [usersList, setUsersList] = useState(initialUsersList);

  // Tải dữ liệu kiểm duyệt THẬT từ CSDL PostgreSQL (reports, appeals, ai-overrides)
  const loadModerationData = useCallback(async () => {
    const effectiveUserId = currentUser?.id || configuredUserId;
    if (!effectiveUserId) return;
    try {
      const [reportsRes, appealsRes, overridesRes] = await Promise.allSettled([
        fetchReportsList(effectiveUserId),
        fetchAppealsList(effectiveUserId),
        fetchAiOverridesList(effectiveUserId)
      ]);
      if (reportsRes.status === 'fulfilled' && Array.isArray(reportsRes.value?.data)) {
        setReports(reportsRes.value.data);
      }
      if (appealsRes.status === 'fulfilled' && Array.isArray(appealsRes.value?.data)) {
        setAppeals(appealsRes.value.data);
      }
      if (overridesRes.status === 'fulfilled' && Array.isArray(overridesRes.value?.data)) {
        setAiOverrides(overridesRes.value.data);
      }
    } catch (err) {
      console.warn('Lỗi tải dữ liệu kiểm duyệt từ CSDL PostgreSQL:', err.message);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (activeTab === 'moderation' || (currentUser && hasRole(currentUser, ROLES.MODERATOR))) {
      loadModerationData();
    }
  }, [activeTab, currentUser, loadModerationData]);

  // Trạng thái modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null); // Đối tượng đang được mở modal báo cáo
  const [appealItem, setAppealItem] = useState(null);     // Nội dung đang được mở modal khiếu nại
  const [selectedChatUserId, setSelectedChatUserId] = useState(null);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [viewedProfileUser, setViewedProfileUser] = useState(null); // Xem trang cá nhân người khác
  const [homeSearchQuery, setHomeSearchQuery] = useState(''); // Bộ lọc tìm kiếm bài viết trang chủ

  // Kiểm tra phiên đăng nhập và mở màn hình đăng nhập đầu tiên khi vào trang nếu chưa có tài khoản
  useEffect(() => {
    const token = authService.getToken();
    const storedUser = authService.getCurrentUser();

    if (!token || !storedUser) {
      setCurrentUser(null);
      setAuthNoticeMessage('Chào mừng bạn đến với WINGS! Vui lòng đăng nhập để bắt đầu.');
      setAuthModalTab('login');
      setIsAuthModalOpen(true);
      return;
    }

    // Xác thực token tươi mới với Backend FastAPI
    authService.verifySession().then((verifiedUser) => {
      if (verifiedUser) {
        setCurrentUser(verifiedUser);
      } else {
        setCurrentUser(null);
        setAuthNoticeMessage('Phiên làm việc đã kết thúc. Vui lòng đăng nhập lại.');
        setAuthModalTab('login');
        setIsAuthModalOpen(true);
      }
    });
  }, []);

  // Tự động gỡ phạt cooldown khi thời gian đếm ngược kết thúc
  useEffect(() => {
    const cooldownVal = currentUser?.cooldown_until || currentUser?.cooldownUntil;
    if (currentUser?.status !== 'cooldown' || !cooldownVal) return;
    const cooldownDate = new Date(cooldownVal);
    const diff = cooldownDate.getTime() - Date.now();
    const clearCooldown = () => {
      const cleared = { status: 'active', cooldown_until: null, cooldownUntil: null, cooldown_reason: null };
      authService.updateCurrentUser(cleared);
      setCurrentUser(prev => prev ? { ...prev, ...cleared } : prev);
    };
    if (diff <= 0) {
      clearCooldown();
      return;
    }
    const timer = setTimeout(clearCooldown, diff);
    return () => clearTimeout(timer);
  }, [currentUser?.status, currentUser?.cooldown_until, currentUser?.cooldownUntil]);

  // Xử lý bảo vệ nút Back của trình duyệt theo User Story 3
  useEffect(() => {
    const handlePopState = () => {
      // Nếu đã đăng xuất mà bấm Back, không cho xem nội dung riêng tư
      if (!authService.getCurrentUser()) {
        setCurrentUser(null);
        setActiveTab('home');
        setAuthModalTab('login');
        setAuthNoticeMessage("Phiên làm việc đã kết thúc. Vui lòng đăng nhập để tiếp tục.");
        setIsAuthModalOpen(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Số việc quản trị đang chờ xử lý
  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;
  const pendingAppealsCount = appeals.filter(a => a.status === 'pending').length;
  const pendingModerationCount = pendingReportsCount + pendingAppealsCount;

  // Lắng nghe sự kiện Back/Forward của trình duyệt để điều hướng trang
  useEffect(() => {
    const rawHash = window.location.hash.replace('#', '') || 'home';
    let initialHash = rawHash;
    let initialPostId = null;

    if (rawHash.startsWith('post-')) {
      initialHash = 'post';
      initialPostId = rawHash.replace('post-', '');
    } else if (rawHash === 'post') {
      initialHash = 'post';
      initialPostId = sessionStorage.getItem('wings_viewed_post_id');
    }

    if (initialHash === 'post') {
      if (initialPostId) {
        setViewedPostDetail({
          postId: initialPostId,
          post: null,
          meta: { type: 'view' },
          previousTab: 'home',
        });
      } else {
        initialHash = 'home';
      }
    }

    if (!currentUser) {
      if (initialHash === 'admin' || initialHash === 'moderation' || initialHash === 'profile' || initialHash === 'messages' || initialHash === 'settings') {
        initialHash = 'home';
      }
      setAuthNoticeMessage('Chào mừng bạn đến với WINGS! Vui lòng đăng nhập để tiếp tục.');
      setAuthModalTab('login');
      setIsAuthModalOpen(true);
    } else if (currentUser) {
      if (initialHash === 'admin' && !hasRole(currentUser, ROLES.ADMIN)) {
        initialHash = getDefaultTabForUser(currentUser);
      } else if (initialHash === 'moderation' && !hasRole(currentUser, ROLES.MODERATOR)) {
        initialHash = getDefaultTabForUser(currentUser);
      }
    }

    setActiveTab(initialHash);
    if (!window.history.state) {
      const stateHash = initialPostId ? `post-${initialPostId}` : initialHash;
      window.history.replaceState({ tab: initialHash, postId: initialPostId, viewedUser: null }, '', `#${stateHash}`);
    }

    const handlePopState = (event) => {
      const state = event.state;
      const hash = window.location.hash.replace('#', '') || 'home';
      let targetTab = state?.tab || hash || 'home';
      let targetPostId = state?.postId || null;

      if (targetTab.startsWith('post-')) {
        targetPostId = targetTab.replace('post-', '');
        targetTab = 'post';
      } else if (targetTab === 'post' && !targetPostId) {
        targetPostId = sessionStorage.getItem('wings_viewed_post_id');
      }

      if (targetTab === 'post') {
        if (targetPostId) {
          setViewedPostDetail((prev) =>
            prev?.postId === targetPostId
              ? prev
              : {
                  postId: targetPostId,
                  post: null,
                  meta: { type: 'view' },
                  previousTab: 'home',
                }
          );
        } else {
          targetTab = 'home';
          setViewedPostDetail(null);
        }
      } else {
        setViewedPostDetail(null);
      }

      if (!currentUser && (targetTab === 'admin' || targetTab === 'moderation')) {
        targetTab = 'home';
        setAuthNoticeMessage('Vui lòng đăng nhập để truy cập khu vực này');
        setAuthModalTab('login');
        setIsAuthModalOpen(true);
      } else if (currentUser) {
        if (targetTab === 'admin' && !hasRole(currentUser, ROLES.ADMIN)) {
          targetTab = getDefaultTabForUser(currentUser);
        } else if (targetTab === 'moderation' && !hasRole(currentUser, ROLES.MODERATOR)) {
          targetTab = getDefaultTabForUser(currentUser);
        }
      }

      setActiveTab(targetTab);
      if (targetTab === 'profile') {
        setViewedProfileUser(state?.viewedUser || null);
      } else {
        setViewedProfileUser(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  // Đồng bộ vai trò tươi từ database khi ứng dụng tải
  // Đồng bộ vai trò và trạng thái xử phạt từ database khi ứng dụng tải
  useEffect(() => {
    if (!currentUser?.id) return;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    fetch(`${API_URL}/api/users/${currentUser.id}/profile`, {
      headers: { 'x-user-id': currentUser.id }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const freshRole = normalizeRole(data.data.role);
          const syncUpdates = {};
          if (normalizeRole(currentUser.role) !== freshRole) {
            syncUpdates.role = freshRole;
            syncUpdates.isAdmin = freshRole === 'admin';
          }
          const cdVal = data.data.cooldown_until;
          const cdUntil = cdVal ? new Date(cdVal) : null;
          const isExpired = cdUntil && cdUntil <= new Date();

          if (isExpired || data.data.status === 'active') {
            if (currentUser.status === 'cooldown' || currentUser.cooldown_until) {
              syncUpdates.status = 'active';
              syncUpdates.cooldown_until = null;
              syncUpdates.cooldownUntil = null;
              syncUpdates.cooldown_reason = null;
            }
          } else if (data.data.status && data.data.status !== currentUser.status) {
            syncUpdates.status = data.data.status;
            syncUpdates.cooldown_until = data.data.cooldown_until;
            syncUpdates.cooldownUntil = data.data.cooldown_until;
            syncUpdates.cooldown_reason = data.data.cooldown_reason;
          }
          if (Object.keys(syncUpdates).length > 0) {
            authService.updateCurrentUser(syncUpdates);
            setCurrentUser(prev => prev ? { ...prev, ...syncUpdates } : prev);
          }
        }
      })
      .catch(() => {});
  }, [currentUser?.id]);

  // Xử lý Chuyển Tab có Auth Guard và Role Guard
  const handleTabChange = (tab, targetUser = null, replace = false) => {
    if (!currentUser && (tab === 'messages' || tab === 'profile' || tab === 'admin' || tab === 'moderation' || tab === 'settings')) {
      const msg = tab === 'admin' || tab === 'moderation'
        ? "Vui lòng đăng nhập để truy cập khu vực này"
        : tab === 'messages'
        ? "Vui lòng đăng nhập để sử dụng tính năng nhắn tin"
        : "Trường hợp chưa đăng nhập muốn thực hiện hành động đều chuyển về màn hình đăng nhập";
      setAuthNoticeMessage(msg);
      setAuthModalTab('login');
      setIsAuthModalOpen(true);
      return;
    }

    let effectiveTab = tab;
    if (currentUser) {
      if (tab === 'admin' && !hasRole(currentUser, ROLES.ADMIN)) {
        effectiveTab = getDefaultTabForUser(currentUser);
      } else if (tab === 'moderation' && !hasRole(currentUser, ROLES.MODERATOR)) {
        effectiveTab = getDefaultTabForUser(currentUser);
      }
    }

    if (effectiveTab === 'profile') {
      setViewedProfileUser(targetUser || null);
    } else {
      setViewedProfileUser(null);
    }
    if (effectiveTab !== 'post') {
      setViewedPostDetail(null);
    }
    setActiveTab(effectiveTab);

    const stateObj = { 
      tab: effectiveTab, 
      viewedUser: targetUser ? { id: targetUser.id, name: targetUser.name, avatar: targetUser.avatar } : null 
    };
    if (replace) {
      window.history.replaceState(stateObj, '', `#${effectiveTab}`);
    } else {
      window.history.pushState(stateObj, '', `#${effectiveTab}`);
    }
  };

  // Cập nhật thông tin người dùng đồng bộ
  const handleUpdateUser = (updatedFields) => {
    authService.updateCurrentUser(updatedFields);
    setCurrentUser(prev => {
      if (!prev) return prev;
      return { ...prev, ...updatedFields };
    });

    setUsersList(prev => prev.map(u => {
      if (u.id === currentUser?.id) {
        return { ...u, ...updatedFields };
      }
      return u;
    }));
  };

  const handleOpenUserProfile = (user) => {
    handleTabChange('profile', user);
  };

  const handleTogglePostMenu = (postId) => {
    setOpenPostMenuId(prev => togglePostMenu(prev, postId));
  };

  const handleClosePostMenu = () => {
    setOpenPostMenuId(closePostMenu());
  };

  const handleDismissPostNotice = (postId) => {
    setPosts(prev => {
      const target = prev.find(post => String(post.id) === String(postId));
      if (target?.inlineNotice?.type === 'delete') {
        return removeDeletedNotice(prev, postId);
      }
      return clearPostNotice(prev, postId);
    });
  };

  // Kích hoạt yêu cầu đăng nhập
  const handleRequireAuth = (msg = "Vui lòng đăng nhập để thực hiện chức năng này") => {
    setAuthNoticeMessage(msg);
    setAuthModalTab('login');
    setIsAuthModalOpen(true);
  };

  // Đăng xuất khỏi hệ thống theo User Story 3
  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setActiveTab('home');
    setAuthNoticeMessage("Bạn đã đăng xuất thành công khỏi hệ thống");
    setAuthModalTab('login');
    setIsAuthModalOpen(true); // Hiển thị màn hình đăng nhập với form trống & gợi ý tài khoản
    // Đẩy trạng thái rỗng vào history để chặn Back button
    window.history.replaceState({ auth: false }, '', window.location.pathname);
  };

  useEffect(() => {
    let isMounted = true;
    const effectiveUserId = currentUser?.id || configuredUserId;

    setIsLoadingPosts(true);
    fetchPosts({ userId: effectiveUserId || undefined })
      .then((result) => {
        if (isMounted && Array.isArray(result.data) && result.data.length > 0) {
          setPosts(result.data);
          setFeedWarning('');
        } else if (isMounted && (!result.data || result.data.length === 0)) {
          setPosts(initialPosts);
        }
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('Could not load posts from API; keeping mock feed.', error);
          setFeedWarning('Dev: không tải được bài viết từ API, đang dùng dữ liệu mẫu.');
        }
        if (isMounted) {
          setPosts(initialPosts);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingPosts(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  // Làm mới bảng tin khi nhấn nút Trang chủ, Logo hoặc nút Làm mới
  const handleRefreshHome = async () => {
    if (activeTab !== 'home') {
      handleTabChange('home');
    }
    setHomeSearchQuery(''); // Xóa bộ lọc tìm kiếm để tải lại toàn bộ bảng tin
    setFocusedPostTarget(null); // Xóa bài viết highlight cũ
    setViewedPostDetail(null); // Thoát khỏi chi tiết bài viết nếu có
    setFeedRefreshKey((prev) => {
      const nextKey = prev + 1;
      try {
        sessionStorage.setItem('wings_feed_refresh_key', String(nextKey));
      } catch {}
      return nextKey;
    }); // Xoay vòng thuật toán đề xuất để mang lại nội dung mới mẻ khi chủ động nhấn Trang chủ/Logo
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsLoadingPosts(true);
    const effectiveUserId = currentUser?.id || configuredUserId;
    try {
      // Mặc định thời gian hiển thị vòng quay là 1s + thời gian tải dữ liệu thực tế từ máy chủ
      const minDelay = new Promise((resolve) => setTimeout(resolve, 1000));
      const fetchPromise = fetchPosts({ userId: effectiveUserId || undefined });
      const [result] = await Promise.all([fetchPromise, minDelay]);

      if (Array.isArray(result?.data)) {
        setPosts(result.data);
        setFeedWarning('');
      }
    } catch (err) {
      console.warn('Lỗi khi làm mới bảng tin:', err);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  // Điều hướng trực tiếp tới chi tiết bài viết mục tiêu (chuyên nghiệp như Facebook/Twitter)
  const handleViewPost = async (targetPostId, meta = {}) => {
    if (!targetPostId) return;

    const strTargetId = String(targetPostId);
    const prevTab = activeTab;

    // Tìm bài viết trong danh sách hiện có
    const existingPost = posts.find(
      (p) =>
        String(p.id) === strTargetId ||
        String(p.id) === strTargetId.replace(/^post-/, '') ||
        `post-${p.id}` === strTargetId
    );

    // Mở màn hình xem chi tiết riêng biệt cho bài viết này
    setViewedPostDetail({
      postId: strTargetId,
      post: existingPost || null,
      meta: {
        type: meta.type || 'interaction',
        actor: meta.actor || null,
        targetCommentId: meta.targetCommentId || null,
        notificationId: meta.notificationId || null,
      },
      previousTab: prevTab === 'post' ? 'notifications' : prevTab,
    });

    sessionStorage.setItem('wings_viewed_post_id', strTargetId);
    setActiveTab('post');
    window.history.pushState(
      { tab: 'post', postId: strTargetId },
      '',
      `#post-${strTargetId}`
    );

    // Nếu bài viết chưa có sẵn trong danh sách (bài viết từ lâu), fetch trực tiếp từ API
    if (!existingPost) {
      try {
        setIsLoadingPosts(true);
        const res = await fetchPostById({ postId: strTargetId, userId: currentUser?.id });
        if (res && (res.data || res.id)) {
          const fetchedPost = res.data || res;
          setViewedPostDetail((prev) => (prev ? { ...prev, post: fetchedPost } : prev));
          setPosts((prev) => {
            const alreadyIn = prev.some(
              (p) =>
                String(p.id) === String(fetchedPost.id) ||
                String(p.id) === String(fetchedPost.id).replace(/^post-/, '')
            );
            if (!alreadyIn) {
              return [fetchedPost, ...prev];
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Không thể tải bài viết từ API:', err);
      } finally {
        setIsLoadingPosts(false);
      }
    }
  };

  // Lắng nghe Realtime SSE cho Bài viết & Chia sẻ (Realtime Feed)
  useEffect(() => {
    let eventSource = null;
    try {
      const nodeApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      eventSource = new EventSource(`${nodeApiUrl}/api/realtime/stream`);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setPosts((prev) => handleRealtimeFeedEvent(prev, payload));
        } catch (parseErr) {
          console.warn('Realtime parse error:', parseErr);
        }
      };
    } catch (err) {
      console.warn('EventSource connection error:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Thêm bài viết mới
  const handleAddPost = (newPost, cooldown, violationInfo) => {
    if (!currentUser) {
      handleRequireAuth("Chỉ đăng nhập rồi mới được đăng bài (User Story 4)");
      return;
    }
    if (cooldown) {
      const cooldownData = {
        status: 'cooldown',
        cooldown_until: cooldown.cooldown_until,
        cooldownUntil: cooldown.cooldown_until,
        cooldown_reason: cooldown.cooldown_reason || cooldown.reason
      };
      authService.updateCurrentUser(cooldownData);
      setCurrentUser(prev => ({
        ...prev,
        ...cooldownData
      }));

      // Bắn thông báo xử phạt AI cho tác giả kèm nút kháng cáo
      addLocalNotification({
        id: `notif-ai-violence-${Date.now()}`,
        type: 'ai_moderation',
        user: {
          id: 'system',
          name: 'Thông báo hệ thống',
          avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'
        },
        content: 'Bài viết của bạn đã bị AI ẩn và tài khoản bị tạm khóa 10 phút do vi phạm chính sách về Bạo lực (Violence). Bạn có thể gửi kháng cáo nếu đây là sự nhầm lẫn của AI.',
        time: 'Vừa xong',
        isRead: false,
        targetPost: violationInfo?.content ? {
          id: String(newPost?.id || 'post-violence'),
          contentSnippet: violationInfo.content,
          image: violationInfo.imageUrl || null
        } : null,
        aiStatus: {
          label: 'Violence',
          confidence: 0.95,
          action: 'hide'
        }
      });
    } else if (newPost?.aiStatus?.status === 'hidden' || newPost?.moderationStatus === 'hidden') {
      const label = newPost?.aiStatus?.label || newPost?.aiLabel || 'Hate Speech';
      addLocalNotification({
        id: `notif-ai-hidden-${Date.now()}`,
        type: 'ai_moderation',
        user: {
          id: 'system',
          name: 'Thông báo hệ thống',
          avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'
        },
        content: `Bài viết của bạn đã bị AI ẩn do vi phạm chính sách về ${label === 'Hate Speech' ? 'Ngôn từ thù ghét (Hate Speech)' : label}. Bạn có thể gửi kháng cáo nếu đây là sự nhầm lẫn của AI.`,
        time: 'Vừa xong',
        isRead: false,
        targetPost: {
          id: String(newPost.id),
          contentSnippet: newPost.content,
          image: newPost.image || null
        },
        aiStatus: {
          label,
          confidence: newPost?.aiStatus?.confidence || 0.95,
          action: 'hide'
        }
      });
    }

    const postId = String(newPost?.id || '');
    const alreadyAdded = !postId || createdPostIdsRef.current.has(postId);
    if (alreadyAdded) return;
    createdPostIdsRef.current.add(postId);
    setPosts(prev => prependCreatedPost(prev, newPost));
    setCurrentUser(prev => incrementPostCountOnce(prev, newPost, alreadyAdded));
  };

  const handleRequireLogin = () => {
    window.alert('Vui lòng đăng nhập để tiếp tục');
  };

  // Thả tim / Bỏ thích bài viết
  const handleToggleLike = (postId) => {
    if (!currentUser) {
      handleRequireAuth("Vui lòng đăng nhập để tương tác bài viết");
      return;
    }
    setPosts(prev => prev.map(post => {
      if (String(post.id) === String(postId)) {
        const isLiked = !post.isLiked;
        return {
          ...post,
          isLiked,
          myReaction: isLiked ? (post.myReaction || 'like') : null,
          likesCount: isLiked ? (post.likesCount || 0) + 1 : Math.max(0, (post.likesCount || 0) - 1)
        };
      }
      return post;
    }));
  };

  const handleUpdatePost = async (postId, changes) => {
    if (Array.isArray(changes?.comments)) {
      setPosts((previous) => previous.map((post) => String(post.id) === String(postId)
        ? replacePostComments(post, changes.comments, changes.commentsCount)
        : post));
      return changes;
    }
    if (changes?.imageModeration || changes?.commentModeration) {
      setPosts((previous) => previous.flatMap((post) => {
        if (String(post.id) !== String(postId)) return [post];
        if (changes.imageModeration) {
          if (changes.imageModeration.status === 'rejected_final') return [];
          return [{ ...post, imageModeration: changes.imageModeration }];
        }
        const { id: commentId, ...commentChanges } = changes.commentModeration;
        return [{
          ...post,
          comments: (post.comments || []).map((comment) => String(comment.id) === String(commentId)
            ? { ...comment, ...commentChanges }
            : comment),
        }];
      }));
      return changes;
    }
    if (!currentUser?.id) {
      handleRequireAuth("Vui lòng đăng nhập để tiếp tục");
      throw new Error('Vui lòng đăng nhập để tiếp tục');
    }

    try {
      const result = await updatePost({
        userId: currentUser.id,
        postId,
        content: changes.content,
        imageUrl: changes.imageUrl,
      });
      const updatedPost = result.data;
      setPosts(prev => applyUpdatedPostToList(prev, markEditPostNotice(updatedPost)));
      return updatedPost;
    } catch (error) {
      if (error.status === 404) {
        setPosts(prev => prev.map(post => (
          String(post.id) === String(postId) ? markDeletedPostNotice(post, 'Bài viết không tồn tại') : post
        )));
        throw new Error('Bài viết không tồn tại');
      }
      throw new Error(error.message || 'Cập nhật bài viết thất bại');
    }
  };

  const handleDeleteOwnPost = async (postId) => {
    if (!currentUser?.id) {
      handleRequireAuth("Vui lòng đăng nhập để tiếp tục");
      throw new Error('Vui lòng đăng nhập để tiếp tục');
    }

    try {
      await runPostDeleteAction({
        deleteRequest: () => deletePost({ userId: currentUser.id, postId }),
        onSuccess: () => setPosts(prev => prev.map(post => (
          String(post.id) === String(postId) ? markDeletedPostNotice(post) : post
        ))),
      });
    } catch (error) {
      throw new Error(error.message || 'Xóa bài viết thất bại');
    }
  };

  // Chia sẻ bài viết — thêm bài chia sẻ lên đầu Feed
  const handleSharePost = (newSharedPost) => {
    if (newSharedPost) {
      setPosts((prev) => [newSharedPost, ...prev]);
    }
  };

  // Thêm bình luận vào bài viết (Lưu trực tiếp vào Supabase)
  const handleAddComment = async (postId, newComment, options = {}) => {
    if (!currentUser) {
      handleRequireAuth("Chỉ đăng nhập mới được bình luận (User Story 5)");
      return;
    }
    const commentKey = `${postId}:${newComment.id || `${newComment.content || ''}:${newComment.image || ''}`}`;
    if (pendingCommentKeysRef.current.has(commentKey)) return;
    pendingCommentKeysRef.current.add(commentKey);
    try {
      const res = await createComment({
        userId: currentUser.id,
        postId,
        content: newComment.content || '',
        imageUrl: newComment.image || null,
        forceComment: Boolean(options?.forceComment),
      });

      // Nhận Friendly Nudge từ server cho bình luận
      if (res.nudge) {
        return { nudge: true, message: res.message, content: newComment.content };
      }
      if (res.cooldown) {
        const cooldownData = {
          status: 'cooldown',
          cooldown_until: res.cooldown.cooldown_until,
          cooldownUntil: res.cooldown.cooldown_until,
          cooldown_reason: res.cooldown.cooldown_reason || res.cooldown.reason
        };
        authService.updateCurrentUser(cooldownData);
        setCurrentUser(prev => ({
          ...prev,
          ...cooldownData
        }));
      }
      const savedComment = res.data || newComment;
      setPosts(prev => prev.map(post => String(post.id) === String(postId)
        ? appendCreatedComment(post, savedComment)
        : post));
    } catch (err) {
      if (err.cooldown) {
        const cooldownData = {
          status: 'cooldown',
          cooldown_until: err.cooldown.cooldown_until,
          cooldownUntil: err.cooldown.cooldown_until,
          cooldown_reason: err.cooldown.cooldown_reason || err.cooldown.reason
        };
        authService.updateCurrentUser(cooldownData);
        setCurrentUser(prev => ({
          ...prev,
          ...cooldownData
        }));
      }
      console.error('Lỗi lưu bình luận vào Supabase:', err);
    } finally {
      pendingCommentKeysRef.current.delete(commentKey);
    }
  };


  // ========================================================
  // XỬ LÝ BÁO CÁO NGƯỜI DÙNG (REPORTS)
  // ========================================================
  const handleOpenReportModal = (target) => {
    setReportTarget(target);
  };

  const handleSubmitReport = async (reportData) => {
    // 1. Cập nhật state lạc quan (optimistic)
    setReports(prev => [reportData, ...prev]);

    // 2. Lưu trực tiếp vào CSDL PostgreSQL thật
    try {
      const res = await createReportApi({
        reporter: {
          id: currentUser?.id || reportData.reporter?.id,
          name: currentUser?.full_name || currentUser?.name || 'Người dùng'
        },
        targetType: reportData.targetType,
        targetId: reportData.targetId,
        targetAuthor: reportData.targetAuthor,
        contentExcerpt: reportData.contentExcerpt || reportData.targetExcerpt,
        reason: reportData.reason,
        reasonLabel: reportData.reasonLabel,
        details: reportData.details
      }, currentUser?.id);

      if (res?.data) {
        setReports(prev => prev.map(r => r.id === reportData.id ? res.data : r));
      }
      await loadModerationData();
    } catch (err) {
      console.warn('Lỗi gửi báo cáo lên API CSDL:', err.message);
    }

    // Gửi thông báo hệ thống xác nhận cho người báo cáo
    const notif = {
      id: `notif-${Date.now()}`,
      type: 'report_receipt',
      isReceipt: true,
      user: {
        name: 'Thông báo hệ thống',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'
      },
      content: `Báo cáo của bạn về nội dung của ${reportData.targetAuthor?.name || 'thành viên'} đã được tiếp nhận và chuyển đến Quản trị viên.`,
      createdAt: new Date().toISOString(),
      time: 'Vừa xong',
      isRead: false
    };
    addLocalNotification(notif);
  };

  const handleResolveReport = async (reportId, resolution, legacyNotes) => {
    // Chuẩn hóa tham số: hỗ trợ cả dạng object { status, newLabel, oldLabel, adminNotes } và dạng legacy
    const status = typeof resolution === 'object' ? resolution.status : resolution;
    const adminNotes = typeof resolution === 'object' ? resolution.adminNotes : legacyNotes;
    const newLabel = typeof resolution === 'object' ? resolution.newLabel : 'Toxic';
    const oldLabel = typeof resolution === 'object' ? resolution.oldLabel : 'Normal';

    // 1. Cập nhật state danh sách báo cáo lạc quan
    setReports(prev => prev.map(r => {
      if (r.id === reportId) {
        return { 
          ...r, 
          status, 
          adminNotes,
          newLabel: status === 'resolved_violation' ? newLabel : (r.newLabel || oldLabel),
          actionTaken: status === 'resolved_violation' ? 'relabel_and_hide' : 'dismissed_keep_original_label'
        };
      }
      return r;
    }));

    const report = reports.find(r => r.id === reportId);

    // 2. PHÂN NHÁNH XỬ LÝ TRÊN FEED BÀI VIẾT:
    if (status === 'resolved_violation') {
      if (newLabel === 'Normal') {
        // Chuyển về trạng thái bình thường: Khôi phục hiển thị & bỏ ẩn
        if (report && report.targetType === 'post') {
          setPosts(prev => prev.map(p => (String(p.id) === String(report.targetId) || `post-${p.id}` === String(report.targetId)) ? { ...p, isHidden: false, isSoftHidden: false, ai_status: 'approved', ai_label: 'Normal' } : p));
        } else if (report && report.targetType === 'comment') {
          setPosts(prev => prev.map(p => ({
            ...p,
            comments: (p.comments || []).map(c => (String(c.id) === String(report.targetId) || String(c._id) === String(report.targetId)) ? { ...c, isHidden: false, is_hidden: false, isSoftHidden: false, ai_status: 'approved', ai_label: 'Normal' } : c)
          })));
        }

        // Nghiệp vụ: Chuyển về Normal -> Gỡ toàn bộ án phạt cho tác giả nếu trùng currentUser
        const targetAuthorId = report?.targetAuthor?.id || report?.authorId;
        if (currentUser && targetAuthorId && currentUser.id === targetAuthorId) {
          setCurrentUser(prev => ({
            ...prev,
            status: 'active',
            cooldownUntil: null,
            cooldown_until: null,
            cooldownReason: null,
            cooldown_reason: null,
            cooldownViolationText: null,
            cooldown_violation_text: null
          }));
        }
      } else {
        // BÁO CÁO ĐÚNG: Gán lại nhãn vi phạm (Toxic / Hate Speech / Violence) & ẩn nội dung
        if (report && report.targetType === 'post') {
          setPosts(prev => prev.map(p => (String(p.id) === String(report.targetId) || `post-${p.id}` === String(report.targetId)) ? { ...p, isHidden: true, ai_status: 'hidden', ai_label: newLabel } : p));
        } else if (report && report.targetType === 'comment') {
          setPosts(prev => prev.map(p => ({
            ...p,
            comments: (p.comments || []).map(c => (String(c.id) === String(report.targetId) || String(c._id) === String(report.targetId)) ? { ...c, isHidden: true, is_hidden: true, ai_status: 'hidden', ai_label: newLabel } : c)
          })));
        }

        // Tự động gửi thông báo xử phạt tới tác giả bài viết để tác giả có thể bấm "Gửi kháng cáo"
        addLocalNotification({
          id: `notif-admin-sanction-${Date.now()}`,
          type: 'ai_moderation',
          user: {
            id: 'admin_moderator',
            name: 'Thông báo hệ thống',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'
          },
          content: `Nội dung của bạn đã bị Quản trị viên gắn nhãn vi phạm (${newLabel}) sau khi xác minh báo cáo và đã bị ẩn. Bạn có thể gửi đơn kháng cáo nếu cho rằng quyết định này chưa chuẩn xác.`,
          time: 'Vừa xong',
          isRead: false,
          targetPostId: report?.targetId,
          targetPost: {
            id: String(report?.targetId || ''),
            contentSnippet: report?.contentExcerpt || report?.targetExcerpt || 'Nội dung bị báo cáo',
            image: report?.imageUrl || null
          },
          aiStatus: {
            label: newLabel,
            confidence: 1.0,
            action: 'hide'
          }
        });

        const targetAuthorId = report?.targetAuthor?.id || report?.authorId;
        if (currentUser && targetAuthorId && currentUser.id === targetAuthorId) {
          if (newLabel === 'Violence') {
            const cdUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            setCurrentUser(prev => ({
              ...prev,
              status: 'cooldown',
              cooldownUntil: cdUntil,
              cooldown_until: cdUntil,
              cooldownReason: 'Vi phạm bạo lực trong nội dung (Báo cáo vi phạm đã được xác minh)',
              cooldown_reason: 'Vi phạm bạo lực trong nội dung (Báo cáo vi phạm đã được xác minh)',
              cooldownViolationText: report?.contentExcerpt,
              cooldown_violation_text: report?.contentExcerpt
            }));
          } else {
            // Chuyển sang Hate Speech hoặc Toxic -> Gỡ cooldown nếu từng bị cooldown do nhãn Violence cũ
            setCurrentUser(prev => prev.status === 'cooldown' ? ({
              ...prev,
              status: 'active',
              cooldownUntil: null,
              cooldown_until: null,
              cooldownReason: null,
              cooldown_reason: null,
              cooldownViolationText: null,
              cooldown_violation_text: null
            }) : prev);
          }
        }
      }

      // Tạo bản ghi trong Nhật ký hiệu chỉnh nhãn AI (aiOverrides) để xuất file
      const newOverride = {
        id: `ovr-${Date.now()}`,
        adminName: currentUser?.full_name || currentUser?.name || 'Điều Hành Viên Hệ Thống',
        contentType: report?.targetType || 'post',
        contentId: report?.targetId || reportId,
        rawText: report?.contentExcerpt || report?.targetExcerpt || report?.imageUrl || 'Nội dung vi phạm',
        imageUrl: report?.imageUrl || null,
        originalAiLabel: oldLabel || report?.aiStatus?.label || 'Normal',
        correctedLabel: newLabel,
        overrideReason: adminNotes || `Xác nhận vi phạm từ báo cáo (${report?.reasonLabel || report?.reason || 'Báo cáo vi phạm'}): Gán lại nhãn ${newLabel}`,
        isExportedForRetraining: false,
        createdAt: new Date().toLocaleString('vi-VN')
      };
      setAiOverrides(prev => [newOverride, ...prev]);

      // Đồng bộ tới backend server CSDL thật
      try {
        await resolveReportApi({
          reportId,
          status,
          newLabel,
          oldLabel,
          adminNotes,
          userId: currentUser?.id
        });
        await loadModerationData();
      } catch (e) {
        console.warn('Lỗi gọi API resolveReportApi:', e.message);
      }
    } else {
      // BÁO CÁO SAI: Giữ nguyên nhãn cũ hoặc khôi phục hiển thị nội dung nếu trước đó từng bị ẩn nhầm!
      if (report && report.targetType === 'post') {
        setPosts(prev => prev.map(p => (String(p.id) === String(report.targetId) || `post-${p.id}` === String(report.targetId)) ? { ...p, isHidden: false, isSoftHidden: false, ai_status: 'approved', ai_label: 'Normal' } : p));
      } else if (report && report.targetType === 'comment') {
        setPosts(prev => prev.map(p => ({
          ...p,
          comments: (p.comments || []).map(c => (String(c.id) === String(report.targetId) || String(c._id) === String(report.targetId)) ? { ...c, isHidden: false, is_hidden: false, isSoftHidden: false, ai_status: 'approved', ai_label: 'Normal' } : c)
        })));
      }

      try {
        await resolveReportApi({
          reportId,
          status: 'dismissed',
          adminNotes,
          userId: currentUser?.id
        });
        await loadModerationData();
      } catch (e) {
        console.warn('Lỗi gọi API resolveReportApi:', e.message);
      }
    }
  };

  // ========================================================
  // XỬ LÝ KHIẾU NẠI KIỂM DUYỆT AI (APPEALS & FALSE POSITIVES)
  // ========================================================
  const handleOpenAppealModal = (item) => {
    setAppealItem(item);
  };

  const handleSubmitAppeal = async (appealData) => {
    setAppeals(prev => [appealData, ...prev]);

    // Cập nhật trạng thái appeal trên bài viết
    setPosts(prev => prev.map(p => {
      if (String(p.id) === String(appealData.contentId) || `post-${p.id}` === String(appealData.contentId)) {
        return {
          ...p,
          appeal: {
            id: appealData.id,
            status: 'pending',
            userReason: appealData.appealReason,
            createdAt: 'Vừa xong'
          }
        };
      }
      return p;
    }));

    // Lưu vào CSDL PostgreSQL thật qua API
    try {
      const res = await createAppealApi({
        user: {
          id: currentUser?.id || appealData.user?.id,
          name: currentUser?.full_name || currentUser?.name || 'Người dùng'
        },
        contentType: appealData.contentType,
        contentId: appealData.contentId,
        originalText: appealData.originalText,
        aiPredictedLabel: appealData.aiPredictedLabel,
        aiConfidence: appealData.aiConfidence,
        aiActionTaken: appealData.aiActionTaken,
        appealReason: appealData.appealReason
      }, currentUser?.id);
      if (res?.data) {
        setAppeals(prev => prev.map(a => a.id === appealData.id ? res.data : a));
      }
      await loadModerationData();
    } catch (err) {
      console.warn('Lỗi gửi khiếu nại lên CSDL PostgreSQL:', err.message);
    }

    // Thông báo cho user
    const notif = {
      id: `notif-${Date.now()}`,
      type: 'system',
      user: {
        name: 'Thông báo hệ thống',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'
      },
      content: 'Đơn khiếu nại kiểm duyệt của bạn đã được gửi. Quản trị viên sẽ kiểm tra ngữ cảnh thủ công sớm nhất.',
      createdAt: new Date().toISOString(),
      time: 'Vừa xong',
      isRead: false
    };
    addLocalNotification(notif);
  };

  const handleResolveAppeal = async (appealId, statusOrData, adminNotesArg, newLabelArg) => {
    let status = statusOrData;
    let adminNotes = adminNotesArg;
    let newLabel = newLabelArg || 'Normal';

    if (typeof statusOrData === 'object' && statusOrData !== null) {
      status = statusOrData.status;
      adminNotes = statusOrData.adminNotes;
      newLabel = statusOrData.newLabel || 'Normal';
    }

    const appeal = appeals.find(a => String(a.id) === String(appealId));
    if (!appeal) return;

    // Cập nhật trạng thái đơn khiếu nại
    setAppeals(prev => prev.map(a => String(a.id) === String(appealId) ? { ...a, status, adminNotes, newLabel: status === 'approved' ? newLabel : null } : a));

    // Nếu chấp thuận khiếu nại (Approved):
    if (status === 'approved') {
      const isNormal = newLabel === 'Normal';
      const isHidden = !isNormal;

      // 1. Phục hồi bài viết hoặc bình luận
      if (appeal.contentType === 'comment') {
        setPosts(prev => prev.map(p => {
          const updatedComments = (p.comments || []).map(c => {
            if (String(c.id) === String(appeal.contentId) || String(c._id) === String(appeal.contentId)) {
              return {
                ...c,
                isHidden,
                is_hidden: isHidden,
                isSoftHidden: isHidden,
                ai_label: newLabel,
                ai_status: isNormal ? 'approved' : 'hidden',
                aiStatus: { label: newLabel, confidence: 0.99 },
                appeal: { ...c.appeal, status: 'approved' }
              };
            }
            return c;
          });
          return { ...p, comments: updatedComments };
        }));
      } else {
        setPosts(prev => prev.map(p => {
          if (String(p.id) === String(appeal.contentId) || `post-${p.id}` === String(appeal.contentId)) {
            return {
              ...p,
              isHidden,
              is_hidden: isHidden,
              isSoftHidden: isHidden,
              ai_label: newLabel,
              ai_status: isNormal ? 'approved' : 'hidden',
              aiStatus: { label: newLabel, confidence: 0.99 },
              appeal: { ...p.appeal, status: 'approved' }
            };
          }
          return p;
        }));
      }

      // 2. Nghiệp vụ án phạt theo nhãn:
      const targetUserId = appeal.user?.id || appeal.userId;
      if (targetUserId) {
        if (newLabel === 'Violence') {
          // Phạt cooldown 10 phút
          if (currentUser && currentUser.id === targetUserId) {
            const cooldownUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            setCurrentUser(prev => ({
              ...prev,
              status: 'cooldown',
              cooldownUntil,
              cooldown_until: cooldownUntil,
              cooldownReason: 'Vi phạm bạo lực trong nội dung (Khiếu nại được thẩm định lại)'
            }));
          }
        } else {
          // Normal hoặc Toxic hoặc Hate Speech: Gỡ bỏ cooldown
          try {
            await updateUserSanctionApi({
              targetUserId,
              action: 'clear_cooldown'
            });
          } catch (err) {
            console.error('Lỗi khi gỡ cooldown:', err);
          }

          if (currentUser && currentUser.id === targetUserId) {
            setCurrentUser(prev => ({
              ...prev,
              status: 'active',
              cooldownUntil: null,
              cooldown_until: null,
              cooldownReason: null,
              cooldown_reason: null,
              cooldownViolationText: null,
              cooldown_violation_text: null
            }));
          }
        }
      }

      // 3. Ghi nhận vào tập dữ liệu hiệu chỉnh AI (Active Learning)
      const newOverride = {
        id: `ovr-${Date.now()}`,
        adminName: `${currentUser?.name || currentUser?.full_name || 'Admin'} (Admin)`,
        contentType: appeal.contentType || 'post',
        contentId: appeal.contentId,
        rawText: appeal.originalText,
        originalAiLabel: appeal.aiPredictedLabel || 'Toxic',
        originalConfidence: appeal.aiConfidence || 0.90,
        correctedLabel: newLabel,
        overrideReason: adminNotes || (newLabel === 'Normal' ? `Minh oan thành công: ${appeal.appealReason}` : `Hiệu chỉnh nhãn sang ${newLabel}`),
        isExportedForRetraining: false,
        createdAt: 'Vừa xong'
      };
      setAiOverrides(prev => [newOverride, ...prev]);

      // 4. Gửi thông báo
      const notifMsg = newLabel === 'Normal'
        ? `Khiếu nại được chấp thuận! Nội dung "${(appeal.originalText || '').slice(0, 40)}..." đã được xác nhận an toàn (Normal), án phạt được gỡ bỏ ngay lập tức.`
        : `Nội dung của bạn sau khi xem xét lại được chuyển sang nhãn "${newLabel}".`;
      const apologyNotif = {
        id: `notif-${Date.now()}`,
        type: 'system',
        user: {
          name: 'Thông báo hệ thống',
          avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'
        },
        content: notifMsg,
        createdAt: new Date().toISOString(),
        time: 'Vừa xong',
        isRead: false
      };
      addLocalNotification(apologyNotif);
    } else {
      // Nếu từ chối khiếu nại (bác bỏ)
      if (appeal.contentType === 'comment') {
        setPosts(prev => prev.map(p => {
          const updatedComments = (p.comments || []).map(c => {
            if (String(c.id) === String(appeal.contentId) || String(c._id) === String(appeal.contentId)) {
              return {
                ...c,
                appeal: { ...c.appeal, status: 'rejected' }
              };
            }
            return c;
          });
          return { ...p, comments: updatedComments };
        }));
      } else {
        setPosts(prev => prev.map(p => {
          if (String(p.id) === String(appeal.contentId) || `post-${p.id}` === String(appeal.contentId)) {
            return {
              ...p,
              appeal: { ...p.appeal, status: 'rejected' }
            };
          }
          return p;
        }));
      }
    }

    // Gửi yêu cầu cập nhật lên CSDL PostgreSQL thật
    try {
      const res = await resolveAppealApi({
        appealId,
        status,
        newLabel,
        adminNotes,
        userId: currentUser?.id
      });
      await loadModerationData();
      return res;
    } catch (err) {
      console.warn('Lỗi gọi resolveAppealApi:', err.message);
      throw err;
    }
  };

  // ========================================================
  // QUẢN TRỊ VIÊN HIỆU CHỈNH NHÃN AI TRỰC TIẾP (LABEL OVERRIDE)
  // ========================================================
  const handleOverrideAiLabel = ({ contentType, contentId, rawText, originalAiLabel, correctedLabel, overrideReason }) => {
    // 1. Cập nhật bài viết
    if (contentType === 'post') {
      setPosts(prev => prev.map(p => {
        if (p.id === contentId) {
          return {
            ...p,
            aiStatus: {
              label: correctedLabel,
              confidence: 0.99,
              overriddenByAdmin: true
            }
          };
        }
        return p;
      }));
    }

    // 2. Thêm vào danh sách Retraining Logs
    const newLog = {
      id: `ovr-${Date.now()}`,
      adminName: `${currentUser.name} (Admin)`,
      contentType,
      contentId,
      rawText,
      originalAiLabel,
      originalConfidence: 0.95,
      correctedLabel,
      overrideReason,
      isExportedForRetraining: false,
      createdAt: 'Vừa xong'
    };
    setAiOverrides(prev => [newLog, ...prev]);
  };

  // Cập nhật trạng thái tài khoản người dùng (Active / Cooldown / Banned)
  const handleUpdateUserStatus = (userId, status, details = null) => {
    setUsersList(prev => prev.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          status,
          bannedReason: status === 'banned' ? (details || 'Vi phạm quy tắc cộng đồng: phát tán nội dung độc hại') : null,
          cooldownUntil: status === 'cooldown' ? (details || 'Tạm khóa 24 giờ') : null
        };
      }
      return u;
    }));

    // Gửi thông báo hệ thống nếu là tài khoản đang đăng nhập
    if (userId === currentUser.id && status !== 'active') {
      const notif = {
        id: `notif-${Date.now()}`,
        type: 'system',
        user: { name: 'Thông báo hệ thống', avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200' },
        content: `Tài khoản của bạn vừa bị cập nhật trạng thái: ${status === 'banned' ? 'Khóa vĩnh viễn' : 'Tạm khóa Cooldown'}.`,
        time: 'Vừa xong',
        isRead: false
      };
      addLocalNotification(notif);
    }
  };

  // Cập nhật vai trò người dùng (ADMIN / MODERATOR / USER)
  const handleUpdateUserRole = (userId, newRole) => {
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    if (userId === currentUser.id) {
      setCurrentUser(prev => ({ ...prev, role: newRole, isAdmin: newRole === 'ADMIN' }));
    }
  };

  // Ẩn / Khôi phục hiển thị bài viết
  const handleToggleHidePost = (postId) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isHidden: !p.isHidden } : p));
  };

  // Xóa bài viết
  const handleDeletePost = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };


  // Mở đoạn chat từ trang Bạn bè hoặc Trang cá nhân người khác
  const handleOpenChatFromFriends = (user) => {
    if (!currentUser) {
      handleRequireAuth("Vui lòng đăng nhập để sử dụng tính năng nhắn tin");
      return;
    }
    const userPayload = {
      id: user.id || user.user_id,
      name: user.name || user.full_name,
      username: user.username,
      avatar: user.avatar || user.avatar_url,
      _ts: Date.now()
    };
    setSelectedChatUser(userPayload);
    setSelectedChatUserId(userPayload.id);
    setActiveTab('messages');
  };

  return (
    <div className={`bg-slate-100/80 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-500 selection:text-white flex flex-col font-sans transition-colors duration-200 ${activeTab === 'messages' ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>


      {/* Thanh điều hướng chính */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange}
        unreadCount={unreadCount}
        unreadMessagesCount={1}
        pendingModerationCount={pendingModerationCount}
        onOpenAiLab={() => setIsAiModalOpen(true)}
        currentUser={currentUser}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenAuthModal={(tab) => {
          setAuthModalTab(tab);
          setAuthNoticeMessage('');
          setIsAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        postsCount={countVisiblePosts(posts.filter(p => p.author?.id === currentUser?.id))}
        onOpenProfile={handleOpenUserProfile}
        onSearchPosts={(query) => {
          setHomeSearchQuery(query);
          setActiveTab('home');
        }}
        clientPosts={posts}
        activeFilterQuery={homeSearchQuery}
        onClearFilter={() => setHomeSearchQuery('')}
        onRefreshHome={handleRefreshHome}
        isLoadingPosts={isLoadingPosts}
      />

      {/* Vùng hiển thị nội dung theo Tab */}
      <div className={`flex-1 min-h-0 ${activeTab === 'admin' ? 'pb-6' : activeTab === 'messages' ? 'pb-0 flex flex-col h-full overflow-hidden' : 'pb-16'}`}>
        
        {/* Tab 1: Trang chủ / News Feed */}
        {activeTab === 'home' && (
          <HomeView 
            currentUser={currentUser}
            posts={posts.filter(p => !isHardHiddenPost(p))}
            onAddPost={handleAddPost}
            onToggleLike={handleToggleLike}
            onAddComment={handleAddComment}
            setActiveTab={handleTabChange}
            onOpenAiLab={() => setIsAiModalOpen(true)}
            onOpenReportModal={handleOpenReportModal}
            onOpenAppealModal={handleOpenAppealModal}
            onRequireAuth={handleRequireAuth}
            onOpenAuthModal={(tab) => {
              setAuthModalTab(tab);
              setAuthNoticeMessage('');
              setIsAuthModalOpen(true);
            }}
            onRequireLogin={handleRequireLogin}
            feedWarning={feedWarning}
            onOpenProfile={handleOpenUserProfile}
            onEditPost={handleUpdatePost}
            onDeletePost={handleDeleteOwnPost}
            openPostMenuId={openPostMenuId}
            onTogglePostMenu={handleTogglePostMenu}
            onClosePostMenu={handleClosePostMenu}
            onDismissNotice={handleDismissPostNotice}
            searchQuery={homeSearchQuery}
            onClearSearch={() => setHomeSearchQuery('')}
            onSelectHashtag={(tag) => {
              setHomeSearchQuery(tag);
              setActiveTab('home');
            }}
            onSharePost={handleSharePost}
            focusedPostTarget={focusedPostTarget}
            isLoadingPosts={isLoadingPosts}
            onRefreshFeed={handleRefreshHome}
            refreshKey={feedRefreshKey}
          />
        )}

        {/* Tab Xem chi tiết bài viết chuyên biệt (khi bấm vào thông báo) */}
        {activeTab === 'post' && viewedPostDetail && (
          <PostDetailView
            postId={viewedPostDetail.postId}
            post={posts.find((item) => String(item.id) === String(viewedPostDetail.postId)) || viewedPostDetail.post}
            meta={viewedPostDetail.meta}
            currentUser={currentUser}
            onBack={() => {
              const backTarget = viewedPostDetail.previousTab || 'notifications';
              handleTabChange(backTarget);
              setViewedPostDetail(null);
            }}
            allPosts={posts}
            onUpdatePost={handleUpdatePost}
            onToggleLike={handleToggleLike}
            onAddComment={handleAddComment}
            onOpenReportModal={handleOpenReportModal}
            onOpenAppealModal={handleOpenAppealModal}
            onRequireAuth={handleRequireAuth}
            onRequireLogin={handleRequireLogin}
            onOpenProfile={handleOpenUserProfile}
            onEditPost={handleUpdatePost}
            onDeletePost={async (delPostId) => {
              await handleDeleteOwnPost(delPostId);
              handleTabChange(viewedPostDetail.previousTab || 'notifications');
            }}
            openPostMenuId={openPostMenuId}
            onTogglePostMenu={handleTogglePostMenu}
            onClosePostMenu={handleClosePostMenu}
            onDismissNotice={handleDismissPostNotice}
            onSharePost={handleSharePost}
          />
        )}

        {/* Tab 2: Bạn bè */}
        {activeTab === 'friends' && (
          <FriendsView 
            onOpenChat={handleOpenChatFromFriends} 
            onOpenProfile={handleOpenUserProfile}
          />
        )}

        {/* Tab 3: Tin nhắn (Hỗ trợ báo cáo tin nhắn) */}
        {activeTab === 'messages' && (
          <MessagesView 
            currentUser={currentUser} 
            initialChatUser={selectedChatUser}
            initialChatUserId={selectedChatUserId} 
            onOpenReportModal={handleOpenReportModal}
            onRequireAuth={handleRequireAuth}
            onOpenProfile={handleOpenUserProfile}
          />
        )}

        {/* Tab 4: Thông báo */}
        {activeTab === 'notifications' && (
          <NotificationsView 
            currentUser={currentUser}
            onOpenAppealModal={handleOpenAppealModal}
            notifications={notifications}
            onMarkAllAsRead={handleMarkAllAsRead}
            onMarkAsRead={handleMarkAsRead}
            onDeleteNotification={handleDeleteNotification}
            onClearReadNotifications={handleClearReadNotifications}
            onRefresh={() => refreshNotifications(notifFilter, true)}
            isLoading={notifLoading}
            onOpenProfile={handleOpenUserProfile}
            activeFilter={notifFilter}
            onFilterChange={setNotifFilter}
            onViewPost={handleViewPost}
          />
        )}

        {/* Tab 5: Trang cá nhân */}
        {activeTab === 'profile' && (
          <ProfileView 
            currentUser={currentUser}
            viewedUser={viewedProfileUser}
            posts={posts.filter(p => !p.inlineNotice)}
            onAddPost={handleAddPost}
            onToggleLike={handleToggleLike}
            onAddComment={handleAddComment}
            onUpdateUser={handleUpdateUser}
            onOpenSettings={() => setActiveTab('settings')}
            onOpenChat={handleOpenChatFromFriends}
            onOpenUserProfile={handleOpenUserProfile}
            onRequireAuth={handleRequireAuth}
            onSharePost={handleSharePost}
            onOpenReportModal={handleOpenReportModal}
            onOpenAppealModal={handleOpenAppealModal}
            onEditPost={handleUpdatePost}
            onDeletePost={handleDeleteOwnPost}
          />
        )}

        {/* Tab 6: BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN (ADMIN DASHBOARD) */}
        {activeTab === 'admin' && (
          hasRole(currentUser, ROLES.ADMIN) ? (
            <AdminDashboardView 
              currentUser={currentUser}
              onNavigateToModeration={() => handleTabChange('moderation')}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-lg border border-slate-200 text-center">
              <h2 className="text-base font-semibold text-slate-900">Không có quyền truy cập (403)</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Khu vực quản trị chỉ dành riêng cho tài khoản quản trị viên.
              </p>
              <button
                onClick={() => handleTabChange(getDefaultTabForUser(currentUser))}
                className="mt-4 h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition cursor-pointer"
              >
                Về trang phù hợp
              </button>
            </div>
          )
        )}

        {/* Tab 6.1: KHU VỰC KIỂM DUYỆT (MODERATOR VIEW) */}
        {activeTab === 'moderation' && (
          hasRole(currentUser, ROLES.MODERATOR) ? (
            <ModeratorView 
              isAdmin={hasRole(currentUser, ROLES.ADMIN)}
              onBackToAdmin={() => handleTabChange('admin')}
              appeals={appeals}
              onResolveAppeal={handleResolveAppeal}
              reports={reports}
              onResolveReport={handleResolveReport}
              aiOverrides={aiOverrides}
              posts={posts}
              onUnhidePost={(postId) => setPosts(prev => prev.map(p => p.id === postId ? { ...p, isHidden: false, isSoftHidden: false, ai_status: 'approved' } : p))}
              currentUser={currentUser}
              onRefresh={loadModerationData}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-lg border border-slate-200 text-center">
              <h2 className="text-base font-semibold text-slate-900">Không có quyền truy cập (403)</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Khu vực kiểm duyệt chỉ dành cho điều hành viên và quản trị viên.
              </p>
              <button
                onClick={() => handleTabChange(getDefaultTabForUser(currentUser))}
                className="mt-4 h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition cursor-pointer"
              >
                Về trang phù hợp
              </button>
            </div>
          )
        )}

        {/* Tab 7: TRUNG TÂM CÀI ĐẶT & KHIÊN AN TOÀN AI */}
        {activeTab === 'settings' && (
          <SettingsView 
            currentUser={currentUser}
            onUpdateUser={handleUpdateUser}
            theme={theme}
            onSetTheme={handleSetTheme}
            onToggleTheme={toggleTheme}
          />
        )}

      </div>

      {/* Modal Báo cáo người dùng vi phạm (Post, Comment, Message) */}
      <ReportModal 
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        target={reportTarget}
        currentUser={currentUser}
        onSubmitReport={handleSubmitReport}
      />

      {/* Modal Khiếu nại phán quyết AI gắn nhãn sai */}
      <AppealModal 
        isOpen={!!appealItem}
        onClose={() => setAppealItem(null)}
        contentItem={appealItem}
        currentUser={currentUser}
        onSubmitAppeal={handleSubmitAppeal}
      />

      {/* Modal thử nghiệm AI Lab */}
      <AiModerationModal 
        isOpen={isAiModalOpen} 
        onClose={() => setIsAiModalOpen(false)} 
      />

      {/* Modal Xác thực Đăng nhập & Đăng ký tài khoản (User Story 1, 2, 3) */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authModalTab}
        noticeMessage={authNoticeMessage}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
          setAuthNoticeMessage('');
          const targetTab = getDefaultTabForUser(user);
          handleTabChange(targetTab);
        }}
      />

      {/* Floating Notification Toast (Real-time pop-up) */}
      <NotificationToast 
        notification={toastNotification}
        onClose={() => setToastNotification(null)}
        onClick={() => {
          if (toastNotification?.snapshot?.type === 'moderation_removal') {
            handleTabChange('notifications');
            setToastNotification(null);
            return;
          }
          const targetId = getNotificationNavigationTarget(toastNotification);
          if (targetId) {
            handleViewPost(targetId, {
              type: toastNotification.type,
              actor: toastNotification.user,
              targetCommentId: toastNotification.targetCommentId || toastNotification.commentId,
              notificationId: toastNotification.id,
            });
          } else if (toastNotification?.user?.id && toastNotification.user?.id !== 'system') {
            handleOpenUserProfile(toastNotification.user);
          } else {
            handleTabChange('notifications');
          }
          setToastNotification(null);
        }}
      />

    </div>
  );
}

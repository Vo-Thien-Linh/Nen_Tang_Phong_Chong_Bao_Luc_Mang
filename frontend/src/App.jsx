import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HomeView from './components/HomeView';
import FriendsView from './components/FriendsView';
import MessagesView from './components/MessagesView';
import NotificationsView from './components/NotificationsView';
import ProfileView from './components/ProfileView';
import AdminDashboardView from './components/AdminDashboardView';
import SettingsView from './components/SettingsView';
import AiModerationModal from './components/AiModerationModal';
import ReportModal from './components/ReportModal';
import AppealModal from './components/AppealModal';
import AuthModal from './components/AuthModal';
import { authService } from './services/authService';
import { 
  currentUser as initialUser, 
  initialPosts, 
  initialNotifications, 
  initialReports, 
  initialAppeals, 
  initialAiOverrides,
  initialUsersList
} from './data/mockData';
import { fetchPosts, createComment, updatePost, deletePost } from './api/client';
import { applyUpdatedPostToList } from './utils/postActionLogic';
import { closePostMenu, togglePostMenu } from './utils/menuLogic';
import {
  clearPostNotice,
  countVisiblePosts,
  markDeletedPostNotice,
  markEditPostNotice,
  removeDeletedNotice,
} from './utils/noticeLogic';

const configuredUserId = import.meta.env.VITE_CURRENT_USER_ID?.trim();
const currentUserWithEnvId = configuredUserId
  ? { ...initialUser, id: configuredUserId }
  : initialUser;
const initialFeedWarning = !configuredUserId && import.meta.env.DEV
  ? 'Dev: thiếu VITE_CURRENT_USER_ID nên đang dùng dữ liệu mẫu.'
  : '';

export default function App() {
  // Trạng thái Xác thực người dùng (Auth)
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser() || currentUserWithEnvId);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login'); // 'login' | 'register'
  const [authNoticeMessage, setAuthNoticeMessage] = useState('');
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'friends' | 'messages' | 'notifications' | 'profile' | 'admin'
  const [posts, setPosts] = useState([]);
  const [openPostMenuId, setOpenPostMenuId] = useState(null);
  const [feedWarning, setFeedWarning] = useState(initialFeedWarning);
  const [notifications, setNotifications] = useState(initialNotifications);
  
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

  // Trạng thái modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null); // Đối tượng đang được mở modal báo cáo
  const [appealItem, setAppealItem] = useState(null);     // Nội dung đang được mở modal khiếu nại
  const [selectedChatUserId, setSelectedChatUserId] = useState(null);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [viewedProfileUser, setViewedProfileUser] = useState(null); // Xem trang cá nhân người khác
  const [homeSearchQuery, setHomeSearchQuery] = useState(''); // Bộ lọc tìm kiếm bài viết trang chủ

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

  // Đếm số thông báo chưa đọc
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Xử lý Chuyển Tab có Auth Guard
  const handleTabChange = (tab) => {
    if (!currentUser && (tab === 'messages' || tab === 'profile' || tab === 'admin' || tab === 'settings')) {
      const msg = tab === 'messages'
        ? "Vui lòng đăng nhập để sử dụng tính năng nhắn tin"
        : "Trường hợp chưa đăng nhập muốn thực hiện hành động đều chuyển về màn hình đăng nhập";
      setAuthNoticeMessage(msg);
      setAuthModalTab('login');
      setIsAuthModalOpen(true);
      return;
    }
    if (tab === 'profile') {
      setViewedProfileUser(null); // Reset về trang cá nhân của mình
    }
    setActiveTab(tab);
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
    setViewedProfileUser(user);
    setActiveTab('profile');
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

    if (!effectiveUserId) {
      if (import.meta.env.DEV) {
        console.warn('Missing userId; keeping mock feed and local fallback behavior.');
      }
      return () => {
        isMounted = false;
      };
    }

    fetchPosts({ userId: effectiveUserId })
      .then((result) => {
        if (isMounted && Array.isArray(result.data)) {
          setPosts(result.data);
          setFeedWarning('');
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
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  // Thêm bài viết mới
  const handleAddPost = (newPost) => {
    if (!currentUser) {
      handleRequireAuth("Chỉ đăng nhập rồi mới được đăng bài (User Story 4)");
      return;
    }
    setPosts(prev => [newPost, ...prev]);
    setCurrentUser(prev => ({
      ...prev,
      postsCount: ((prev && prev.postsCount) || 0) + 1
    }));
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
      await deletePost({ userId: currentUser.id, postId });
      setPosts(prev => prev.map(post => (
        String(post.id) === String(postId) ? markDeletedPostNotice(post) : post
      )));
    } catch (error) {
      if (error.status === 404) {
        setPosts(prev => prev.map(post => (
          String(post.id) === String(postId) ? markDeletedPostNotice(post, 'Bài viết không tồn tại') : post
        )));
        throw new Error('Bài viết không tồn tại');
      }
      throw new Error(error.message || 'Xóa bài viết thất bại');
    }
  };

  // Thêm bình luận vào bài viết (Lưu trực tiếp vào Supabase)
  const handleAddComment = async (postId, newComment) => {
    if (!currentUser) {
      handleRequireAuth("Chỉ đăng nhập mới được bình luận (User Story 5)");
      return;
    }
    try {
      const res = await createComment({
        userId: currentUser.id,
        postId,
        content: newComment.content
      });
      const savedComment = res.data || newComment;
      setPosts(prev => prev.map(post => {
        if (String(post.id) === String(postId)) {
          return {
            ...post,
            comments: [...(post.comments || []), savedComment],
            commentsCount: (post.commentsCount || 0) + 1
          };
        }
        return post;
      }));
    } catch (err) {
      console.error('Lỗi lưu bình luận vào Supabase:', err);
    }
  };


  // ========================================================
  // XỬ LÝ BÁO CÁO NGƯỜI DÙNG (REPORTS)
  // ========================================================
  const handleOpenReportModal = (target) => {
    setReportTarget(target);
  };

  const handleSubmitReport = (reportData) => {
    setReports(prev => [reportData, ...prev]);

    // Gửi thông báo hệ thống xác nhận cho người báo cáo
    const notif = {
      id: `notif-${Date.now()}`,
      type: 'system',
      user: {
        name: 'Nexus Admin Shield',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'
      },
      content: `Báo cáo của bạn về nội dung của ${reportData.targetAuthor?.name || 'thành viên'} đã được tiếp nhận và chuyển đến Quản trị viên.`,
      time: 'Vừa xong',
      isRead: false
    };
    setNotifications(prev => [notif, ...prev]);
  };

  const handleResolveReport = (reportId, status, adminNotes) => {
    setReports(prev => prev.map(r => {
      if (r.id === reportId) {
        return { ...r, status, adminNotes };
      }
      return r;
    }));

    // Nếu xác nhận vi phạm -> Ẩn bài viết tương ứng (nếu là post)
    const report = reports.find(r => r.id === reportId);
    if (report && report.targetType === 'post' && status === 'resolved_violation') {
      setPosts(prev => prev.map(p => p.id === report.targetId ? { ...p, isHidden: true } : p));
    }
  };

  // ========================================================
  // XỬ LÝ KHIẾU NẠI KIỂM DUYỆT AI (APPEALS & FALSE POSITIVES)
  // ========================================================
  const handleOpenAppealModal = (item) => {
    setAppealItem(item);
  };

  const handleSubmitAppeal = (appealData) => {
    setAppeals(prev => [appealData, ...prev]);

    // Cập nhật trạng thái appeal trên bài viết
    setPosts(prev => prev.map(p => {
      if (p.id === appealData.contentId) {
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

    // Thông báo cho user
    const notif = {
      id: `notif-${Date.now()}`,
      type: 'system',
      user: {
        name: 'Nexus Appeals Team',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'
      },
      content: 'Đơn khiếu nại kiểm duyệt của bạn đã được gửi. Quản trị viên sẽ kiểm tra ngữ cảnh thủ công sớm nhất.',
      time: 'Vừa xong',
      isRead: false
    };
    setNotifications(prev => [notif, ...prev]);
  };

  const handleResolveAppeal = (appealId, status, adminNotes) => {
    const appeal = appeals.find(a => a.id === appealId);
    if (!appeal) return;

    // Cập nhật trạng thái đơn khiếu nại
    setAppeals(prev => prev.map(a => a.id === appealId ? { ...a, status, adminNotes } : a));

    // Nếu chấp thuận khiếu nại (Minh oan False Positive):
    if (status === 'approved') {
      // 1. Phục hồi bài viết: đổi nhãn thành Normal, bỏ ẩn
      setPosts(prev => prev.map(p => {
        if (p.id === appeal.contentId) {
          return {
            ...p,
            isHidden: false,
            aiStatus: { label: 'Normal', confidence: 0.99 },
            appeal: { ...p.appeal, status: 'approved' }
          };
        }
        return p;
      }));

      // 2. Ghi nhận vào tập dữ liệu hiệu chỉnh AI (Active Learning)
      const newOverride = {
        id: `ovr-${Date.now()}`,
        adminName: `${currentUser.name} (Admin)`,
        contentType: appeal.contentType,
        contentId: appeal.contentId,
        rawText: appeal.originalText,
        originalAiLabel: appeal.aiPredictedLabel,
        originalConfidence: appeal.aiConfidence,
        correctedLabel: 'Normal',
        overrideReason: `Giải quyết khiếu nại thành công: ${adminNotes || appeal.appealReason}`,
        isExportedForRetraining: false,
        createdAt: 'Vừa xong'
      };
      setAiOverrides(prev => [newOverride, ...prev]);

      // 3. Gửi thông báo chúc mừng / xin lỗi cho user
      const apologyNotif = {
        id: `notif-${Date.now()}`,
        type: 'system',
        user: {
          name: 'Nexus Support Admin',
          avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'
        },
        content: `Khiếu nại được chấp thuận! Nội dung "${appeal.originalText.slice(0, 40)}..." đã được xác nhận là AI False Positive và khôi phục về trạng thái an toàn.`,
        time: 'Vừa xong',
        isRead: false
      };
      setNotifications(prev => [apologyNotif, ...prev]);
    } else {
      // Nếu từ chối khiếu nại
      setPosts(prev => prev.map(p => {
        if (p.id === appeal.contentId) {
          return {
            ...p,
            appeal: { ...p.appeal, status: 'rejected' }
          };
        }
        return p;
      }));
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
        user: { name: 'Admin Security', avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200' },
        content: `Tài khoản của bạn vừa bị cập nhật trạng thái: ${status === 'banned' ? 'Khóa vĩnh viễn' : 'Tạm khóa Cooldown'}.`,
        time: 'Vừa xong',
        isRead: false
      };
      setNotifications(prev => [notif, ...prev]);
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

  // Đánh dấu tất cả thông báo đã đọc
  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleMarkAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleDeleteNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
      />

      {/* Vùng hiển thị nội dung theo Tab */}
      <div className={`flex-1 min-h-0 ${activeTab === 'admin' ? 'pb-6' : activeTab === 'messages' ? 'pb-0 flex flex-col h-full overflow-hidden' : 'pb-16'}`}>
        
        {/* Tab 1: Trang chủ / News Feed */}
        {activeTab === 'home' && (
          <HomeView 
            currentUser={currentUser}
            posts={posts.filter(p => !p.isHidden)}
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
            notifications={notifications}
            onMarkAllAsRead={handleMarkAllAsRead}
            onMarkAsRead={handleMarkAsRead}
            onDeleteNotification={handleDeleteNotification}
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
          />
        )}

        {/* Tab 6: BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN (ADMIN DASHBOARD) */}
        {activeTab === 'admin' && (
          (currentUser && (currentUser.role?.toLowerCase() === 'admin' || currentUser.isAdmin || currentUser.is_admin)) ? (
            <AdminDashboardView 
              posts={posts}
              reports={reports}
              appeals={appeals}
              aiOverrides={aiOverrides}
              usersList={usersList}
              onResolveReport={handleResolveReport}
              onResolveAppeal={handleResolveAppeal}
              onOverrideAiLabel={handleOverrideAiLabel}
              onToggleHidePost={handleToggleHidePost}
              onDeletePost={handleDeletePost}
              onUpdateUserStatus={handleUpdateUserStatus}
              onUpdateUserRole={handleUpdateUserRole}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 text-center shadow-xs">
              <h3 className="text-lg font-bold text-slate-800">Không có quyền truy cập</h3>
              <p className="text-sm text-slate-500 mt-2">
                Trang Admin Dashboard chỉ dành riêng cho tài khoản quản trị viên.
              </p>
              <button
                onClick={() => setActiveTab('home')}
                className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition cursor-pointer"
              >
                Quay về trang chủ
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
        }}
      />

    </div>
  );
}

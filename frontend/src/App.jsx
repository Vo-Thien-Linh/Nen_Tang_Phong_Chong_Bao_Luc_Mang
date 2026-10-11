import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import HomeView from './components/HomeView';
import FriendsView from './components/FriendsView';
import MessagesView from './components/MessagesView';
import NotificationsView from './components/NotificationsView';
import ProfileView from './components/ProfileView';
import AdminDashboardView from './components/AdminDashboardView';
import AiModerationModal from './components/AiModerationModal';
import ReportModal from './components/ReportModal';
import AppealModal from './components/AppealModal';
import { 
  currentUser as initialUser, 
  initialPosts, 
  initialNotifications, 
  initialReports, 
  initialAppeals, 
  initialAiOverrides,
  initialUsersList
} from './data/mockData';
import { fetchPosts } from './api/client';

export default function App() {
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'friends' | 'messages' | 'notifications' | 'profile' | 'admin'
  const [posts, setPosts] = useState(initialPosts);
  const [notifications, setNotifications] = useState(initialNotifications);
  
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

  // Số việc quản trị đang chờ xử lý
  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;
  const pendingAppealsCount = appeals.filter(a => a.status === 'pending').length;
  const pendingModerationCount = pendingReportsCount + pendingAppealsCount;

  // Đếm số thông báo chưa đọc
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    let isMounted = true;

    fetchPosts({ userId: currentUser?.id })
      .then((result) => {
        if (isMounted && Array.isArray(result.data)) {
          setPosts((prev) => {
            const mockPosts = prev.filter((post) => Number.isNaN(Number(post.id)));
            return [...result.data, ...mockPosts];
          });
        }
      })
      .catch(() => {
        // Giữ dữ liệu mock khi backend chưa chạy.
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  // Thêm bài viết mới
  const handleAddPost = (newPost) => {
    setPosts([newPost, ...posts]);
    setCurrentUser(prev => ({
      ...prev,
      postsCount: prev.postsCount + 1
    }));
  };

  const handleRequireLogin = () => {
    window.alert('Vui lòng đăng nhập để tiếp tục');
  };

  // Thả tim / Bỏ thích bài viết
  const handleToggleLike = (postId) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        return {
          ...post,
          isLiked,
          likesCount: isLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1)
        };
      }
      return post;
    }));
  };

  // Thêm bình luận vào bài viết
  const handleAddComment = (postId, newComment) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          comments: [...(post.comments || []), newComment]
        };
      }
      return post;
    }));
  };

  // Cập nhật thông tin profile
  const handleUpdateUser = (updatedFields) => {
    setCurrentUser(prev => ({
      ...prev,
      ...updatedFields
    }));
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

  // Mở đoạn chat từ trang Bạn bè
  const handleOpenChatFromFriends = (friend) => {
    setSelectedChatUserId(friend.id);
    setActiveTab('messages');
  };

  return (
    <div className={`bg-slate-100/80 text-slate-900 selection:bg-blue-500 selection:text-white flex flex-col font-sans ${activeTab === 'messages' ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      
      {/* Thanh điều hướng chính */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        unreadCount={unreadCount}
        unreadMessagesCount={1}
        pendingModerationCount={pendingModerationCount}
        onOpenAiLab={() => setIsAiModalOpen(true)}
        currentUser={currentUser}
        postsCount={posts.filter(p => p.author?.id === currentUser.id).length}
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
            setActiveTab={setActiveTab}
            onOpenAiLab={() => setIsAiModalOpen(true)}
            onOpenReportModal={handleOpenReportModal}
            onOpenAppealModal={handleOpenAppealModal}
            onRequireLogin={handleRequireLogin}
          />
        )}

        {/* Tab 2: Bạn bè */}
        {activeTab === 'friends' && (
          <FriendsView onOpenChat={handleOpenChatFromFriends} />
        )}

        {/* Tab 3: Tin nhắn (Hỗ trợ báo cáo tin nhắn) */}
        {activeTab === 'messages' && (
          <MessagesView 
            currentUser={currentUser} 
            initialChatUserId={selectedChatUserId} 
            onOpenReportModal={handleOpenReportModal}
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
            posts={posts}
            onAddPost={handleAddPost}
            onToggleLike={handleToggleLike}
            onAddComment={handleAddComment}
            onUpdateUser={handleUpdateUser}
          />
        )}

        {/* Tab 6: BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN (ADMIN DASHBOARD) */}
        {activeTab === 'admin' && (
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

    </div>
  );
}

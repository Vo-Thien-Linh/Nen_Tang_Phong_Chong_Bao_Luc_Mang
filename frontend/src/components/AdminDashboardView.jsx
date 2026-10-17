import { useState } from 'react';
import { 
  ShieldCheck, AlertTriangle, ShieldAlert, CheckCircle2, XCircle, 
  Search, Filter, ArrowUpRight, Clock, MessageSquare, FileText, 
  Send, RefreshCw, Sparkles, Scale, Database, SlidersHorizontal,
  ChevronRight, ExternalLink, ThumbsUp, Eye, EyeOff, Trash2, Download,
  Users, UserCheck, UserX, UserMinus, Shield, Lock, Unlock, AlertOctagon,
  UserCog
} from 'lucide-react';
import ImageModerationQueue from './ImageModerationQueue';

export default function AdminDashboardView({ 
  posts = [], 
  reports = [], 
  appeals = [], 
  aiOverrides = [],
  usersList = [],
  onResolveReport,
  onResolveAppeal,
  onOverrideAiLabel,
  onToggleHidePost,
  onDeletePost,
  onUpdateUserStatus,
  onUpdateUserRole
  ,currentUser
}) {
  // Tab phân hệ chính: 'overview' | 'content' | 'reports' | 'appeals' | 'users' | 'retraining'
  const [activeSubTab, setActiveSubTab] = useState('overview');


  // Bộ lọc nội dung
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLabel, setFilterLabel] = useState('all'); // 'all' | 'Normal' | 'Toxic' | 'Violence' | 'Hate Speech'
  const [filterReportStatus, setFilterReportStatus] = useState('all'); // 'all' | 'pending' | 'resolved_violation' | 'dismissed'

  // Bộ lọc Quản Lý Người Dùng
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [filterUserRole, setFilterUserRole] = useState('all'); // 'all' | 'ADMIN' | 'MODERATOR' | 'USER'
  const [filterUserStatus, setFilterUserStatus] = useState('all'); // 'all' | 'active' | 'cooldown' | 'banned'

  // Modals
  const [overrideModalItem, setOverrideModalItem] = useState(null);
  const [overrideNewLabel, setOverrideNewLabel] = useState('Normal');
  const [overrideReason, setOverrideReason] = useState('');

  const [activeReportModal, setActiveReportModal] = useState(null);
  const [reportAdminNote, setReportAdminNote] = useState('');

  const [activeAppealModal, setActiveAppealModal] = useState(null);
  const [appealAdminNote, setAppealAdminNote] = useState('');

  // Modal Xử lý Người dùng (Khóa / Cooldown / Mở khóa)
  const [activeUserModal, setActiveUserModal] = useState(null);
  const [userActionType, setUserActionType] = useState('cooldown'); // 'cooldown' | 'ban' | 'active'
  const [userActionReason, setUserActionReason] = useState('');

  // Modal Phân quyền người dùng
  const [activeRoleModal, setActiveRoleModal] = useState(null);
  const [newSelectedRole, setNewSelectedRole] = useState('USER');

  // Toast thông báo
  const [actionToast, setActionToast] = useState(null);

  const showToast = (message) => {
    setActionToast(message);
    setTimeout(() => setActionToast(null), 3000);
  };

  // Tính toán KPI Thống kê
  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;
  const pendingAppealsCount = appeals.filter(a => a.status === 'pending').length;
  const totalOverridesCount = aiOverrides.length;
  const totalPostsCount = posts.length;
  const totalUsersCount = usersList.length;

  const activeUsersCount = usersList.filter(u => u.status === 'active').length;
  const cooldownUsersCount = usersList.filter(u => u.status === 'cooldown').length;
  const bannedUsersCount = usersList.filter(u => u.status === 'banned').length;

  // Đếm nhãn bài viết
  const labelCounts = posts.reduce((acc, p) => {
    const lbl = p.aiStatus?.label || 'Normal';
    acc[lbl] = (acc[lbl] || 0) + 1;
    return acc;
  }, { Normal: 0, Toxic: 0, Violence: 0, 'Hate Speech': 0 });

  // Xử lý mở Modal Sửa nhãn AI
  const handleOpenOverride = (item, type = 'post') => {
    setOverrideModalItem({ ...item, type });
    setOverrideNewLabel(item.aiStatus?.label === 'Normal' ? 'Toxic' : 'Normal');
    setOverrideReason('AI phán đoán sai ngữ cảnh / False Positive');
  };

  const handleConfirmOverride = () => {
    if (!overrideModalItem) return;
    onOverrideAiLabel({
      contentType: overrideModalItem.type || 'post',
      contentId: overrideModalItem.id,
      rawText: overrideModalItem.content || overrideModalItem.contentExcerpt || '',
      originalAiLabel: overrideModalItem.aiStatus?.label || 'Normal',
      correctedLabel: overrideNewLabel,
      overrideReason: overrideReason || 'Hiệu chỉnh thủ công bởi Quản trị viên'
    });
    showToast(`Đã cập nhật nhãn AI thành "${overrideNewLabel}" và lưu vào dữ liệu huấn luyện!`);
    setOverrideModalItem(null);
  };

  // Xử lý Báo cáo
  const handleConfirmReport = (status) => {
    if (!activeReportModal) return;
    onResolveReport(activeReportModal.id, status, reportAdminNote);
    showToast(status === 'resolved_violation' ? 'Đã xác nhận vi phạm và xử lý nội dung!' : 'Đã bác bỏ báo cáo!');
    setActiveReportModal(null);
    setReportAdminNote('');
  };

  // Xử lý Khiếu nại
  const handleConfirmAppeal = (status) => {
    if (!activeAppealModal) return;
    onResolveAppeal(activeAppealModal.id, status, appealAdminNote);
    showToast(status === 'approved' ? 'Đã chấp thuận khiếu nại: Minh oan thành công và khôi phục nội dung!' : 'Đã bác bỏ khiếu nại!');
    setActiveAppealModal(null);
    setAppealAdminNote('');
  };

  // Xử lý Trạng thái tài khoản người dùng
  const handleConfirmUserAction = () => {
    if (!activeUserModal) return;
    onUpdateUserStatus(activeUserModal.id, userActionType, userActionReason);
    showToast(`Đã cập nhật tài khoản ${activeUserModal.name}: ${userActionType === 'banned' ? 'Khóa vĩnh viễn' : userActionType === 'cooldown' ? 'Tạm khóa Cooldown' : 'Đã mở khóa hoạt động'}!`);
    setActiveUserModal(null);
    setUserActionReason('');
  };

  // Xử lý Phân quyền người dùng
  const handleConfirmRoleChange = () => {
    if (!activeRoleModal) return;
    onUpdateUserRole(activeRoleModal.id, newSelectedRole);
    showToast(`Đã thay đổi vai trò của ${activeRoleModal.name} thành "${newSelectedRole}"!`);
    setActiveRoleModal(null);
  };

  // Xuất tập dữ liệu Retraining dạng JSON
  const handleExportRetrainingData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(aiOverrides, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ai_retraining_dataset_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Đã tải xuống tập dữ liệu huấn luyện lại (Retraining Dataset) thành công!');
  };

  const getLabelBadge = (label) => {
    switch (label) {
      case 'Normal':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Toxic':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Hate Speech':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Violence':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700 border-purple-200 font-bold';
      case 'MODERATOR':
        return 'bg-blue-100 text-blue-700 border-blue-200 font-bold';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200 font-medium';
    }
  };

  const getUserStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return { label: 'Đang hoạt động', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'cooldown':
        return { label: 'Tạm khóa Cooldown', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'banned':
        return { label: 'Đã bị khóa', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: 'Bình thường', color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  // Danh sách các menu điều hướng cho Sidebar
  const SIDEBAR_SECTIONS = [
    {
      group: 'TỔNG QUAN',
      items: [
        {
          id: 'overview',
          label: 'Tổng Quan & KPI',
          icon: Sparkles,
          badge: null
        }
      ]
    },
    {
      group: 'KIỂM DUYỆT NỘI DUNG',
      items: [
        {
          id: 'content',
          label: 'Giám Sát Bài Viết AI',
          icon: ShieldCheck,
          badge: posts.length,
          badgeColor: 'bg-slate-200 text-slate-700'
        },
        {
          id: 'reports',
          label: 'Báo Cáo Vi Phạm',
          icon: ShieldAlert,
          badge: pendingReportsCount,
          badgeColor: 'bg-rose-500 text-white'
        },
        {
          id: 'appeals',
          label: 'Xử Lý Khiếu Nại AI',
          icon: Scale,
          badge: pendingAppealsCount,
          badgeColor: 'bg-amber-500 text-white'
        }
      ]
    },
    {
      group: 'NGƯỜI DÙNG & HỆ THỐNG',
      items: [
        {
          id: 'users',
          label: 'Quản Lý Người Dùng',
          icon: Users,
          badge: totalUsersCount,
          badgeColor: 'bg-indigo-100 text-indigo-700 font-bold'
        },
        {
          id: 'retraining',
          label: 'Nhật Ký & Dataset AI',
          icon: Database,
          badge: totalOverridesCount,
          badgeColor: 'bg-indigo-600 text-white'
        }
      ]
    }
  ];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      <ImageModerationQueue currentUser={currentUser} />
      
      {/* Toast thông báo hành động */}
      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-fade-in text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* Header Quản Trị Viên (Full width) */}
      <div className="w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                Hệ Thống Kiểm Duyệt Toàn Diện & AI Shield
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PhoBERT Model Live
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Bảng Điều Khiển Quản Trị Viên (Admin Moderation Platform)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Theo dõi và giám sát toàn diện nội dung, xử lý các trường hợp AI gắn nhãn sai (False Positives), giải quyết báo cáo vi phạm, minh oan khiếu nại và quản lý tài khoản người dùng hệ thống.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleExportRetrainingData}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/15 shadow-xs cursor-pointer"
              title="Xuất dữ liệu các trường hợp AI sai để train lại mô hình"
            >
              <Download className="w-4 h-4 text-blue-300" />
              <span>Xuất Dataset AI ({totalOverridesCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* KHUNG BỐ CỤC CHÍNH: TASKBAR SIDEBAR PHÍA TRÁI + VÙNG NỘI DUNG PHÍA PHẢI */}
      <div className="flex flex-col lg:flex-row items-start gap-5 w-full">

        {/* ================= TASKBAR / SIDEBAR BÊN TRÁI RÕ RÀNG, TINH TẾ ================= */}
        <aside className="w-full lg:w-64 xl:w-72 shrink-0 lg:sticky lg:top-20 space-y-4">
          
          {/* Card Menu Điều Hướng */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-3 space-y-4">
            {SIDEBAR_SECTIONS.map((section, sIdx) => (
              <div key={sIdx} className="space-y-1">
                <div className="px-3 pt-1 pb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {section.group}
                </div>

                <div className="space-y-1">
                  {section.items.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeSubTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl text-left transition duration-150 cursor-pointer ${
                          isActive 
                            ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/25 ring-1 ring-indigo-500' 
                            : 'text-slate-700 hover:bg-slate-100/80 hover:text-indigo-600 font-semibold'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                          <span className="text-xs sm:text-sm truncate">
                            {tab.label}
                          </span>
                        </div>

                        {tab.badge !== null && tab.badge > 0 && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                            isActive ? 'bg-white/25 text-white' : tab.badgeColor
                          }`}>
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Card Thông Tin Hệ Thống Nhỏ Gọn */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-4 border border-slate-800 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400 text-[11px] uppercase tracking-wider">Hệ Thống</span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                PhoBERT Online
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Độ chính xác:</span>
                <span className="font-bold text-emerald-300">96.4%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Việc chờ duyệt:</span>
                <span className="font-bold text-amber-300">{pendingReportsCount + pendingAppealsCount}</span>
              </div>
            </div>
          </div>

        </aside>

        {/* ================= VÙNG HIỂN THỊ NỘI DUNG CHÍNH (MAIN CONTENT) ================= */}
        <main className="flex-1 min-w-0 w-full space-y-5">

          {/* ========================================================
              TAB 1: TỔNG QUAN & THỐNG KÊ (OVERVIEW)
              ======================================================== */}
          {activeSubTab === 'overview' && (
            <div className="space-y-5 animate-fade-in w-full">
              
              {/* 4 Khối KPI Chính */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
                
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Báo Cáo Chờ Xử Lý</span>
                    <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                      <ShieldAlert className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900">{pendingReportsCount}</div>
                  <p className="text-[11px] text-rose-600 font-medium">
                    {reports.length} tổng số báo cáo đã gửi
                  </p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Khiếu Nại Chờ Duyệt (Appeals)</span>
                    <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                      <Scale className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900">{pendingAppealsCount}</div>
                  <p className="text-[11px] text-amber-600 font-medium">
                    Yêu cầu minh oan từ người dùng
                  </p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Ca AI Sai Đã Sửa (False Positives)</span>
                    <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      <RefreshCw className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900">{totalOverridesCount}</div>
                  <p className="text-[11px] text-indigo-600 font-medium">
                    Đã đưa vào tập dữ liệu Active Learning
                  </p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Tổng Người Dùng Quản Lý</span>
                    <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                      <Users className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900">{totalUsersCount}</div>
                  <p className="text-[11px] text-emerald-600 font-medium">
                    {activeUsersCount} tài khoản đang hoạt động
                  </p>
                </div>

              </div>

              {/* Phân bổ tỷ lệ nhãn AI & Nhiệm vụ ưu tiên */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 w-full">
                
                {/* Phân bổ nhãn */}
                <div className="xl:col-span-1 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Phân Bổ Nhãn Kiểm Duyệt</span>
                    <span className="text-xs text-slate-400 font-normal">Thời gian thực</span>
                  </h2>

                  <div className="space-y-3">
                    {[
                      { label: 'Normal (An toàn)', count: labelCounts['Normal'] || 0, color: 'bg-emerald-500', text: 'text-emerald-700' },
                      { label: 'Toxic (Độc hại)', count: labelCounts['Toxic'] || 0, color: 'bg-amber-500', text: 'text-amber-700' },
                      { label: 'Violence (Bạo lực)', count: labelCounts['Violence'] || 0, color: 'bg-rose-500', text: 'text-rose-700' },
                      { label: 'Hate Speech (Thù ghét)', count: labelCounts['Hate Speech'] || 0, color: 'bg-orange-500', text: 'text-orange-700' },
                    ].map((item, idx) => {
                      const percent = totalPostsCount > 0 ? Math.round((item.count / totalPostsCount) * 100) : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-600">{item.label}</span>
                            <span className={item.text}>{item.count} bài ({percent}%)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${item.color} rounded-full transition-all duration-500`}
                              style={{ width: `${Math.max(percent, item.count > 0 ? 10 : 0)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
                    <span className="font-bold text-slate-800 block">Quy trình Active Learning:</span>
                    <p className="text-[11px] leading-relaxed">
                      Khi Admin sửa nhãn sai hoặc chấp thuận khiếu nại, dữ liệu sẽ tự động đưa vào tập huấn luyện lại để tinh chỉnh mô hình PhoBERT.
                    </p>
                  </div>
                </div>

                {/* Nhiệm vụ khẩn cấp cần giải quyết */}
                <div className="xl:col-span-2 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      Nhiệm Vụ Khẩn Cấp Cần Quản Trị Viên Xử Lý
                    </h2>
                    <span className="text-xs text-slate-400 font-semibold">
                      {pendingReportsCount + pendingAppealsCount} mục đang chờ
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Khiếu nại chờ */}
                    {appeals.filter(a => a.status === 'pending').map((appeal) => (
                      <div key={appeal.id} className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-900">Khiếu nại AI nhận diện sai</span>
                            <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                              {appeal.aiPredictedLabel} ({((appeal.aiConfidence || 0.9) * 100).toFixed(0)}%)
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 font-medium truncate">
                            Từ: {appeal.user?.name} - "{appeal.appealReason}"
                          </p>
                          <span className="text-[11px] text-slate-400">{appeal.createdAt}</span>
                        </div>

                        <button
                          onClick={() => setActiveAppealModal(appeal)}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
                        >
                          Xét duyệt ngay
                        </button>
                      </div>
                    ))}

                    {/* Báo cáo chờ */}
                    {reports.filter(r => r.status === 'pending').map((report) => (
                      <div key={report.id} className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-rose-900">Báo cáo người dùng vi phạm</span>
                            <span className="text-[10px] bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full font-bold">
                              {report.reasonLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 font-medium truncate">
                            Bị báo cáo: {report.targetAuthor?.name} - "{report.contentExcerpt}"
                          </p>
                          <span className="text-[11px] text-slate-400">Người báo cáo: {report.reporter?.name} • {report.createdAt}</span>
                        </div>

                        <button
                          onClick={() => setActiveReportModal(report)}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
                        >
                          Xử lý báo cáo
                        </button>
                      </div>
                    ))}

                    {pendingReportsCount === 0 && pendingAppealsCount === 0 && (
                      <div className="py-12 text-center text-slate-400 space-y-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                        <p className="text-sm font-bold text-slate-700">Tất cả nhiệm vụ đã được xử lý xong!</p>
                        <p className="text-xs text-slate-400">Không có báo cáo hay khiếu nại nào đang chờ duyệt.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ========================================================
              TAB 2: GIÁM SÁT NỘI DUNG & SỬA NHÃN AI (CONTENT MONITORING)
              ======================================================== */}
          {activeSubTab === 'content' && (
            <div className="space-y-4 animate-fade-in w-full">
              
              {/* Thanh tìm kiếm và bộ lọc */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm bài viết, tác giả..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <select
                    value={filterLabel}
                    onChange={(e) => setFilterLabel(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-700 font-semibold focus:outline-none"
                  >
                    <option value="all">Tất cả nhãn AI</option>
                    <option value="Normal">Normal (An toàn)</option>
                    <option value="Toxic">Toxic (Độc hại)</option>
                    <option value="Violence">Violence (Bạo lực)</option>
                    <option value="Hate Speech">Hate Speech</option>
                  </select>
                </div>
              </div>

              {/* Bảng danh sách bài viết */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden w-full">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-4">Tác Giả</th>
                        <th className="p-4">Nội Dung Bài Viết</th>
                        <th className="p-4">Nhãn AI</th>
                        <th className="p-4">Độ Tin Cậy</th>
                        <th className="p-4">Trạng Thái</th>
                        <th className="p-4 text-right">Can Thiệp Quản Trị</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {posts
                        .filter(post => {
                          const matchesSearch = !searchQuery || 
                            post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            post.author?.name.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesLabel = filterLabel === 'all' || post.aiStatus?.label === filterLabel;
                          return matchesSearch && matchesLabel;
                        })
                        .map((post) => (
                          <tr key={post.id} className="hover:bg-slate-50/80 transition">
                            
                            <td className="p-4">
                              <div className="flex items-center gap-2.5">
                                <img 
                                  src={post.author.avatar} 
                                  alt={post.author.name} 
                                  className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200" 
                                />
                                <div>
                                  <span className="font-bold text-slate-800 block">{post.author.name}</span>
                                  <span className="text-[10px] text-slate-400">@{post.author.username}</span>
                                </div>
                              </div>
                            </td>

                            <td className="p-4 max-w-sm">
                              <p className="text-slate-800 line-clamp-2 leading-relaxed">
                                {post.content}
                              </p>
                              <span className="text-[10px] text-slate-400 mt-1 block">{post.createdAt}</span>
                            </td>

                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${getLabelBadge(post.aiStatus?.label || 'Normal')}`}>
                                <ShieldCheck className="w-3 h-3" />
                                {post.aiStatus?.label || 'Normal'}
                              </span>
                            </td>

                            <td className="p-4 font-mono font-semibold text-slate-700">
                              {((post.aiStatus?.confidence || 0.99) * 100).toFixed(1)}%
                            </td>

                            <td className="p-4">
                              {post.isHidden ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                  Đang bị ẩn
                                </span>
                              ) : post.aiStatus?.label !== 'Normal' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                  Cảnh báo vi phạm
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  Đang hiển thị
                                </span>
                              )}
                            </td>

                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenOverride(post, 'post')}
                                  title="Hiệu chỉnh nhãn AI (Sửa lỗi nhận diện sai)"
                                  className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 transition flex items-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Sửa nhãn AI</span>
                                </button>

                                <button
                                  onClick={() => onToggleHidePost(post.id)}
                                  title={post.isHidden ? "Khôi phục hiển thị" : "Ẩn bài viết"}
                                  className={`p-1.5 rounded-xl border transition cursor-pointer ${
                                    post.isHidden 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {post.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                </button>

                                <button
                                  onClick={() => onDeletePost(post.id)}
                                  title="Xóa bài viết"
                                  className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 3: BÁO CÁO NGƯỜI DÙNG (REPORTS MANAGEMENT)
              ======================================================== */}
          {activeSubTab === 'reports' && (
            <div className="space-y-4 animate-fade-in w-full">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Danh Sách Báo Cáo Vi Phạm Từ Cộng Đồng</h2>
                  <p className="text-xs text-slate-500">Xem xét báo cáo về bài viết, bình luận hoặc tin nhắn do người dùng phản ánh</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={filterReportStatus}
                    onChange={(e) => setFilterReportStatus(e.target.value)}
                    className="text-xs bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-700 font-semibold focus:outline-none"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="pending">Đang chờ xử lý</option>
                    <option value="resolved_violation">Đã duyệt vi phạm</option>
                    <option value="dismissed">Đã bác bỏ</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {reports
                  .filter(r => filterReportStatus === 'all' || r.status === filterReportStatus)
                  .map((report) => (
                    <div 
                      key={report.id}
                      className={`bg-white rounded-3xl p-5 border transition shadow-xs space-y-3 ${
                        report.status === 'pending' ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            {report.targetType === 'post' ? 'Bài viết' : report.targetType === 'comment' ? 'Bình luận' : 'Tin nhắn'}
                          </span>
                          <span className="text-xs font-bold text-slate-800">Lý do: {report.reasonLabel}</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400">{report.createdAt}</span>
                          {report.status === 'pending' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                              Chờ xử lý
                            </span>
                          ) : report.status === 'resolved_violation' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              Xác nhận vi phạm
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Đã bác bỏ
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Người gửi báo cáo:</span>
                          <div className="flex items-center gap-2 font-bold text-slate-800">
                            <img src={report.reporter?.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                            <span>{report.reporter?.name}</span>
                          </div>
                          {report.details && (
                            <p className="text-slate-600 italic text-[11px] pt-1">
                              Ghi chú: "{report.details}"
                            </p>
                          )}
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Đối tượng bị báo cáo:</span>
                          <div className="font-bold text-slate-800">
                            Tác giả: {report.targetAuthor?.name || 'Ẩn danh'}
                          </div>
                          <p className="text-slate-700 bg-white p-2 rounded-xl border border-slate-200 italic line-clamp-2">
                            "{report.contentExcerpt}"
                          </p>
                        </div>
                      </div>

                      {report.adminNotes && (
                        <div className="p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                          <span className="font-bold">Ghi chú của Admin: </span>
                          <span>{report.adminNotes}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        {report.status === 'pending' ? (
                          <button
                            onClick={() => {
                              setActiveReportModal(report);
                              setReportAdminNote('');
                            }}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Mở Phê Duyệt Báo Cáo</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Báo cáo này đã hoàn tất giải quyết</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 4: XỬ LÝ KHIẾU NẠI (APPEALS MANAGEMENT & FALSE POSITIVE)
              ======================================================== */}
          {activeSubTab === 'appeals' && (
            <div className="space-y-4 animate-fade-in w-full">
              
              <div>
                <h2 className="text-base font-bold text-slate-900">Giải Quyết Khiếu Nại & Minh Oan (AI False Positives)</h2>
                <p className="text-xs text-slate-500">Xem xét giải trình của người dùng khi bài viết hoặc tài khoản bị AI phạt nhầm</p>
              </div>

              <div className="space-y-4">
                {appeals.map((appeal) => (
                  <div 
                    key={appeal.id}
                    className={`bg-white rounded-3xl p-5 border transition shadow-xs space-y-4 ${
                      appeal.status === 'pending' ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <img src={appeal.user?.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                        <div>
                          <span className="text-xs font-bold text-slate-900">{appeal.user?.name}</span>
                          <span className="text-[10px] text-slate-400 block">Đơn khiếu nại kiểm duyệt • {appeal.createdAt}</span>
                        </div>
                      </div>

                      <div>
                        {appeal.status === 'pending' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Chờ Admin Xem Xét
                          </span>
                        ) : appeal.status === 'approved' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Đã Chấp Thuận (Minh Oan AI False Positive)
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            Đã Bác Bỏ Khiếu Nại
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                            Phán quyết từ mô hình AI
                          </span>
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${getLabelBadge(appeal.aiPredictedLabel)}`}>
                            {appeal.aiPredictedLabel} ({((appeal.aiConfidence || 0.9) * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 italic text-slate-700">
                          "{appeal.originalText}"
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-2">
                        <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px] block">
                          Lời giải trình của người dùng (Appeal Reason)
                        </span>
                        <p className="text-slate-800 bg-white p-3 rounded-xl border border-amber-100 leading-relaxed font-medium">
                          "{appeal.appealReason}"
                        </p>
                      </div>
                    </div>

                    {appeal.adminNotes && (
                      <div className="p-3 bg-indigo-50/80 rounded-2xl border border-indigo-200 text-xs text-indigo-900">
                        <span className="font-bold">Phản hồi giải quyết của Admin: </span>
                        <span>{appeal.adminNotes}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {appeal.status === 'pending' ? (
                        <button
                          onClick={() => {
                            setActiveAppealModal(appeal);
                            setAppealAdminNote('');
                          }}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span>Xử Lý Đơn Khiếu Nại</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Khiếu nại này đã được xử lý xong</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 5: QUẢN LÝ NGƯỜI DÙNG (USER MANAGEMENT) - NEW FEATURE!
              ======================================================== */}
          {activeSubTab === 'users' && (
            <div className="space-y-4 animate-fade-in w-full">
              
              {/* 4 Thẻ KPI Người dùng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
                
                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Tổng Tài Khoản</span>
                    <span className="text-2xl font-black text-slate-900">{totalUsersCount}</span>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Đang Hoạt Động</span>
                    <span className="text-2xl font-black text-emerald-600">{activeUsersCount}</span>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Tạm Khóa Cooldown</span>
                    <span className="text-2xl font-black text-amber-600">{cooldownUsersCount}</span>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Đã Khóa Vĩnh Viễn</span>
                    <span className="text-2xl font-black text-rose-600">{bannedUsersCount}</span>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <UserX className="w-5 h-5" />
                  </div>
                </div>

              </div>

              {/* Thanh tìm kiếm và bộ lọc Người dùng */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between w-full">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={searchUserQuery}
                    onChange={(e) => setSearchUserQuery(e.target.value)}
                    placeholder="Tìm tên, username, email..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select
                    value={filterUserRole}
                    onChange={(e) => setFilterUserRole(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-700 font-semibold focus:outline-none"
                  >
                    <option value="all">Tất cả vai trò</option>
                    <option value="ADMIN">Quản Trị Viên (ADMIN)</option>
                    <option value="MODERATOR">Kiểm Duyệt Viên (MODERATOR)</option>
                    <option value="USER">Người Dùng (USER)</option>
                  </select>

                  <select
                    value={filterUserStatus}
                    onChange={(e) => setFilterUserStatus(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-700 font-semibold focus:outline-none"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="cooldown">Tạm khóa Cooldown</option>
                    <option value="banned">Đã bị khóa</option>
                  </select>
                </div>
              </div>

              {/* Bảng Quản Lý Người Dùng */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden w-full">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-4">Người Dùng</th>
                        <th className="p-4">Vai Trò</th>
                        <th className="p-4">Hoạt Động & Vi Phạm</th>
                        <th className="p-4">Trạng Thái Tài Khoản</th>
                        <th className="p-4">Ngày Tham Gia</th>
                        <th className="p-4 text-right">Thao Tác Quản Trị</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usersList
                        .filter(u => {
                          const matchSearch = !searchUserQuery || 
                            u.name.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
                            u.username.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
                            u.email.toLowerCase().includes(searchUserQuery.toLowerCase());
                          const matchRole = filterUserRole === 'all' || u.role === filterUserRole;
                          const matchStatus = filterUserStatus === 'all' || u.status === filterUserStatus;
                          return matchSearch && matchRole && matchStatus;
                        })
                        .map((u) => {
                          const statusBadge = getUserStatusBadge(u.status);
                          return (
                            <tr key={u.id} className="hover:bg-slate-50/80 transition">
                              
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <img 
                                    src={u.avatar} 
                                    alt={u.name} 
                                    className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200" 
                                  />
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{u.name}</span>
                                      {u.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />}
                                    </div>
                                    <span className="text-[10px] text-slate-400 block">{u.email} • @{u.username}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="p-4">
                                <span className={`px-2.5 py-1 rounded-md text-[11px] border inline-block ${getRoleBadge(u.role)}`}>
                                  {u.role}
                                </span>
                              </td>

                              <td className="p-4">
                                <div className="space-y-0.5">
                                  <span className="text-slate-800 font-semibold block">{u.postsCount} bài viết</span>
                                  <span className={`text-[10px] font-bold ${
                                    u.violationsCount > 0 ? 'text-rose-600' : 'text-slate-400'
                                  }`}>
                                    {u.violationsCount > 0 ? `${u.violationsCount} lần bị phạt/báo cáo` : 'Chưa có vi phạm'}
                                  </span>
                                </div>
                              </td>

                              <td className="p-4">
                                <div>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-block ${statusBadge.color}`}>
                                    {statusBadge.label}
                                  </span>
                                  {u.status === 'cooldown' && u.cooldownUntil && (
                                    <span className="text-[10px] text-amber-700 block mt-1 font-medium">
                                      {u.cooldownUntil}
                                    </span>
                                  )}
                                  {u.status === 'banned' && u.bannedReason && (
                                    <span className="text-[10px] text-rose-700 block mt-1 font-medium max-w-xs truncate" title={u.bannedReason}>
                                      Lý do: {u.bannedReason}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-4 text-slate-500 whitespace-nowrap">
                                {u.joinedDate}
                              </td>

                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  
                                  {/* Nút Phân quyền */}
                                  <button
                                    onClick={() => {
                                      setActiveRoleModal(u);
                                      setNewSelectedRole(u.role);
                                    }}
                                    title="Thay đổi vai trò (Admin / Moderator / User)"
                                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                  >
                                    <UserCog className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Nút Xử lý trạng thái tài khoản */}
                                  {u.status === 'banned' ? (
                                    <button
                                      onClick={() => {
                                        onUpdateUserStatus(u.id, 'active');
                                        showToast(`Đã mở khóa tài khoản cho ${u.name}!`);
                                      }}
                                      title="Mở khóa tài khoản"
                                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200 transition text-[11px] flex items-center gap-1 cursor-pointer"
                                    >
                                      <Unlock className="w-3 h-3" />
                                      <span>Mở khóa</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setActiveUserModal(u);
                                        setUserActionType(u.status === 'cooldown' ? 'active' : 'cooldown');
                                        setUserActionReason('');
                                      }}
                                      title="Xử lý tài khoản (Khóa hoặc Cooldown)"
                                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 transition text-[11px] flex items-center gap-1 cursor-pointer"
                                    >
                                      <Lock className="w-3 h-3" />
                                      <span>Xử phạt</span>
                                    </button>
                                  )}

                                </div>
                              </td>

                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 6: NHẬT KÝ HIỆU CHỈNH & HUẤN LUYỆN LẠI (RETRAINING LOOP)
              ======================================================== */}
          {activeSubTab === 'retraining' && (
            <div className="space-y-4 animate-fade-in w-full">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Nhật Ký Hiệu Chỉnh AI & Tập Dữ Liệu Huấn Luyện Lại</h2>
                  <p className="text-xs text-slate-500">
                    Toàn bộ các ca False Positives do Admin sửa nhãn để làm kho Active Learning fine-tune lại PhoBERT
                  </p>
                </div>
                <button
                  onClick={handleExportRetrainingData}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Xuất Toàn Bộ Dataset (JSON)</span>
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden w-full">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-4">Thời Gian</th>
                        <th className="p-4">Quản Trị Viên</th>
                        <th className="p-4">Nội Dung</th>
                        <th className="p-4">Nhãn Ban Đầu (AI)</th>
                        <th className="p-4">Nhãn Đã Sửa (Admin)</th>
                        <th className="p-4">Lý Do Hiệu Chỉnh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {aiOverrides.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 transition">
                          <td className="p-4 text-slate-400 whitespace-nowrap">{log.createdAt}</td>
                          <td className="p-4 font-semibold text-slate-800 whitespace-nowrap">{log.adminName}</td>
                          <td className="p-4 max-w-sm">
                            <p className="text-slate-800 italic line-clamp-2">"{log.rawText}"</p>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${getLabelBadge(log.originalAiLabel)}`}>
                              {log.originalAiLabel}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${getLabelBadge(log.correctedLabel)}`}>
                              {log.correctedLabel}
                            </span>
                          </td>
                          <td className="p-4 text-slate-700 max-w-xs">{log.overrideReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* ========================================================
          MODAL 1: ĐIỀU CHỈNH NHÃN AI (OVERRIDE LABEL)
          ======================================================== */}
      {overrideModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6 text-slate-800">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <RefreshCw className="w-4 h-4" />
                <span>Hiệu Chỉnh Nhãn AI (Label Override)</span>
              </div>
              <button 
                onClick={() => setOverrideModalItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 uppercase tracking-wider font-bold block mb-1">Nội dung xem xét:</span>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 italic text-slate-700 line-clamp-3">
                  "{overrideModalItem.content || overrideModalItem.contentExcerpt}"
                </p>
              </div>

              <div>
                <span className="text-slate-400 uppercase tracking-wider font-bold block mb-1">Nhãn hiện tại của AI:</span>
                <span className={`px-2.5 py-0.5 rounded-md font-bold border inline-block ${getLabelBadge(overrideModalItem.aiStatus?.label || 'Normal')}`}>
                  {overrideModalItem.aiStatus?.label || 'Normal'}
                </span>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Chọn nhãn chính xác mới:</label>
                <select
                  value={overrideNewLabel}
                  onChange={(e) => setOverrideNewLabel(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-400"
                >
                  <option value="Normal">Normal (Bình thường / Vô hại)</option>
                  <option value="Toxic">Toxic (Độc hại / Xúc phạm)</option>
                  <option value="Violence">Violence (Bạo lực / Đe dọa)</option>
                  <option value="Hate Speech">Hate Speech (Kích động thù hận)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Lý do điều chỉnh (lưu log Retraining):</label>
                <input 
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Ví dụ: AI nhận nhầm tiếng lóng vô hại giữa bạn thân"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setOverrideModalItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmOverride}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition cursor-pointer"
              >
                Lưu & Cập Nhật Nhãn
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: XỬ LÝ BÁO CÁO (RESOLVE REPORT MODAL)
          ======================================================== */}
      {activeReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6 text-slate-800">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>Xử Lý Báo Cáo Vi Phạm Từ Người Dùng</span>
              </div>
              <button 
                onClick={() => setActiveReportModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 space-y-1">
                <span className="font-bold text-rose-900 block">Lý do báo cáo: {activeReportModal.reasonLabel}</span>
                <p className="text-slate-700">Người báo cáo: <span className="font-semibold">{activeReportModal.reporter?.name}</span></p>
                {activeReportModal.details && <p className="italic text-slate-600">"{activeReportModal.details}"</p>}
              </div>

              <div>
                <span className="text-slate-500 font-bold block mb-1 uppercase tracking-wider text-[10px]">
                  Nội dung bị báo cáo:
                </span>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 italic text-slate-800">
                  "{activeReportModal.contentExcerpt}"
                </p>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Ghi chú xử lý của Quản trị viên:</label>
                <textarea 
                  rows={2}
                  value={reportAdminNote}
                  onChange={(e) => setReportAdminNote(e.target.value)}
                  placeholder="Ghi chú kết quả xử lý..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                onClick={() => handleConfirmReport('dismissed')}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Bác Bỏ Báo Cáo (Hợp lệ)
              </button>
              
              <button
                onClick={() => handleConfirmReport('resolved_violation')}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition cursor-pointer"
              >
                Xác Nhận Vi Phạm & Ẩn Nội Dung
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: XỬ LÝ KHIẾU NẠI (RESOLVE APPEAL MODAL)
          ======================================================== */}
      {activeAppealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6 text-slate-800">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                <Scale className="w-4 h-4" />
                <span>Xét Duyệt Khiếu Nại / Minh Oan AI Nhận Diện Sai</span>
              </div>
              <button 
                onClick={() => setActiveAppealModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-900">Người khiếu nại: {activeAppealModal.user?.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getLabelBadge(activeAppealModal.aiPredictedLabel)}`}>
                    AI: {activeAppealModal.aiPredictedLabel}
                  </span>
                </div>
                <p className="text-slate-800 font-medium pt-1">
                  Giải trình: "{activeAppealModal.appealReason}"
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-bold block mb-1 uppercase tracking-wider text-[10px]">
                  Nội dung bài viết:
                </span>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 italic text-slate-800">
                  "{activeAppealModal.originalText}"
                </p>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Ghi chú phản hồi người dùng:</label>
                <textarea 
                  rows={2}
                  value={appealAdminNote}
                  onChange={(e) => setAppealAdminNote(e.target.value)}
                  placeholder="Ví dụ: Đã kiểm tra ngữ cảnh, xác định AI False Positive. Phục hồi bài viết và gỡ phạt."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                onClick={() => handleConfirmAppeal('rejected')}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Bác Bỏ Khiếu Nại (Giữ phạt)
              </button>
              
              <button
                onClick={() => handleConfirmAppeal('approved')}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Chấp Thuận Minh Oan (Sửa nhãn Normal)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: XỬ PHẠT TÀI KHOẢN NGƯỜI DÙNG (USER ACTION MODAL)
          ======================================================== */}
      {activeUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6 text-slate-800">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <Lock className="w-4 h-4" />
                <span>Xử Lý Tài Khoản Người Dùng</span>
              </div>
              <button 
                onClick={() => setActiveUserModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <img src={activeUserModal.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200" />
                <div>
                  <div className="font-bold text-slate-900">{activeUserModal.name}</div>
                  <div className="text-slate-400">{activeUserModal.email} • @{activeUserModal.username}</div>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1.5">Chọn hình thức xử lý:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUserActionType('cooldown')}
                    className={`py-2 px-2 text-center rounded-xl border text-xs font-bold transition cursor-pointer ${
                      userActionType === 'cooldown' 
                        ? 'bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-100'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Tạm Khóa 24h
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserActionType('banned')}
                    className={`py-2 px-2 text-center rounded-xl border text-xs font-bold transition cursor-pointer ${
                      userActionType === 'banned' 
                        ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-100'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Khóa Vĩnh Viễn
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserActionType('active')}
                    className={`py-2 px-2 text-center rounded-xl border text-xs font-bold transition cursor-pointer ${
                      userActionType === 'active' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-100'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Mở Khóa
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Lý do xử phạt (ghi chú hệ thống):</label>
                <textarea
                  rows={2}
                  value={userActionReason}
                  onChange={(e) => setUserActionReason(e.target.value)}
                  placeholder="Ví dụ: Đăng tải nội dung độc hại lặp lại nhiều lần..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setActiveUserModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmUserAction}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition cursor-pointer"
              >
                Xác Nhận Áp Dụng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 5: PHÂN QUYỀN NGƯỜI DÙNG (ROLE MODAL)
          ======================================================== */}
      {activeRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6 text-slate-800">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                <UserCog className="w-4 h-4" />
                <span>Phân Quyền Vai Trò Người Dùng</span>
              </div>
              <button 
                onClick={() => setActiveRoleModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Thay đổi vai trò quản trị cho tài khoản <strong className="font-bold text-slate-900">{activeRoleModal.name}</strong>:
              </p>

              <div className="space-y-2">
                {[
                  { role: 'USER', label: 'USER (Người dùng thông thường)', desc: 'Chỉ đăng bài, bình luận, nhắn tin tiêu chuẩn' },
                  { role: 'MODERATOR', label: 'MODERATOR (Kiểm duyệt viên)', desc: 'Có quyền xem báo cáo và kiểm duyệt nội dung bài viết' },
                  { role: 'ADMIN', label: 'ADMIN (Quản trị viên tối cao)', desc: 'Toàn quyền can thiệp hệ thống, sửa nhãn AI và quản lý tài khoản' },
                ].map((r) => (
                  <label 
                    key={r.role} 
                    className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer transition ${
                      newSelectedRole === r.role ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-100' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="userRole" 
                      value={r.role}
                      checked={newSelectedRole === r.role}
                      onChange={(e) => setNewSelectedRole(e.target.value)}
                      className="mt-0.5 accent-purple-600"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">{r.label}</span>
                      <span className="text-[11px] text-slate-500 block">{r.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setActiveRoleModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmRoleChange}
                className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition cursor-pointer"
              >
                Lưu Vai Trò
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

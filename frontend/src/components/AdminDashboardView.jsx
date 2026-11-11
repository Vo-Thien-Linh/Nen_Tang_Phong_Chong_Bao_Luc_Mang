import { useState, useEffect, useCallback } from 'react';
import { 
  Users, LayoutDashboard, Shield, Search, RefreshCw, 
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle, 
  ExternalLink, UserCheck, ArrowRight, X,
  Lock, Unlock, ShieldAlert, Timer, RotateCcw, AlertTriangle
} from 'lucide-react';
import { fetchUsersList, updateUserRoleApi, updateUserVerificationApi, updateUserSanctionApi } from '../api/client';
import { ROLES, ROLE_LABELS, normalizeRole } from '../utils/rbac';
import { DEFAULT_AVATAR } from '../constants/defaults';
import VerifiedBadge from './VerifiedBadge';
import { useTranslation } from '../utils/i18n';

export default function AdminDashboardView({ 
  currentUser,
  onNavigateToModeration
}) {
  const { t, isEn } = useTranslation();
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'dashboard'
  
  // Trạng thái Quản lý người dùng
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });

  // Modal xác nhận đổi vai trò
  const [confirmDialog, setConfirmDialog] = useState(null); // { user, newRole }
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal xử phạt tài khoản
  const [sanctionDialog, setSanctionDialog] = useState(null); // { user, isTemp: true, durationDays: 3, reason: '' }
  const [isSanctioning, setIsSanctioning] = useState(false);

  // Toast thông báo
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Tải danh sách người dùng từ DB thật
  const loadUsers = useCallback(async (currentPage, search, role) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchUsersList({
        search: search || '',
        role: role || 'all',
        page: currentPage || 1,
        limit: 10,
        userId: currentUser?.id,
      });

      if (response && response.success) {
        setUsers(response.data || []);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      } else {
        throw new Error(response.message || 'Không thể tải danh sách người dùng');
      }
    } catch (err) {
      console.error('Lỗi tải danh sách người dùng:', err);
      setError(err.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadUsers(page, searchQuery, selectedRoleFilter);
  }, [loadUsers, page, searchQuery, selectedRoleFilter]);

  // Tìm kiếm với debounce đơn giản
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadUsers(1, searchQuery, selectedRoleFilter);
  };

  const handleRoleFilterChange = (role) => {
    setSelectedRoleFilter(role);
    setPage(1);
    loadUsers(1, searchQuery, role);
  };

  // Mở hộp thoại xác nhận đổi vai trò
  const handleOpenConfirmDialog = (user, newRole) => {
    const currentRoleNormalized = normalizeRole(user.role);
    if (currentRoleNormalized === newRole) return;
    setConfirmDialog({
      user,
      newRole,
    });
  };

  // Thực hiện đổi vai trò qua API thật
  const handleConfirmRoleChange = async () => {
    if (!confirmDialog) return;
    const { user, newRole } = confirmDialog;
    setIsUpdating(true);

    try {
      const response = await updateUserRoleApi({
        targetUserId: user.id,
        newRole,
        userId: currentUser?.id,
      });

      if (response && response.success) {
        showToast(`Đã đổi vai trò cho ${user.name || user.username} thành ${ROLE_LABELS[newRole]}.`, 'success');
        
        // Cập nhật state bảng trực tiếp
        setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, role: newRole } : u)));
        setConfirmDialog(null);
      } else {
        throw new Error(response?.message || 'Không đổi được vai trò người dùng.');
      }
    } catch (err) {
      showToast(err.message || 'Không đổi được vai trò người dùng.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleVerification = async (user) => {
    const nextStatus = !user.isVerified;
    try {
      const response = await updateUserVerificationApi({
        targetUserId: user.id,
        isVerified: nextStatus,
        userId: currentUser?.id,
      });

      if (response && response.success) {
        showToast(
          nextStatus 
            ? `Đã cấp tích xanh cho ${user.name || user.username}.`
            : `Đã thu hồi tích xanh của ${user.name || user.username}.`,
          'success'
        );
        setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, isVerified: nextStatus } : u)));
      } else {
        throw new Error(response?.message || 'Không thể cập nhật tích xanh.');
      }
    } catch (err) {
      showToast(err.message || 'Không thể cập nhật tích xanh.', 'error');
    }
  };

  const handleOpenSanctionDialog = (user) => {
    setSanctionDialog({
      user,
      isTemp: true,
      durationDays: 3,
      reason: 'Vi phạm tiêu chuẩn cộng đồng',
    });
  };

  const handleConfirmSanction = async () => {
    if (!sanctionDialog) return;
    const { user, isTemp, durationDays, reason } = sanctionDialog;
    setIsSanctioning(true);
    try {
      const response = await updateUserSanctionApi({
        targetUserId: user.id,
        action: 'ban',
        durationDays: isTemp ? Number(durationDays) : null,
        reason: reason.trim() || (isTemp ? `Khóa tạm thời ${durationDays} ngày` : 'Vi phạm nghiêm trọng tiêu chuẩn cộng đồng'),
        userId: currentUser?.id,
      });

      if (response && response.success) {
        showToast(response.message || 'Đã áp dụng xử phạt tài khoản thành công.', 'success');
        setUsers(prev => prev.map(u => (u.id === user.id ? { 
          ...u, 
          status: 'banned', 
          bannedUntil: response.data?.bannedUntil,
          banReason: response.data?.banReason,
        } : u)));
        setSanctionDialog(null);
      } else {
        throw new Error(response?.message || 'Không thể xử phạt tài khoản.');
      }
    } catch (err) {
      showToast(err.message || 'Không thể xử phạt tài khoản.', 'error');
    } finally {
      setIsSanctioning(false);
    }
  };

  const handleUnbanUser = async (user) => {
    try {
      const response = await updateUserSanctionApi({
        targetUserId: user.id,
        action: 'unban',
        userId: currentUser?.id,
      });

      if (response && response.success) {
        showToast(`Đã mở khóa tài khoản cho ${user.name || user.username}.`, 'success');
        setUsers(prev => prev.map(u => (u.id === user.id ? { 
          ...u, 
          status: 'active', 
          bannedUntil: null,
          banReason: null,
        } : u)));
      } else {
        throw new Error(response?.message || 'Không thể mở khóa tài khoản.');
      }
    } catch (err) {
      showToast(err.message || 'Không thể mở khóa tài khoản.', 'error');
    }
  };

  const handleClearCooldown = async (user) => {
    try {
      const response = await updateUserSanctionApi({
        targetUserId: user.id,
        action: 'clear_cooldown',
        userId: currentUser?.id,
      });

      if (response && response.success) {
        showToast(`Đã gỡ án phạt oan cho ${user.name || user.username}. Countdown đã được đưa về 0!`, 'success');
        setUsers(prev => prev.map(u => (u.id === user.id ? { 
          ...u, 
          status: 'active', 
          cooldownUntil: null,
          cooldownReason: null,
        } : u)));
      } else {
        throw new Error(response?.message || 'Không thể gỡ án phạt.');
      }
    } catch (err) {
      showToast(err.message || 'Không thể gỡ án phạt.', 'error');
    }
  };

  // Giải thích hệ quả của vai trò mới trong dialog
  const getRoleConsequenceText = (newRole) => {
    switch (newRole) {
      case ROLES.ADMIN:
        return 'Tài khoản này sẽ có toàn quyền quản lý hệ thống, phân vai trò cho người dùng khác và giám sát kiểm duyệt.';
      case ROLES.MODERATOR:
        return 'Tài khoản này sẽ có quyền kiểm duyệt nội dung, xử lý báo cáo, khiếu nại và xem nội dung bị ẩn.';
      case ROLES.USER:
      default:
        return 'Tài khoản này sẽ trở về quyền người dùng thông thường và bị thu hồi toàn bộ đặc quyền quản trị hoặc kiểm duyệt.';
    }
  };

  return (

    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      {/* Toast thông báo */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-md p-3.5 rounded-lg border shadow-lg flex items-start gap-3 transition-all ${
          toast.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs font-medium leading-relaxed">
            {toast.message}
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header khu vực Quản trị */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {isEn ? 'System Administration Area' : 'Khu vực quản trị hệ thống'}
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-md">
              Admin
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isEn 
              ? 'Manage user accounts, assign roles, and supervise platform operations.'
              : 'Quản lý tài khoản người dùng, phân cấp vai trò và giám sát vận hành nền tảng.'}
          </p>
        </div>

        {/* Nút truy cập khu vực kiểm duyệt dành cho Admin */}
        {onNavigateToModeration && (
          <button
            onClick={onNavigateToModeration}
            className="h-9 px-3.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 transition cursor-pointer self-start sm:self-auto"
          >
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{isEn ? 'Open Moderation Area' : 'Mở khu vực kiểm duyệt'}</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Tabs điều hướng chính: Người dùng & Dashboard */}
      <div className="flex items-center gap-2 mt-6 border-b border-slate-200 dark:border-slate-800 pb-px">
        <button
          onClick={() => setActiveTab('users')}
          className={`h-9 px-4 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isEn ? 'Users & Permissions' : 'Người dùng và phân quyền'}</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`h-9 px-4 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'dashboard'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>{isEn ? 'System Overview' : 'Tổng quan hệ thống'}</span>
        </button>
      </div>

      {/* TAB 1: QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN (CHẠY THẬT) */}
      {activeTab === 'users' && (
        <div className="mt-6">
          {/* Thanh công cụ: Tìm kiếm, lọc vai trò, nút làm mới */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Form tìm kiếm */}
              <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isEn ? "Search by name, email, username..." : "Tìm theo tên, email, tên người dùng..."}
                  className="w-full h-9 pl-9 pr-8 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setPage(1);
                      loadUsers(1, '', selectedRoleFilter);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* Bộ lọc vai trò và nút làm mới */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <span>{isEn ? 'Role:' : 'Vai trò:'}</span>
                  <select
                    value={selectedRoleFilter}
                    onChange={(e) => handleRoleFilterChange(e.target.value)}
                    className="h-9 px-2.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value="all">{isEn ? 'All roles' : 'Tất cả vai trò'}</option>
                    <option value="admin">{isEn ? 'Administrator' : 'Quản trị viên'}</option>
                    <option value="moderator">{isEn ? 'Moderator' : 'Điều hành viên'}</option>
                    <option value="user">{isEn ? 'User' : 'Người dùng'}</option>
                  </select>
                </div>

                <button
                  onClick={() => loadUsers(page, searchQuery, selectedRoleFilter)}
                  disabled={loading}
                  title={isEn ? "Reload list" : "Tải lại danh sách"}
                  className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isEn ? 'Refresh' : 'Làm mới'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* BẢNG DANH SÁCH NGƯỜI DÙNG */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {loading ? (
              // Trạng thái đang tải (Skeleton)
              <div className="p-6 divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="py-3 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-200 rounded-full" />
                      <div className="space-y-1.5">
                        <div className="w-32 h-3.5 bg-slate-200 rounded" />
                        <div className="w-24 h-3 bg-slate-100 rounded" />
                      </div>
                    </div>
                    <div className="w-20 h-4 bg-slate-100 rounded" />
                    <div className="w-28 h-8 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : error ? (
              // Trạng thái lỗi kết nối
              <div className="p-8 text-center bg-white dark:bg-slate-900">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{isEn ? 'Cannot load user list' : 'Không thể tải danh sách người dùng'}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">{error}</p>
                <button
                  onClick={() => loadUsers(page, searchQuery, selectedRoleFilter)}
                  className="mt-4 h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition cursor-pointer"
                >
                  {isEn ? 'Try again' : 'Thử lại'}
                </button>
              </div>
            ) : users.length === 0 ? (
              // Trạng thái rỗng / không tìm thấy kết quả
              <div className="p-8 text-center bg-white dark:bg-slate-900">
                <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {searchQuery || selectedRoleFilter !== 'all' 
                    ? (isEn ? 'No matching results found' : 'Không có kết quả phù hợp')
                    : (isEn ? 'No users yet' : 'Chưa có người dùng nào')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchQuery || selectedRoleFilter !== 'all'
                    ? (isEn ? 'Try adjusting your search query or clear the role filter.' : 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc vai trò.')
                    : (isEn ? 'The system currently has no registered user accounts.' : 'Hệ thống hiện chưa có tài khoản người dùng nào được tạo.')}
                </p>
                {(searchQuery || selectedRoleFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedRoleFilter('all');
                      setPage(1);
                      loadUsers(1, '', 'all');
                    }}
                    className="mt-4 h-8 px-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    {isEn ? 'Clear filter' : 'Xóa bộ lọc'}
                  </button>
                )}
              </div>
            ) : (
              // Bảng dữ liệu người dùng
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">{isEn ? 'USER' : 'NGƯỜI DÙNG'}</th>
                      <th className="py-3 px-4">{isEn ? 'CONTACT' : 'LIÊN HỆ'}</th>
                      <th className="py-3 px-4">{isEn ? 'VERIFIED' : 'TÍCH XANH'}</th>
                      <th className="py-3 px-4">{isEn ? 'CURRENT ROLE' : 'VAI TRÒ HIỆN TẠI'}</th>
                      <th className="py-3 px-4">{isEn ? 'STATUS' : 'TRẠNG THÁI'}</th>
                      <th className="py-3 px-4">{isEn ? 'TRUST SCORE' : 'ĐIỂM UY TÍN'}</th>
                      <th className="py-3 px-4 text-right">{isEn ? 'ASSIGN ROLE' : 'PHÂN VAI TRÒ'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {users.map((user) => {
                      const userRole = normalizeRole(user.role);
                      const isSelf = user.id === currentUser?.id;

                      return (
                        <tr key={user.id} className="hover:bg-slate-100/70 dark:hover:bg-slate-800 transition">
                          {/* Cột 1: Thông tin người dùng */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={user.avatar || user.avatar_url || DEFAULT_AVATAR}
                                alt={user.name || user.username}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                              <div>
                                <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                  <span>{user.name || user.full_name || (isEn ? 'User' : 'Người dùng')}</span>
                                  {user.isVerified && <VerifiedBadge size="sm" />}
                                  {isSelf && (
                                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                                      {isEn ? 'You' : 'Bạn'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  @{user.username || 'user'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Cột 2: Email & Số điện thoại */}
                          <td className="py-3 px-4">
                            <div className="text-slate-800 dark:text-slate-200">{user.email || '—'}</div>
                            {user.phone && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">{user.phone}</div>
                            )}
                          </td>

                          {/* Cột 3: Tích xanh */}
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleVerification(user)}
                              title={user.isVerified ? (isEn ? 'Click to revoke verification' : 'Nhấn để thu hồi tích xanh') : (isEn ? 'Click to grant verification' : 'Nhấn để cấp tích xanh')}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                                user.isVerified
                                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                              }`}
                            >
                              <VerifiedBadge size="xs" />
                              <span>{user.isVerified ? (isEn ? 'Verified' : 'Đã cấp') : (isEn ? 'Grant badge' : 'Cấp tích')}</span>
                            </button>
                          </td>

                          {/* Cột 4: Vai trò hiện tại */}
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
                              userRole === ROLES.ADMIN
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : userRole === ROLES.MODERATOR
                                ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}>
                              {userRole === ROLES.ADMIN ? 'Admin' : userRole === ROLES.MODERATOR ? (isEn ? 'Moderator' : 'Điều hành viên') : (isEn ? 'User' : 'Người dùng')}
                            </span>
                          </td>

                          {/* Cột 5: Trạng thái & Xử phạt */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              {user.status === 'banned' ? (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                    <Lock className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                    {user.bannedUntil ? (isEn ? 'Temp Ban' : 'Khóa tạm thời') : (isEn ? 'Perm Ban' : 'Khóa vĩnh viễn')}
                                  </span>
                                  {user.bannedUntil && (
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      {isEn ? 'Until: ' : 'Đến: '}{new Date(user.bannedUntil).toLocaleDateString(isEn ? 'en-US' : 'vi-VN')}
                                    </div>
                                  )}
                                  {user.banReason && (
                                    <div className="text-[10px] text-rose-600 dark:text-rose-400 truncate max-w-[140px]" title={user.banReason}>
                                      {user.banReason}
                                    </div>
                                  )}
                                </div>
                              ) : user.status === 'cooldown' ? (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                    <Timer className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                    {isEn ? 'Muted' : 'Cấm đăng/cmt'}
                                  </span>
                                  {user.cooldownUntil && (
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      {isEn ? 'Until: ' : 'Đến: '}{new Date(user.cooldownUntil).toLocaleTimeString(isEn ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  {isEn ? 'Active' : 'Hoạt động'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Cột 6: Phân vai trò & Xử phạt */}
                          {/* Cột ĐIểm uy tín */}
                          <td className="py-3 px-4">
                            {(() => {
                              const score = user.trustScore ?? 100;
                              const tier = user.trustTier ?? 'good';
                              const styleMap = {
                                good:       { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', bar: 'bg-emerald-500', label: isEn ? 'Excellent' : 'Xuất sắc' },
                                fair:       { bg: 'bg-blue-50 dark:bg-blue-950/40',    text: 'text-blue-700 dark:text-blue-400',    border: 'border-blue-200 dark:border-blue-800',    bar: 'bg-blue-500',    label: isEn ? 'Good' : 'Tốt' },
                                warning:    { bg: 'bg-amber-50 dark:bg-amber-950/40',   text: 'text-amber-700 dark:text-amber-400',   border: 'border-amber-200 dark:border-amber-800',   bar: 'bg-amber-500',   label: isEn ? 'Warning' : 'Cảnh báo' },
                                restricted: { bg: 'bg-rose-50 dark:bg-rose-950/40',    text: 'text-rose-700 dark:text-rose-400',    border: 'border-rose-200 dark:border-rose-800',    bar: 'bg-rose-500',    label: isEn ? 'Restricted' : 'Hạn chế' },
                              };
                              const s = styleMap[tier] || styleMap.good;
                              return (
                                <div className={`inline-flex flex-col gap-1 px-2 py-1 rounded-lg border ${s.bg} ${s.border}`}>
                                  <div className={`text-[11px] font-bold ${s.text}`}>{score}/100 <span className="font-medium">({s.label})</span></div>
                                  <div className="w-16 h-1 bg-white/70 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${score}%` }} />
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
<td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <select
                                value={userRole}
                                disabled={isSelf}
                                title={isSelf ? (isEn ? 'You cannot change your own role' : 'Bạn không thể tự đổi vai trò của chính mình') : (isEn ? 'Select new role for this user' : 'Chọn vai trò mới cho người dùng này')}
                                onChange={(e) => handleOpenConfirmDialog(user, e.target.value)}
                                className="h-8 px-2 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <option value="user">{isEn ? 'User' : 'Người dùng'}</option>
                                <option value="moderator">{isEn ? 'Moderator' : 'Điều hành viên'}</option>
                                <option value="admin">{isEn ? 'Administrator' : 'Quản trị viên'}</option>
                              </select>

                              {!isSelf && (
                                <>
                                  {user.status === 'banned' ? (
                                    <button
                                      onClick={() => handleUnbanUser(user)}
                                      title={isEn ? "Unlock account immediately" : "Mở khóa tài khoản ngay lập tức"}
                                      className="h-8 px-2.5 rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                                    >
                                      <Unlock className="w-3.5 h-3.5" />
                                      <span>{isEn ? 'Unlock' : 'Mở khóa'}</span>
                                    </button>
                                  ) : user.status === 'cooldown' ? (
                                    <button
                                      onClick={() => handleClearCooldown(user)}
                                      title={isEn ? "Pardon: Lift restrictions and reset countdown" : "Minh oan: Gỡ phạt cấm đăng bài và bình luận, đưa countdown về 0"}
                                      className="h-8 px-2.5 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>{isEn ? 'Pardon' : 'Gỡ phạt oan'}</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleOpenSanctionDialog(user)}
                                      title={isEn ? "Lock account (temporary or permanent)" : "Khóa tài khoản (tạm thời hoặc vĩnh viễn)"}
                                      className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-400 hover:border-rose-200 dark:border-rose-800 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                                    >
                                      <Lock className="w-3.5 h-3.5" />
                                      <span>{isEn ? 'Lock Account' : 'Khóa TK'}</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Phân trang */}
            {!loading && !error && users.length > 0 && (
              <div className="py-3 px-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div>
                  {isEn 
                    ? `Showing ${(page - 1) * pagination.limit + 1} - ${Math.min(page * pagination.limit, pagination.total)} of ${pagination.total} users`
                    : `Hiển thị ${(page - 1) * pagination.limit + 1} - ${Math.min(page * pagination.limit, pagination.total)} trên tổng số ${pagination.total} người dùng`}
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Previous' : 'Trước'}</span>
                  </button>

                  <span className="px-2 font-medium text-slate-700 dark:text-slate-200">
                    {isEn ? `Page ${page} / ${pagination.totalPages}` : `Trang ${page} / ${pagination.totalPages}`}
                  </span>

                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isEn ? 'Next' : 'Sau'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TỔNG QUAN HỆ THỐNG (DASHBOARD - DỰNG KHUNG UI TRUNG THỰC) */}
      {activeTab === 'dashboard' && (
        <div className="mt-6 space-y-6">
          {/* Khung số liệu thật từ danh sách người dùng */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{isEn ? 'Total Accounts' : 'Tổng số tài khoản'}</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{pagination.total}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{isEn ? 'Registered in the system' : 'Đã đăng ký trong hệ thống'}</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{isEn ? 'Administrators (Admin)' : 'Quản trị viên (Admin)'}</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {users.filter(u => normalizeRole(u.role) === ROLES.ADMIN).length || 1}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{isEn ? 'Full system authority' : 'Nắm toàn quyền hệ thống'}</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{isEn ? 'Moderators' : 'Điều hành viên (Moderator)'}</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {users.filter(u => normalizeRole(u.role) === ROLES.MODERATOR).length}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{isEn ? 'Responsible for content moderation' : 'Chịu trách nhiệm kiểm duyệt'}</div>
            </div>
          </div>

          {/* Khung UI Placeholder trung thực theo quy chuẩn Prompt 1 & Prompt 2 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
            <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isEn ? 'Reports & Content Moderation' : 'Báo cáo & Kiểm duyệt nội dung'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isEn ? 'Interface framework for monitoring moderation progress.' : 'Khung giao diện theo dõi tiến trình kiểm duyệt.'}
                </p>
              </div>
              {onNavigateToModeration && (
                <button
                  onClick={onNavigateToModeration}
                  className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>{isEn ? 'Open moderation page' : 'Mở trang kiểm duyệt'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="py-12 text-center">
              <Shield className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {isEn ? 'No automated statistics available yet' : 'Chưa có số liệu thống kê tự động'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {isEn 
                  ? 'KPI dashboard will automatically update once PhoBERT moderation model and report ingestion pipelines are fully running.'
                  : 'Bảng điều khiển KPI sẽ cập nhật số liệu tự động khi kích hoạt đầy đủ mô hình kiểm duyệt PhoBERT và luồng tiếp nhận báo cáo.'}
              </p>
              <div className="mt-4">
                <span className="inline-block text-[11px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                  {isEn ? 'TODO: Render violation charts when AI module is fully configured' : 'TODO: Dựng biểu đồ thống kê vi phạm khi hoàn thiện module AI'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN ĐỔI VAI TRÒ (Có nêu rõ đối tượng và hệ quả theo Prompt 1 & Prompt 2) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 shadow-xl animate-fade-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{isEn ? 'Confirm Role Change' : 'Xác nhận đổi vai trò'}</h3>
              </div>
              <button
                onClick={() => setConfirmDialog(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <p>
                {isEn ? 'Are you sure you want to change the role of account ' : 'Bạn có chắc chắn muốn đổi vai trò của tài khoản '}
                <strong className="text-slate-900 dark:text-slate-100 font-semibold">
                  {confirmDialog.user.name || confirmDialog.user.full_name}
                </strong>{' '}
                (@{confirmDialog.user.username}) {isEn ? 'from ' : 'từ '}
                <span className="font-semibold">{ROLE_LABELS[normalizeRole(confirmDialog.user.role)]}</span> {isEn ? 'to ' : 'sang '}
                <span className="font-bold text-blue-600 dark:text-blue-400">{ROLE_LABELS[confirmDialog.newRole]}</span>?
              </p>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{isEn ? 'Consequences: ' : 'Hệ quả: '}</span>
                {getRoleConsequenceText(confirmDialog.newRole)}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={isUpdating}
                className="h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                {isEn ? 'Cancel' : 'Hủy'}
              </button>

              <button
                type="button"
                onClick={handleConfirmRoleChange}
                disabled={isUpdating}
                className="h-8 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition cursor-pointer disabled:opacity-50"
              >
                {isUpdating ? (isEn ? 'Updating...' : 'Đang cập nhật...') : (isEn ? 'Change Role' : 'Đổi vai trò')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XỬ PHẠT TÀI KHOẢN (Khóa tạm thời hoặc Khóa vĩnh viễn) */}
      {sanctionDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 shadow-xl animate-fade-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{isEn ? 'Sanction & Lock Account' : 'Xử phạt & Khóa tài khoản'}</h3>
              </div>
              <button
                onClick={() => setSanctionDialog(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <p>
                {isEn ? 'You are locking the account of user ' : 'Bạn đang thực hiện khóa tài khoản của người dùng '}
                <strong className="text-slate-900 dark:text-slate-100 font-semibold">
                  {sanctionDialog.user.name || sanctionDialog.user.username}
                </strong>{' '}
                (@{sanctionDialog.user.username}).
              </p>

              {/* Lựa chọn loại khóa */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-800 dark:text-slate-200 block">{isEn ? 'Sanction Type:' : 'Hình thức xử phạt:'}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSanctionDialog(prev => ({ ...prev, isTemp: true }))}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      sanctionDialog.isTemp
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Temporary Lock' : 'Khóa tạm thời'}</span>
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">{isEn ? 'Restricted login for a limited time' : 'Không cho đăng nhập có thời hạn'}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSanctionDialog(prev => ({ ...prev, isTemp: false }))}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      !sanctionDialog.isTemp
                        ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Permanent Ban' : 'Khóa vĩnh viễn'}</span>
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">{isEn ? 'Severe community guidelines violation' : 'Vi phạm nghiêm trọng tiêu chuẩn'}</div>
                  </button>
                </div>
              </div>

              {/* Thời hạn khóa nếu là tạm thời */}
              {sanctionDialog.isTemp && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800 dark:text-slate-200 block">{isEn ? 'Lock Duration:' : 'Thời gian khóa:'}</label>
                  <select
                    value={sanctionDialog.durationDays}
                    onChange={(e) => setSanctionDialog(prev => ({ ...prev, durationDays: Number(e.target.value) }))}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value={1}>{isEn ? '1 day (24 hours)' : '1 ngày (24 giờ)'}</option>
                    <option value={3}>{isEn ? '3 days (72 hours)' : '3 ngày (72 giờ)'}</option>
                    <option value={7}>{isEn ? '7 days (1 week)' : '7 ngày (1 tuần)'}</option>
                    <option value={30}>{isEn ? '30 days (1 month)' : '30 ngày (1 tháng)'}</option>
                  </select>
                </div>
              )}

              {/* Lý do khóa */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 dark:text-slate-200 block">{isEn ? 'Lock Reason:' : 'Lý do khóa tài khoản:'}</label>
                <input
                  type="text"
                  value={sanctionDialog.reason}
                  onChange={(e) => setSanctionDialog(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder={isEn ? "Enter violation reason (e.g., Harassment, Hate speech...)" : "Nhập lý do vi phạm (ví dụ: Vi phạm bạo lực, ngôn từ thù địch...)"}
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                {sanctionDialog.isTemp
                  ? (isEn 
                      ? `User will not be able to log in for ${sanctionDialog.durationDays} days. After expiry, access is restored automatically.` 
                      : `Người dùng sẽ không thể đăng nhập trong ${sanctionDialog.durationDays} ngày. Sau khi hết thời hạn, hệ thống sẽ tự động khôi phục quyền truy cập.`)
                  : (isEn 
                      ? 'This account will be permanently banned and cannot log in until manually unlocked by an Admin.' 
                      : 'Tài khoản này sẽ bị khóa hoàn toàn và không thể đăng nhập cho đến khi Admin chủ động mở khóa thủ công.')}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setSanctionDialog(null)}
                disabled={isSanctioning}
                className="h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                {isEn ? 'Cancel' : 'Hủy'}
              </button>

              <button
                type="button"
                onClick={handleConfirmSanction}
                disabled={isSanctioning}
                className={`h-8 px-3.5 rounded-xl text-white text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                  sanctionDialog.isTemp
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSanctioning 
                  ? (isEn ? 'Processing...' : 'Đang thực hiện...') 
                  : (isEn ? 'Confirm Lock Account' : 'Xác nhận khóa tài khoản')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

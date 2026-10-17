import { useState, useEffect, useCallback } from 'react';
import { 
  Users, LayoutDashboard, Shield, Search, RefreshCw, 
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle, 
  ExternalLink, UserCheck, ArrowRight, X
} from 'lucide-react';
import { fetchUsersList, updateUserRoleApi } from '../api/client';
import { ROLES, ROLE_LABELS, normalizeRole } from '../utils/rbac';
import { DEFAULT_AVATAR } from '../constants/defaults';

export default function AdminDashboardView({ 
  currentUser,
  onNavigateToModeration
}) {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Khu vực quản trị hệ thống</h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
              Admin
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Quản lý tài khoản người dùng, phân cấp vai trò và giám sát vận hành nền tảng.
          </p>
        </div>

        {/* Nút truy cập khu vực kiểm duyệt dành cho Admin */}
        {onNavigateToModeration && (
          <button
            onClick={onNavigateToModeration}
            className="h-9 px-3.5 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2 transition cursor-pointer self-start sm:self-auto"
          >
            <Shield className="w-4 h-4 text-blue-600" />
            <span>Mở khu vực kiểm duyệt</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Tabs điều hướng chính: Người dùng & Dashboard */}
      <div className="flex items-center gap-2 mt-6 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('users')}
          className={`h-9 px-4 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Người dùng và phân quyền</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`h-9 px-4 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'dashboard'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Tổng quan hệ thống</span>
        </button>
      </div>

      {/* TAB 1: QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN (CHẠY THẬT) */}
      {activeTab === 'users' && (
        <div className="mt-6">
          {/* Thanh công cụ: Tìm kiếm, lọc vai trò, nút làm mới */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Form tìm kiếm */}
              <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên, email, tên người dùng..."
                  className="w-full h-9 pl-9 pr-8 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition"
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
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Vai trò:</span>
                  <select
                    value={selectedRoleFilter}
                    onChange={(e) => handleRoleFilterChange(e.target.value)}
                    className="h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value="all">Tất cả vai trò</option>
                    <option value="admin">Quản trị viên</option>
                    <option value="moderator">Điều hành viên</option>
                    <option value="user">Người dùng</option>
                  </select>
                </div>

                <button
                  onClick={() => loadUsers(page, searchQuery, selectedRoleFilter)}
                  disabled={loading}
                  title="Tải lại danh sách"
                  className="h-9 px-3 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Làm mới</span>
                </button>
              </div>
            </div>
          </div>

          {/* BẢNG DANH SÁCH NGƯỜI DÙNG */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
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
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-900">Không thể tải danh sách người dùng</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{error}</p>
                <button
                  onClick={() => loadUsers(page, searchQuery, selectedRoleFilter)}
                  className="mt-4 h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            ) : users.length === 0 ? (
              // Trạng thái rỗng / không tìm thấy kết quả
              <div className="p-8 text-center">
                <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-900">
                  {searchQuery || selectedRoleFilter !== 'all' 
                    ? 'Không có kết quả phù hợp'
                    : 'Chưa có người dùng nào'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery || selectedRoleFilter !== 'all'
                    ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc vai trò.'
                    : 'Hệ thống hiện chưa có tài khoản người dùng nào được tạo.'}
                </p>
                {(searchQuery || selectedRoleFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedRoleFilter('all');
                      setPage(1);
                      loadUsers(1, '', 'all');
                    }}
                    className="mt-4 h-8 px-3 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition cursor-pointer"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            ) : (
              // Bảng dữ liệu người dùng
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Người dùng</th>
                      <th className="py-3 px-4">Liên hệ</th>
                      <th className="py-3 px-4">Vai trò hiện tại</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Phân vai trò</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {users.map((user) => {
                      const userRole = normalizeRole(user.role);
                      const isSelf = user.id === currentUser?.id;

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/70 transition">
                          {/* Cột 1: Thông tin người dùng */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={user.avatar || user.avatar_url || DEFAULT_AVATAR}
                                alt={user.name || user.username}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                              <div>
                                <div className="font-medium text-slate-900 flex items-center gap-1.5">
                                  <span>{user.name || user.full_name || 'Người dùng'}</span>
                                  {isSelf && (
                                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                      Bạn
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  @{user.username || 'user'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Cột 2: Email & Số điện thoại */}
                          <td className="py-3 px-4">
                            <div className="text-slate-800">{user.email || '—'}</div>
                            {user.phone && (
                              <div className="text-[11px] text-slate-500">{user.phone}</div>
                            )}
                          </td>

                          {/* Cột 3: Vai trò hiện tại */}
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
                              userRole === ROLES.ADMIN
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : userRole === ROLES.MODERATOR
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {ROLE_LABELS[userRole]}
                            </span>
                          </td>

                          {/* Cột 4: Trạng thái tài khoản */}
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                              user.status === 'banned'
                                ? 'bg-rose-50 text-rose-700'
                                : user.status === 'cooldown'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {user.status === 'banned' ? 'Đã khóa' : user.status === 'cooldown' ? 'Tạm giữ' : 'Hoạt động'}
                            </span>
                          </td>

                          {/* Cột 5: Đổi vai trò */}
                          <td className="py-3 px-4 text-right">
                            <select
                              value={userRole}
                              disabled={isSelf}
                              title={isSelf ? 'Bạn không thể tự đổi vai trò của chính mình' : 'Chọn vai trò mới cho người dùng này'}
                              onChange={(e) => handleOpenConfirmDialog(user, e.target.value)}
                              className="h-8 px-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <option value="user">Người dùng</option>
                              <option value="moderator">Điều hành viên</option>
                              <option value="admin">Quản trị viên</option>
                            </select>
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
              <div className="py-3 px-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
                <div>
                  Hiển thị {(page - 1) * pagination.limit + 1} - {Math.min(page * pagination.limit, pagination.total)} trên tổng số {pagination.total} người dùng
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-8 px-2.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Trước</span>
                  </button>

                  <span className="px-2 font-medium text-slate-700">
                    Trang {page} / {pagination.totalPages}
                  </span>

                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="h-8 px-2.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                  >
                    <span>Sau</span>
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
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 font-medium">Tổng số tài khoản</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{pagination.total}</div>
              <div className="text-[11px] text-slate-500 mt-1">Đã đăng ký trong hệ thống</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 font-medium">Quản trị viên (Admin)</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {users.filter(u => normalizeRole(u.role) === ROLES.ADMIN).length || 1}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Nắm toàn quyền hệ thống</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 font-medium">Điều hành viên (Moderator)</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">
                {users.filter(u => normalizeRole(u.role) === ROLES.MODERATOR).length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Chịu trách nhiệm kiểm duyệt</div>
            </div>
          </div>

          {/* Khung UI Placeholder trung thực theo quy chuẩn Prompt 1 & Prompt 2 */}
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Báo cáo & Kiểm duyệt nội dung</h3>
                <p className="text-xs text-slate-500 mt-0.5">Khung giao diện theo dõi tiến trình kiểm duyệt.</p>
              </div>
              {onNavigateToModeration && (
                <button
                  onClick={onNavigateToModeration}
                  className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>Mở trang kiểm duyệt</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="py-12 text-center">
              <Shield className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-medium text-slate-800">Chưa có số liệu thống kê tự động</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Bảng điều khiển KPI sẽ cập nhật số liệu tự động khi kích hoạt đầy đủ mô hình kiểm duyệt PhoBERT và luồng tiếp nhận báo cáo.
              </p>
              <div className="mt-4">
                <span className="inline-block text-[11px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                  TODO: Dựng biểu đồ thống kê vi phạm khi hoàn thiện module AI
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN ĐỔI VAI TRÒ (Có nêu rõ đối tượng và hệ quả theo Prompt 1 & Prompt 2) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-md w-full p-5 shadow-lg animate-fade-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Xác nhận đổi vai trò</h3>
              </div>
              <button
                onClick={() => setConfirmDialog(null)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-700">
              <p>
                Bạn có chắc chắn muốn đổi vai trò của tài khoản{' '}
                <strong className="text-slate-900 font-semibold">
                  {confirmDialog.user.name || confirmDialog.user.full_name}
                </strong>{' '}
                (@{confirmDialog.user.username}) từ{' '}
                <span className="font-semibold">{ROLE_LABELS[normalizeRole(confirmDialog.user.role)]}</span> sang{' '}
                <span className="font-bold text-blue-600">{ROLE_LABELS[confirmDialog.newRole]}</span>?
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600">
                <span className="font-semibold text-slate-800">Hệ quả: </span>
                {getRoleConsequenceText(confirmDialog.newRole)}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={isUpdating}
                className="h-8 px-3 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition cursor-pointer"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleConfirmRoleChange}
                disabled={isUpdating}
                className="h-8 px-3.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition cursor-pointer disabled:opacity-50"
              >
                {isUpdating ? 'Đang cập nhật...' : 'Đổi vai trò'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

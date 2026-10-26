import { useEffect, useState } from 'react';
import { 
  AlertTriangle, FileText, MessageSquare, 
  Search, EyeOff, ArrowLeft, CheckCircle2,
  XCircle, Clock, ShieldAlert, Check, X,
  User, RefreshCw, Eye, Scale, Sparkles,
  FileSpreadsheet, Download, AlertCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';
import ReportResolutionModal from './ReportResolutionModal';
import AppealResolutionModal from './AppealResolutionModal';
import { exportOverrideLogsToExcel, exportOverrideLogsToCSV } from '../utils/exportUtils';
import { fetchPendingImageModeration, fetchImageAppealQueue, reviewImageModeration } from '../api/client';
import { applyImageReviewQueueResult, getImageReviewFailure } from '../utils/imageModerationReviewLogic';
import ImageModerationQueue from './ImageModerationQueue';

/**
 * Khu vực Kiểm duyệt nội dung (Moderator View)
 * Bao gồm:
 * 1. Báo cáo (reports) - Danh sách báo cáo vi phạm & xử lý (Báo cáo sai -> giữ nhãn; Báo cáo đúng -> gắn lại nhãn)
 * 2. Khiếu nại (appeals) - Xem xét lại phán quyết AI & minh oan (gỡ án phạt ngay lập tức)
 * 3. Nội dung bị ẩn (hidden content) - Giám sát và khôi phục bài viết / bình luận bị ẩn
 * 4. Nhật ký gán nhãn & Xuất file (overrides) - Xuất danh sách nhãn sai ra CSV / Excel
 */
export default function ModeratorView({
  onBackToAdmin,
  isAdmin = false,
  appeals = [],
  onResolveAppeal,
  reports = [],
  onResolveReport,
  aiOverrides = [],
  posts = [],
  onUnhidePost,
  currentUser,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState('appeals'); // 'reports' | 'appeals' | 'hidden-content' | 'overrides'
  const [appealFilter, setAppealFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [appealTypeFilter, setAppealTypeFilter] = useState('all'); // 'all' | 'post' | 'comment'
  const [appealLabelFilter, setAppealLabelFilter] = useState('all'); // 'all' | 'Toxic' | 'Hate Speech' | 'Violence' | 'Normal'
  const [appealCurrentPage, setAppealCurrentPage] = useState(1);
  const [hiddenContentSubTab, setHiddenContentSubTab] = useState('posts'); // 'posts' | 'comments'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppealForResolve, setSelectedAppealForResolve] = useState(null);
  const [isResolvingAppeal, setIsResolvingAppeal] = useState(false);
  const [selectedReportForResolve, setSelectedReportForResolve] = useState(null);
  const [isResolvingReport, setIsResolvingReport] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: '' }
  const [imageReviewItems, setImageReviewItems] = useState([]);
  const [imageAppealItems, setImageAppealItems] = useState([]);
  const [pendingImageDecision, setPendingImageDecision] = useState(null);
  const appealsPerPage = 10;

  const loadImageQueues = async () => {
    if (!currentUser?.id) return;
    const [first, final] = await Promise.all([
      fetchPendingImageModeration(currentUser.id),
      fetchImageAppealQueue(currentUser.id),
    ]);
    setImageReviewItems(first.data || []);
    setImageAppealItems(final.data || []);
  };

  useEffect(() => {
    loadImageQueues().catch((error) => {
      setToast(failure.toast);
    });
  }, [currentUser?.id]);

  const handleImageDecision = async (item, stage, decision) => {
    const key = `${item.type}-${item.id}`;
    if (pendingImageDecision) return;
    setPendingImageDecision(key);
    try {
      await reviewImageModeration({ userId: currentUser?.id, contentType: item.type, id: item.id, stage, decision });
      const setItems = stage === 'first' ? setImageReviewItems : setImageAppealItems;
      setItems((previous) => applyImageReviewQueueResult(previous, item, { succeeded: true }));
      setToast({ type: 'success', message: stage === 'first' ? 'Đã duyệt ảnh thành công.' : 'Đã giải quyết khiếu nại ảnh.' });
    } catch (error) {
      const failure = getImageReviewFailure(error);
      if (failure.removeItem) {
        const setItems = stage === 'first' ? setImageReviewItems : setImageAppealItems;
        setItems((previous) => applyImageReviewQueueResult(previous, item, { status: 409 }));
      }
      setToast(failure.toast);
    } finally {
      setPendingImageDecision(null);
      setTimeout(() => setToast(null), 4500);
    }
  };

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
      await loadImageQueues();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Lọc danh sách khiếu nại (có sắp xếp pending lên đầu)
  const filteredAppeals = appeals.filter(a => {
    if (appealFilter !== 'all' && a.status !== appealFilter) return false;
    if (appealTypeFilter !== 'all' && a.contentType !== appealTypeFilter) return false;
    if (appealLabelFilter !== 'all' && a.aiPredictedLabel !== appealLabelFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const userName = (a.user?.name || '').toLowerCase();
      const userNick = (a.user?.username || '').toLowerCase();
      const text = (a.originalText || '').toLowerCase();
      const reason = (a.appealReason || '').toLowerCase();
      return userName.includes(q) || userNick.includes(q) || text.includes(q) || reason.includes(q);
    }
    return true;
  }).sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });

  const pendingAppealsCount = appeals.filter(a => a.status === 'pending').length;
  const totalPages = Math.ceil(filteredAppeals.length / appealsPerPage) || 1;
  const paginatedAppeals = filteredAppeals.slice((appealCurrentPage - 1) * appealsPerPage, appealCurrentPage * appealsPerPage);

  const handleConfirmResolveAppeal = async (appealId, resolutionData) => {
    setIsResolvingAppeal(true);
    try {
      if (onResolveAppeal) {
        await onResolveAppeal(appealId, resolutionData);
      }
      setSelectedAppealForResolve(null);
      setToast({
        type: 'success',
        message: resolutionData.status === 'approved'
          ? `Đã chấp thuận khiếu nại và gán nhãn "${resolutionData.newLabel}".`
          : 'Đã từ chối khiếu nại và giữ nguyên nhãn ban đầu.'
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      const isConflict = err.status === 409 || (err.message && (err.message.includes('409') || err.message.includes('trước đó')));
      setToast({
        type: 'error',
        message: isConflict
          ? 'Khiếu nại này đã được người khác xử lý trước đó.'
          : (err.message || 'Không thể xử lý khiếu nại. Vui lòng thử lại.')
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsResolvingAppeal(false);
    }
  };

  // Lọc bài viết bị ẩn
  const hiddenPosts = posts.filter(p => {
    const isHidden = p.isHidden || p.ai_status === 'hidden' || p.ai_status === 'soft_hidden';
    if (!isHidden) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const content = (p.content || '').toLowerCase();
      const author = (p.author?.name || p.full_name || '').toLowerCase();
      return content.includes(q) || author.includes(q);
    }
    return true;
  });

  // Trích xuất bình luận bị ẩn từ toàn bộ bài viết
  const hiddenComments = posts.flatMap(p => {
    const cmts = p.comments || [];
    return cmts
      .filter(c => c.isHidden || c.is_hidden || c.ai_status === 'hidden' || c.ai_status === 'soft_hidden' || c.isSoftHidden)
      .map(c => ({ ...c, parentPost: p }));
  }).filter(c => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const content = (c.content || '').toLowerCase();
      const author = (c.author?.name || '').toLowerCase();
      return content.includes(q) || author.includes(q);
    }
    return true;
  });

  const getLabelBadge = (label) => {
    switch (label) {
      case 'Violence':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Bạo lực (Violence)</span>;
      case 'Hate Speech':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">Thù địch (Hate Speech)</span>;
      case 'Toxic':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Độc hại (Toxic)</span>;
      case 'Normal':
      case 'Safe':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Bình thường (Normal)</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">{label || 'Vi phạm'}</span>;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      {/* Toast thông báo kết quả */}
      {toast && (
        <div className={`mb-4 p-3 rounded-md border text-xs flex items-center justify-between transition ${
          toast.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header khu vực kiểm duyệt */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            {isAdmin && onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="h-8 px-2.5 rounded-md border border-slate-200 hover:bg-slate-50 text-xs text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Về trang quản trị</span>
              </button>
            )}
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Khu vực kiểm duyệt</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Xử lý báo cáo vi phạm, giải quyết khiếu nại minh oan và giám sát nội dung bị ẩn.
          </p>
        </div>

        {/* Nút làm mới CSDL & Thanh tìm kiếm */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onRefresh && (
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-9 px-3 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 shrink-0"
              title="Tải lại toàn bộ dữ liệu mới nhất từ CSDL PostgreSQL"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Đang tải...' : 'Làm mới CSDL'}</span>
            </button>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo nội dung, tác giả..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition"
            />
          </div>
        </div>
      </div>

      {/* Tabs điều hướng cấp 1 */}
      <div className="flex items-center gap-2 mt-6 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('image-review')}
          className={`h-9 px-4 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${activeTab === 'image-review' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Eye className="w-4 h-4" /><span>Duyệt ảnh</span>
          {imageReviewItems.length > 0 && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{imageReviewItems.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('image-appeals')}
          className={`h-9 px-4 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${activeTab === 'image-appeals' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Scale className="w-4 h-4" /><span>Duyệt khiếu nại</span>
          {imageAppealItems.length > 0 && <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{imageAppealItems.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('appeals')}
          className={`h-9 px-4 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'appeals'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Khiếu nại</span>
          {pendingAppealsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
              {pendingAppealsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`h-9 px-4 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Báo cáo</span>
          {reports.filter(r => r.status === 'pending').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
              {reports.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('hidden-content')}
          className={`h-9 px-4 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'hidden-content'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <EyeOff className="w-4 h-4" />
          <span>Nội dung bị ẩn</span>
          {(hiddenPosts.length + hiddenComments.length) > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700">
              {hiddenPosts.length + hiddenComments.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('overrides')}
          className={`h-9 px-4 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'overrides'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Nhật ký gán nhãn &amp; Xuất file</span>
          {aiOverrides.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
              {aiOverrides.length}
            </span>
          )}
        </button>
      </div>

      {/* NỘI DUNG TỪNG PHÂN HỆ */}
      <div className="mt-6">

        {activeTab === 'image-review' && (
          <ImageModerationQueue
            items={imageReviewItems}
            stage="first"
            pendingKey={pendingImageDecision}
            onDecision={handleImageDecision}
            emptyText="Không có ảnh nào đang chờ duyệt"
          />
        )}

        {activeTab === 'image-appeals' && (
          <ImageModerationQueue
            items={imageAppealItems}
            stage="final"
            pendingKey={pendingImageDecision}
            onDecision={handleImageDecision}
            emptyText="Không có khiếu nại nào đang chờ duyệt"
          />
        )}
        
        {/* TAB 1: KHIẾU NẠI (APPEALS) */}
        {activeTab === 'appeals' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Danh sách khiếu nại</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Xử lý khiếu nại từ thành viên: Chấp nhận khiếu nại (đổi nhãn &amp; gỡ phạt), Từ chối khiếu nại (giữ nguyên nhãn và hình phạt).
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-slate-500 font-medium">
                  {appeals.length} khiếu nại ({pendingAppealsCount} chờ xử lý)
                </span>
              </div>
            </div>

            {/* Thanh bộ lọc */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
              {/* Lọc theo trạng thái */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setAppealFilter('all'); setAppealCurrentPage(1); }}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition cursor-pointer ${
                    appealFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({appeals.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setAppealFilter('pending'); setAppealCurrentPage(1); }}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition cursor-pointer ${
                    appealFilter === 'pending'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Chờ xử lý ({pendingAppealsCount})
                </button>
                <button
                  type="button"
                  onClick={() => { setAppealFilter('approved'); setAppealCurrentPage(1); }}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition cursor-pointer ${
                    appealFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Đã chấp nhận ({appeals.filter(a => a.status === 'approved').length})
                </button>
                <button
                  type="button"
                  onClick={() => { setAppealFilter('rejected'); setAppealCurrentPage(1); }}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition cursor-pointer ${
                    appealFilter === 'rejected'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Đã từ chối ({appeals.filter(a => a.status === 'rejected').length})
                </button>
              </div>

              {/* Lọc theo loại nội dung & nhãn */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={appealTypeFilter}
                  onChange={(e) => { setAppealTypeFilter(e.target.value); setAppealCurrentPage(1); }}
                  className="h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="all">Tất cả loại nội dung</option>
                  <option value="post">Bài viết</option>
                  <option value="comment">Bình luận</option>
                </select>

                <select
                  value={appealLabelFilter}
                  onChange={(e) => { setAppealLabelFilter(e.target.value); setAppealCurrentPage(1); }}
                  className="h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="all">Tất cả nhãn hiện tại</option>
                  <option value="Toxic">Độc hại (Toxic)</option>
                  <option value="Hate Speech">Thù địch (Hate Speech)</option>
                  <option value="Violence">Bạo lực (Violence)</option>
                  <option value="Normal">Bình thường (Normal)</option>
                </select>

                {(appealFilter !== 'all' || appealTypeFilter !== 'all' || appealLabelFilter !== 'all' || searchQuery.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAppealFilter('all');
                      setAppealTypeFilter('all');
                      setAppealLabelFilter('all');
                      setSearchQuery('');
                      setAppealCurrentPage(1);
                    }}
                    className="h-8 px-2.5 text-xs text-slate-500 hover:text-slate-800 transition underline cursor-pointer"
                  >
                    Đặt lại bộ lọc
                  </button>
                )}
              </div>
            </div>

            {/* Bảng danh sách khiếu nại */}
            {filteredAppeals.length === 0 ? (
              appeals.length === 0 ? (
                <div className="py-12 text-center border border-slate-200 rounded-md bg-slate-50/50">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">Chưa có khiếu nại nào cần xử lý</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Hiện không có đơn khiếu nại nào được gửi từ người dùng. Khi có khiếu nại mới, đơn sẽ xuất hiện tại đây.
                  </p>
                </div>
              ) : (
                <div className="py-12 text-center border border-slate-200 rounded-md bg-slate-50/50">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
                    <Search className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">Không tìm thấy khiếu nại nào phù hợp</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Không có kết quả nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAppealFilter('all');
                      setAppealTypeFilter('all');
                      setAppealLabelFilter('all');
                      setSearchQuery('');
                      setAppealCurrentPage(1);
                    }}
                    className="mt-3 h-8 px-3 text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md font-medium transition cursor-pointer"
                  >
                    Đặt lại bộ lọc
                  </button>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 w-72">Nội dung khiếu nại</th>
                        <th className="py-3 px-3 w-28">Loại</th>
                        <th className="py-3 px-3 w-36">Nhãn hiện tại</th>
                        <th className="py-3 px-3 w-44">Người khiếu nại</th>
                        <th className="py-3 px-3 w-36">Ngày gửi</th>
                        <th className="py-3 px-3 w-32">Trạng thái</th>
                        <th className="py-3 px-4 text-right w-36">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {paginatedAppeals.map((appeal) => (
                        <tr key={appeal.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-start gap-2.5">
                              {appeal.imageUrl && (
                                <img
                                  src={appeal.imageUrl}
                                  alt="Thumbnail"
                                  className="w-10 h-10 rounded object-cover border border-slate-200 shrink-0 cursor-pointer hover:opacity-90"
                                  onClick={() => window.open(appeal.imageUrl, '_blank')}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-slate-900 font-medium line-clamp-2 leading-relaxed">
                                  "{appeal.originalText || '[Không có nội dung văn bản]'}"
                                </p>
                                {appeal.appealReason && (
                                  <p className="text-slate-500 text-[11px] line-clamp-1 mt-0.5 italic">
                                    Giải trình: {appeal.appealReason}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {appeal.contentType === 'comment' ? 'Bình luận' : 'Bài viết'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {getLabelBadge(appeal.aiPredictedLabel)}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <img
                                src={appeal.user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{appeal.user?.name || 'Người dùng'}</p>
                                <p className="text-slate-400 text-[11px] truncate">@{appeal.user?.username || 'user'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-[11px]">
                            {appeal.createdAt || 'Vừa xong'}
                          </td>
                          <td className="py-3 px-3">
                            {appeal.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                <span>Chờ xử lý</span>
                              </span>
                            )}
                            {appeal.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Đã chấp nhận</span>
                              </span>
                            )}
                            {appeal.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                <XCircle className="w-3 h-3" />
                                <span>Đã từ chối</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {appeal.status === 'pending' ? (
                              <button
                                type="button"
                                onClick={() => setSelectedAppealForResolve(appeal)}
                                className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold transition cursor-pointer inline-flex items-center gap-1 shadow-xs"
                              >
                                <Scale className="w-3.5 h-3.5" />
                                <span>Xử lý khiếu nại</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedAppealForResolve(appeal)}
                                className="h-8 px-2.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer inline-flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>Xem chi tiết</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Phân trang (Pagination) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 text-xs text-slate-500">
                  <div>
                    Hiển thị <strong>{Math.min((appealCurrentPage - 1) * appealsPerPage + 1, filteredAppeals.length)}</strong> đến <strong>{Math.min(appealCurrentPage * appealsPerPage, filteredAppeals.length)}</strong> trên tổng số <strong>{filteredAppeals.length}</strong> khiếu nại
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAppealCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={appealCurrentPage === 1}
                        className="h-8 px-2.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                      >
                        Trước
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setAppealCurrentPage(page)}
                          className={`h-8 w-8 rounded text-xs font-medium transition cursor-pointer ${
                            appealCurrentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAppealCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={appealCurrentPage === totalPages}
                        className="h-8 px-2.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                      >
                        Sau
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BÁO CÁO (REPORTS) */}
        {activeTab === 'reports' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Danh sách báo cáo vi phạm</h2>
                <p className="text-xs text-slate-500 mt-0.5">Xử lý báo cáo từ thành viên: Báo cáo sai (giữ nguyên nhãn), Báo cáo đúng (gán lại nhãn Toxic, Hate Speech, Violence).</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => exportOverrideLogsToCSV(aiOverrides)}
                  className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                  title="Xuất file CSV chuẩn UTF-8 BOM mở bằng Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất file (CSV / Excel)</span>
                </button>
                <span className="text-xs text-slate-500">
                  {reports.length} báo cáo
                </span>
              </div>
            </div>

            {reports.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Chưa có báo cáo nào cần xử lý</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Hiện tại không có mục nào đang ở trạng thái chờ duyệt. Các báo cáo mới từ người dùng sẽ xuất hiện tại đây.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-4">
                {reports.map(report => (
                  <div key={report.id} className="py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900">{report.reporter?.name || 'Người dùng'}</span>
                        <span className="text-slate-500">báo cáo vi phạm:</span>
                        <span className="font-medium text-rose-600">{report.reason || 'Nội dung không phù hợp'}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{report.createdAt || 'Vừa xong'}</span>
                    </div>
                    {(report.targetExcerpt || report.imageUrl) && (
                      <div className="p-3 bg-slate-50 rounded text-xs text-slate-700 italic border border-slate-200">
                        {report.targetExcerpt && <p>"{report.targetExcerpt}"</p>}
                        {report.imageUrl && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center gap-2 not-italic">
                            <img
                              src={report.imageUrl}
                              alt="Hình ảnh vi phạm"
                              className="w-14 h-14 object-cover rounded-lg border border-slate-300 shadow-2xs cursor-pointer hover:opacity-90"
                              onClick={() => window.open(report.imageUrl, '_blank')}
                            />
                            <span className="text-[11px] text-slate-500 font-medium">Hình ảnh đính kèm trong báo cáo (bấm để xem ảnh gốc)</span>
                          </div>
                        )}
                      </div>
                    )}
                    {report.status === 'pending' ? (
                      <div className="flex items-center gap-2 justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedReportForResolve(report)}
                          className="h-8 px-3.5 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Xử lý báo cáo</span>
                        </button>
                      </div>
                    ) : (
                      <div className="pt-1">
                        {report.status === 'resolved_violation' && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>
                                <strong>Báo cáo ĐÚNG:</strong> Đã xác nhận vi phạm &amp; gán lại nhãn <strong className="uppercase underline">{report.newLabel || 'Toxic'}</strong>
                              </span>
                            </div>
                            {report.adminNotes && (
                              <span className="text-[11px] text-slate-500 italic max-w-sm truncate">
                                Ghi chú: {report.adminNotes}
                              </span>
                            )}
                          </div>
                        )}
                        {report.status === 'dismissed' && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>
                                <strong>Báo cáo SAI:</strong> Bác bỏ báo cáo &amp; giữ nguyên nhãn ban đầu (<strong>{report.oldLabel || 'Normal'}</strong>)
                              </span>
                            </div>
                            {report.adminNotes && (
                              <span className="text-[11px] text-slate-500 italic max-w-sm truncate">
                                Ghi chú: {report.adminNotes}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NỘI DUNG BỊ ẨN (HIDDEN CONTENT) */}
        {activeTab === 'hidden-content' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Nội dung bị ẩn</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các bài viết và bình luận đã bị ẩn do vi phạm tiêu chuẩn hoặc kiểm duyệt tự động.
                </p>
              </div>

              {/* Sub-tabs: Bài viết & Bình luận */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => setHiddenContentSubTab('posts')}
                  className={`h-7 px-3 text-xs rounded transition cursor-pointer font-medium ${
                    hiddenContentSubTab === 'posts'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bài viết ({hiddenPosts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHiddenContentSubTab('comments')}
                  className={`h-7 px-3 text-xs rounded transition cursor-pointer font-medium ${
                    hiddenContentSubTab === 'comments'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bình luận ({hiddenComments.length})
                </button>
              </div>
            </div>

            {/* Nội dung subtab Bài viết */}
            {hiddenContentSubTab === 'posts' && (
              hiddenPosts.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">Không có bài viết nào đang bị ẩn</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Tất cả bài viết trên hệ thống hiện đang hiển thị bình thường.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 mt-4">
                  {hiddenPosts.map(post => (
                    <div key={post.id} className="py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">{post.author?.name || post.full_name || 'Người dùng'}</span>
                          {getLabelBadge(post.ai_label || post.aiStatus?.label)}
                          <span className="text-[11px] text-slate-400">{post.created_at || 'Gần đây'}</span>
                        </div>
                        {onUnhidePost && (
                          <button
                            type="button"
                            onClick={() => onUnhidePost(post.id)}
                            className="h-7 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Khôi phục bài viết</span>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 italic">
                        "{post.content || '[Hình ảnh]'}"
                      </p>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Nội dung subtab Bình luận */}
            {hiddenContentSubTab === 'comments' && (
              hiddenComments.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">Không có bình luận nào đang bị ẩn</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Không có bình luận vi phạm nào cần xem xét phục hồi.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 mt-4">
                  {hiddenComments.map(comment => (
                    <div key={comment.id} className="py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">{comment.author?.name || 'Người dùng'}</span>
                          {getLabelBadge(comment.ai_label || comment.aiLabel)}
                          <span className="text-[11px] text-slate-400">{comment.createdAt || 'Gần đây'}</span>
                        </div>
                        {onResolveAppeal && (
                          <button
                            type="button"
                            onClick={() => {
                              // Khôi phục bình luận
                              const appeal = appeals.find(a => a.contentId === comment.id);
                              if (appeal) {
                                onResolveAppeal(appeal.id, 'approved', 'Khôi phục bình luận');
                              }
                            }}
                            className="h-7 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Khôi phục bình luận</span>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 italic">
                        "{comment.content || '[Hình ảnh]'}"
                      </p>
                      {comment.parentPost && (
                        <div className="text-[11px] text-slate-500">
                          Bình luận thuộc bài viết của <strong>{comment.parentPost.author?.name || comment.parentPost.full_name}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* TAB 4: NHẬT KÝ HIỆU CHỈNH NHÃN & XUẤT FILE */}
        {activeTab === 'overrides' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    Nhật ký hiệu chỉnh nhãn AI &amp; Xuất dữ liệu
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Lưu vết toàn bộ các câu văn, hình ảnh được Quản trị viên/Điều hành viên hiệu chỉnh lại nhãn từ báo cáo vi phạm hoặc khiếu nại.
                </p>
              </div>

              {/* Nút hành động Xuất File */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={`/api/admin/ai-overrides/export-excel${currentUser?.id ? `?userId=${encodeURIComponent(currentUser.id)}` : ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-3.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                  title="Tải trực tiếp file Excel (.xlsx) qua API Backend từ CSDL"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tải từ Máy chủ</span>
                </a>
                <button
                  type="button"
                  onClick={() => exportOverrideLogsToCSV(aiOverrides)}
                  className="h-9 px-3 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  title="Xuất file định dạng CSV UTF-8 BOM"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Xuất CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportOverrideLogsToExcel(aiOverrides)}
                  className="h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-2"
                  title="Xuất trực tiếp file Excel (.xlsx) chuẩn cột A -> H"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Xuất file (Excel .xlsx)</span>
                </button>
              </div>
            </div>

            {aiOverrides.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Chưa có bản ghi hiệu chỉnh nào</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Khi bạn duyệt báo cáo đúng và gán lại nhãn mới, các bản ghi sẽ tự động xuất hiện tại đây để bạn xuất file Excel / CSV.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                      <th className="py-3 px-3 w-16 text-center">A: STT</th>
                      <th className="py-3 px-4 min-w-[240px]">B: Nội dung câu / Hình ảnh gắn nhãn sai</th>
                      <th className="py-3 px-3 w-28">C: Nhãn cũ</th>
                      <th className="py-3 px-3 w-28">D: Nhãn mới</th>
                      <th className="py-3 px-3 w-28">E: Loại nội dung</th>
                      <th className="py-3 px-4 min-w-[180px]">F: Lý do hiệu chỉnh / Ghi chú</th>
                      <th className="py-3 px-3 w-32">G: Người thực hiện</th>
                      <th className="py-3 px-3 w-32">H: Thời gian ghi nhận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aiOverrides.map((log, index) => (
                      <tr key={log.id || index} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3 text-center font-medium text-slate-500">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <p className="text-slate-900 font-medium line-clamp-2">
                              "{log.rawText || log.content || '(Không có nội dung)'}"
                            </p>
                            {log.imageUrl && (
                              <a 
                                href={log.imageUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-mono"
                              >
                                <span>[Link hình ảnh đính kèm]</span>
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {log.originalAiLabel || 'Normal'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {getLabelBadge(log.correctedLabel || 'Toxic')}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] text-slate-600 font-medium">
                            {log.contentType === 'post' ? 'Bài viết' : log.contentType === 'comment' ? 'Bình luận' : 'Khác'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {log.overrideReason || log.adminNotes || 'Xử lý báo cáo vi phạm'}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {log.adminName || 'Điều Hành Viên'}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-400">
                          {log.createdAt || 'Gần đây'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL XỬ LÝ BÁO CÁO VI PHẠM (Báo cáo sai -> giữ nhãn; Báo cáo đúng -> gán lại nhãn) */}
      <ReportResolutionModal
        isOpen={Boolean(selectedReportForResolve)}
        report={selectedReportForResolve}
        onClose={() => setSelectedReportForResolve(null)}
        isSubmitting={isResolvingReport}
        onConfirmResolve={async (reportId, resolutionData) => {
          setIsResolvingReport(true);
          try {
            if (onResolveReport) {
              await onResolveReport(reportId, resolutionData);
            }
            setSelectedReportForResolve(null);
          } finally {
            setIsResolvingReport(false);
          }
        }}
      />

      {/* MODAL XỬ LÝ KHIẾU NẠI (Từ chối -> giữ nhãn & phạt; Chấp nhận -> đổi nhãn, gỡ phạt & ghi log) */}
      <AppealResolutionModal
        isOpen={Boolean(selectedAppealForResolve)}
        appeal={selectedAppealForResolve}
        onClose={() => setSelectedAppealForResolve(null)}
        isSubmitting={isResolvingAppeal}
        onConfirmResolve={handleConfirmResolveAppeal}
      />
    </div>
  );
}


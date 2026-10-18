import { useState } from 'react';
import { 
  AlertTriangle, FileText, MessageSquare, 
  Search, EyeOff, ArrowLeft, CheckCircle2,
  XCircle, Clock, ShieldAlert, Check, X,
  User, RefreshCw, Eye, Scale, Sparkles,
  FileSpreadsheet, Download
} from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';
import ReportResolutionModal from './ReportResolutionModal';
import { exportOverrideLogsToExcel, exportOverrideLogsToCSV } from '../utils/exportUtils';

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
  const [hiddenContentSubTab, setHiddenContentSubTab] = useState('posts'); // 'posts' | 'comments'
  const [searchQuery, setSearchQuery] = useState('');
  const [resolvingId, setResolvingId] = useState(null);
  const [selectedReportForResolve, setSelectedReportForResolve] = useState(null);
  const [isResolvingReport, setIsResolvingReport] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Lọc danh sách khiếu nại
  const filteredAppeals = appeals.filter(a => {
    if (appealFilter !== 'all' && a.status !== appealFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const userName = (a.user?.name || '').toLowerCase();
      const text = (a.originalText || '').toLowerCase();
      const reason = (a.appealReason || '').toLowerCase();
      return userName.includes(q) || text.includes(q) || reason.includes(q);
    }
    return true;
  });

  const pendingAppealsCount = appeals.filter(a => a.status === 'pending').length;

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

  const handleApproveAppeal = async (appeal) => {
    setResolvingId(appeal.id);
    try {
      if (onResolveAppeal) {
        await onResolveAppeal(
          appeal.id, 
          'approved', 
          'Xác minh thành công: AI nhận diện sai ngữ cảnh (False Positive). Đã khôi phục nội dung và gỡ toàn bộ án phạt tài khoản.'
        );
      }
    } finally {
      setResolvingId(null);
    }
  };

  const handleRejectAppeal = async (appeal) => {
    setResolvingId(appeal.id);
    try {
      if (onResolveAppeal) {
        await onResolveAppeal(
          appeal.id, 
          'rejected', 
          'Bác bỏ khiếu nại: Nội dung vi phạm tiêu chuẩn cộng đồng về ngôn từ thù địch / bạo lực.'
        );
      }
    } finally {
      setResolvingId(null);
    }
  };

  const getLabelBadge = (label) => {
    switch (label) {
      case 'Violence':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Bạo lực (Violence)</span>;
      case 'Hate Speech':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">Thù địch (Hate Speech)</span>;
      case 'Toxic':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Độc hại (Toxic)</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">{label || 'Vi phạm'}</span>;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
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
        
        {/* TAB 1: KHIẾU NẠI (APPEALS) */}
        {activeTab === 'appeals' && (
          <div className="space-y-4">
            {/* Bộ lọc trạng thái khiếu nại */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setAppealFilter('all')}
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
                  onClick={() => setAppealFilter('pending')}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition cursor-pointer ${
                    appealFilter === 'pending'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Chờ duyệt ({pendingAppealsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAppealFilter('approved')}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition cursor-pointer ${
                    appealFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Đã minh oan ({appeals.filter(a => a.status === 'approved').length})
                </button>
                <button
                  type="button"
                  onClick={() => setAppealFilter('rejected')}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition cursor-pointer ${
                    appealFilter === 'rejected'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Đã bác bỏ ({appeals.filter(a => a.status === 'rejected').length})
                </button>
              </div>

              <div className="text-xs text-slate-500">
                Hiển thị <strong>{filteredAppeals.length}</strong> đơn khiếu nại
              </div>
            </div>

            {/* Danh sách thẻ khiếu nại */}
            {filteredAppeals.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Không tìm thấy đơn khiếu nại nào</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {appealFilter === 'pending'
                    ? 'Hiện không có đơn khiếu nại nào đang chờ duyệt.'
                    : 'Không có dữ liệu khiếu nại phù hợp với bộ lọc hiện tại.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAppeals.map(appeal => (
                  <div 
                    key={appeal.id} 
                    className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 hover:border-slate-300 transition"
                  >
                    {/* Hàng 1: Tác giả & Loại nội dung & Trạng thái */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <img 
                          src={appeal.user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'} 
                          alt={appeal.user?.name || 'Tác giả'} 
                          className="w-9 h-9 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-900">{appeal.user?.name || 'Người dùng'}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600">
                              {appeal.contentType === 'comment' ? 'Bình luận' : 'Bài viết'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">{appeal.createdAt || 'Vừa xong'}</span>
                        </div>
                      </div>

                      {/* Trạng thái đơn */}
                      <div>
                        {appeal.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                        {appeal.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Đã minh oan & gỡ phạt</span>
                          </span>
                        )}
                        {appeal.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Đã bác bỏ</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hàng 2: Nội dung bị gắn nhãn & Phán quyết AI */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="font-medium">Nội dung bị xử lý:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Phán quyết AI:</span>
                          {getLabelBadge(appeal.aiPredictedLabel)}
                          <span className="text-[11px] text-slate-400 font-mono">
                            ({Math.round((appeal.aiConfidence || 0.9) * 100)}%)
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-800 italic leading-relaxed">
                        <p>"{appeal.originalText || '[Không có nội dung văn bản]'}"</p>
                        {appeal.imageUrl && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center gap-2 not-italic">
                            <img
                              src={appeal.imageUrl}
                              alt="Hình ảnh đính kèm"
                              className="w-14 h-14 object-cover rounded-lg border border-slate-300 shadow-2xs cursor-pointer hover:opacity-90"
                              onClick={() => window.open(appeal.imageUrl, '_blank')}
                            />
                            <span className="text-[11px] text-slate-500 font-medium">Hình ảnh đính kèm trong khiếu nại (bấm để xem ảnh gốc)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Hàng 3: Lý do người dùng khiếu nại (Minh oan) */}
                    <div className="p-3.5 bg-blue-50/60 rounded-md border border-blue-100 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                        <Scale className="w-3.5 h-3.5 text-blue-600" />
                        <span>Lời giải trình từ tác giả:</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {appeal.appealReason || 'Tác giả yêu cầu xem xét lại phán quyết của AI.'}
                      </p>
                    </div>

                    {/* Hàng 4: Ghi chú của quản trị viên (nếu đã xử lý) */}
                    {appeal.adminNotes && (
                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                        <strong>Ghi chú xử lý:</strong> {appeal.adminNotes}
                      </div>
                    )}

                    {/* Hàng 5: Nút hành động cho Moderator / Admin khi đơn ở trạng thái Chờ duyệt */}
                    {appeal.status === 'pending' && (
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100">
                        <div className="text-[11px] text-slate-500">
                          Minh oan sẽ <strong>bỏ ẩn nội dung</strong> và <strong>gỡ án phạt cấm đăng/cmt (countdown về 0)</strong> ngay lập tức.
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={resolvingId === appeal.id}
                            onClick={() => handleRejectAppeal(appeal)}
                            className="h-8 px-3 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5 text-rose-500" />
                            <span>Bác bỏ</span>
                          </button>
                          <button
                            type="button"
                            disabled={resolvingId === appeal.id}
                            onClick={() => handleApproveAppeal(appeal)}
                            className="h-8 px-3.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-xs font-medium text-white shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Chấp thuận (Minh oan & Gỡ phạt)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
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
    </div>
  );
}


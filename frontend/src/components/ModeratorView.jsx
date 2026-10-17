import { useState } from 'react';
import { 
  AlertTriangle, FileText, MessageSquare, 
  Search, EyeOff, ArrowLeft
} from 'lucide-react';

/**
 * Khu vực Kiểm duyệt nội dung (Moderator View)
 * Bao gồm:
 * 1. Báo cáo (reports) - Khung UI & Empty state
 * 2. Khiếu nại (appeals) - Khung UI & Empty state
 * 3. Nội dung bị ẩn (hidden content): 2 tab "Bài viết" và "Bình luận" - Khung UI & Empty state
 * 
 * Tuân thủ quy chuẩn thiết kế Prompt 2:
 * - Không gradient, không glassmorphism, không card lồng card, không shadow thừa.
 * - Radius: 6px (rounded-md) cho nút/input, 8px (rounded-lg) cho khung chứa.
 * - Spacing thang 4px (p-4, p-6, gap-4).
 * - Empty state trung thực, câu chữ tự nhiên tiếng Việt.
 */
export default function ModeratorView({
  onBackToAdmin,
  isAdmin = false
}) {
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'appeals' | 'hidden-content'
  const [hiddenContentSubTab, setHiddenContentSubTab] = useState('posts'); // 'posts' | 'comments'
  const [searchQuery, setSearchQuery] = useState('');

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
            Xử lý báo cáo vi phạm, giải quyết khiếu nại và giám sát nội dung bị ẩn.
          </p>
        </div>

        {/* Thanh tìm kiếm */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo nội dung, người gửi..."
            className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition"
          />
        </div>
      </div>

      {/* Tabs điều hướng cấp 1 */}
      <div className="flex items-center gap-2 mt-6 border-b border-slate-200 pb-px">
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
        </button>
      </div>

      {/* NỘI DUNG TỪNG PHÂN HỆ */}
      <div className="mt-6">
        {/* TAB 1: BÁO CÁO (REPORTS) */}
        {activeTab === 'reports' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Danh sách báo cáo vi phạm</h2>
                <p className="text-xs text-slate-500 mt-0.5">Các mục do người dùng gắn cờ chờ xử lý.</p>
              </div>
              <span className="text-xs text-slate-500">
                {/* TODO: Gắn API danh sách báo cáo thật khi triển khai logic nghiệp vụ */}
                0 báo cáo mới
              </span>
            </div>

            {/* Bảng khung hoặc Empty State trung thực */}
            <div className="py-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Chưa có báo cáo nào cần xử lý</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Hiện tại không có mục nào đang ở trạng thái chờ duyệt. Các báo cáo mới từ người dùng sẽ xuất hiện tại đây.
              </p>
              <div className="mt-4">
                <span className="inline-block text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                  TODO: Tích hợp API GET /api/reports và luồng xử lý báo cáo
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KHIẾU NẠI (APPEALS) */}
        {activeTab === 'appeals' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Danh sách khiếu nại</h2>
                <p className="text-xs text-slate-500 mt-0.5">Yêu cầu xem xét lại phán quyết kiểm duyệt từ tác giả nội dung.</p>
              </div>
              <span className="text-xs text-slate-500">
                0 đơn chờ duyệt
              </span>
            </div>

            {/* Empty State trung thực */}
            <div className="py-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Chưa có khiếu nại nào cần giải quyết</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Khi tác giả gửi yêu cầu xem xét lại nội dung bị ẩn hoặc xử phạt, đơn khiếu nại sẽ hiển thị tại đây.
              </p>
              <div className="mt-4">
                <span className="inline-block text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                  TODO: Tích hợp API GET /api/appeals và luồng giải quyết khiếu nại
                </span>
              </div>
            </div>
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

              {/* Sub-tabs: Bài viết & Bình luận theo yêu cầu Prompt 1 */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                <button
                  onClick={() => setHiddenContentSubTab('posts')}
                  className={`h-7 px-3 text-xs rounded transition cursor-pointer font-medium ${
                    hiddenContentSubTab === 'posts'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bài viết
                </button>
                <button
                  onClick={() => setHiddenContentSubTab('comments')}
                  className={`h-7 px-3 text-xs rounded transition cursor-pointer font-medium ${
                    hiddenContentSubTab === 'comments'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bình luận
                </button>
              </div>
            </div>

            {/* Nội dung subtab Bài viết */}
            {hiddenContentSubTab === 'posts' && (
              <div className="py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Không có bài viết nào đang bị ẩn</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Tất cả bài viết trên hệ thống hiện đang hiển thị bình thường.
                </p>
                <div className="mt-4">
                  <span className="inline-block text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    TODO: Tích hợp API GET /api/posts/hidden và hành động khôi phục bài viết
                  </span>
                </div>
              </div>
            )}

            {/* Nội dung subtab Bình luận */}
            {hiddenContentSubTab === 'comments' && (
              <div className="py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Không có bình luận nào đang bị ẩn</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Không có bình luận vi phạm nào cần xem xét phục hồi.
                </p>
                <div className="mt-4">
                  <span className="inline-block text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    TODO: Tích hợp API GET /api/comments/hidden và hành động khôi phục bình luận
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

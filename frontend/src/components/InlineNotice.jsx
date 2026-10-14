import { CheckCircle2, Trash2, X } from 'lucide-react';
import { useAutoDismissNotice } from '../utils/noticeTimer';

export default function InlineNotice({ notice, onDismiss, className = '' }) {
  useAutoDismissNotice(Boolean(notice), onDismiss, 3200);
  if (!notice) return null;

  const isDeleteNotice = notice.type === 'delete';

  // Trường hợp thông báo Xóa bài viết thành công: Thiết kế thành Card thông báo cao cấp thay thế bài viết
  if (isDeleteNotice) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs mb-5 overflow-hidden transition-all relative ${className}`}
        style={{ animation: 'fadeInScale 0.22s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Progress bar chạy co dần theo thời gian tự đóng */}
        <div className="h-1 w-full bg-slate-100 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400"
            style={{ animation: 'shrinkProgress 3.2s linear forwards' }}
          />
        </div>

        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/90 flex items-center justify-center shrink-0 shadow-2xs">
              <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                  {notice.message || 'Xóa bài viết thành công'}
                </h4>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  Đã gỡ bỏ
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Bài viết đã được gỡ khỏi bảng tin của bạn và máy chủ.
              </p>
            </div>
          </div>

          {/* Nút đóng nhanh thông báo */}
          <button
            type="button"
            onClick={onDismiss}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
            title="Đóng thông báo"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Trường hợp thông báo Cập nhật (Edit) hoặc thông báo khác
  const isDanger = notice.tone === 'danger';
  const toneBg = isDanger ? 'bg-rose-50/90 border-rose-200 text-rose-800' : 'bg-emerald-50/90 border-emerald-200 text-emerald-800';
  const iconColor = isDanger ? 'text-rose-600' : 'text-emerald-600';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border px-4 py-3 text-xs font-medium transition-all flex items-center justify-between gap-3 shadow-xs ${toneBg} ${className}`}
      style={{ animation: 'fadeInScale 0.2s ease-out' }}
    >
      <div className="flex items-center gap-2.5">
        <CheckCircle2 className={`w-4 h-4 ${iconColor} shrink-0`} />
        <span className="font-semibold">{notice.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition cursor-pointer"
        aria-label="Đóng"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

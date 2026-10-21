import React from 'react';
import { AlertTriangle, Sparkles, Edit3, ArrowRight } from 'lucide-react';

/**
 * Modal "Nhắc nhở nhẹ nhàng" trước khi phạt (Friendly Nudge)
 * 
 * Khi người dùng gõ từ ngữ quá khích và bấm Đăng/Gửi, AI không phạt ngay
 * mà hiện thông báo gợi ý:
 * "Chúng tôi nhận thấy bài viết/bình luận của bạn có thể chứa từ ngữ bạo lực/xúc phạm người khác.
 *  Bạn có muốn xem lại và chỉnh sửa trước khi đăng không?"
 * 
 * [Chỉnh sửa] -> Đóng modal, giữ nguyên nội dung trong ô nhập, không phạt gì cả.
 * [Vẫn tiếp tục đăng] -> Kích hoạt ẩn bài và phạt Cooldown 10 phút.
 */
export default function FriendlyNudgeModal({
  isOpen,
  title = "Nhắc nhở nhẹ nhàng từ AI",
  message = "Chúng tôi nhận thấy bài viết của bạn có thể chứa từ ngữ bạo lực/xúc phạm người khác. Bạn có muốn xem lại và chỉnh sửa trước khi đăng không?",
  targetType = "bài viết", // 'bài viết' | 'bình luận'
  contentSnippet = "",
  onEdit,
  onConfirmForce,
  isSubmitting = false
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-amber-200/80 overflow-hidden transform transition-all scale-100">
        {/* Header với icon cảnh báo màu hổ phách / vàng cam */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent p-5 border-b border-amber-100 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 ring-4 ring-amber-50">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 tracking-wide uppercase">
                Gợi ý thân thiện
              </span>
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Wings AI
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-800 mt-1">{title}</h3>
          </div>
        </div>

        {/* Nội dung câu hỏi và trích đoạn */}
        <div className="p-5 space-y-3.5">
          <p className="text-sm text-slate-700 leading-relaxed font-medium">
            {message}
          </p>

          {contentSnippet && (
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-slate-700 italic border-l-4 border-l-amber-500 max-h-24 overflow-y-auto">
              "{contentSnippet}"
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-600">💡 Quyền lựa chọn của bạn:</p>
            <p>• Bấm <strong className="text-indigo-600">Chỉnh sửa</strong>: Bạn có thể thay đổi từ ngữ cho phù hợp. Tài khoản hoàn toàn <strong>không bị phạt</strong>.</p>
            <p>• Bấm <strong className="text-rose-600">Vẫn tiếp tục đăng</strong>: Nội dung vi phạm sẽ bị ẩn và tài khoản bị tạm khóa 10 phút theo Tiêu chuẩn Cộng đồng.</p>
          </div>
        </div>

        {/* 2 Nút lựa chọn */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onConfirmForce}
            disabled={isSubmitting}
            className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition disabled:opacity-50"
          >
            {isSubmitting ? 'Đang xử lý...' : 'Vẫn tiếp tục đăng'}
          </button>

          <button
            type="button"
            onClick={onEdit}
            autoFocus
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs hover:shadow transition flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Chỉnh sửa lại
          </button>
        </div>
      </div>
    </div>
  );
}

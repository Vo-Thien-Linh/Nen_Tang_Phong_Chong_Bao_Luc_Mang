import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Sparkles, Edit3, ArrowRight } from 'lucide-react';

/**
 * Modal "Nhắc nhở nhẹ nhàng" trước khi phạt (Friendly Nudge)
 * 
 * Sử dụng createPortal để gắn trực tiếp vào document.body,
 * đảm bảo modal luôn nằm chính giữa màn hình (viewport), không bị tràn hay
 * ảnh hưởng bởi scroll / transform của các component cha.
 */
export default function FriendlyNudgeModal({
  isOpen,
  title = "Nhắc nhở nhẹ nhàng từ AI",
  message = "Chúng tôi nhận thấy nội dung của bạn có thể chứa từ ngữ tiêu cực hoặc xúc phạm người khác. Bạn có muốn xem lại và chỉnh sửa trước khi đăng không?",
  targetType = "bài viết", // 'bài viết' | 'bình luận'
  warningType = "toxic",   // 'violence' | 'hate_speech' | 'toxic'
  contentSnippet = "",
  onEdit,
  onConfirmForce,
  isSubmitting = false
}) {
  // Khóa cuộn trang khi modal đang mở
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isViolence = warningType === 'violence';
  const isHateSpeech = warningType === 'hate_speech';
  const isBlacklist = warningType === 'keyword_blacklist';

  const consequenceText = isBlacklist
    ? 'Bình luận chứa từ ngữ trong danh sách cấm của chủ bài viết và sẽ tự động bị ẩn ngay lập tức đối với cộng đồng.'
    : isViolence
    ? 'Nội dung vi phạm sẽ bị ẩn và tài khoản bị tạm khóa 10 phút theo Tiêu chuẩn Cộng đồng.'
    : isHateSpeech
    ? 'Nội dung vi phạm sẽ bị ẩn theo Tiêu chuẩn Cộng đồng.'
    : 'Nội dung sẽ được gắn nhãn cảnh báo Tiêu cực (Toxic) khi hiển thị trên hệ thống.';

  const badgeText = isBlacklist
    ? 'Từ khóa cấm của chủ bài viết'
    : isViolence
    ? 'Cảnh báo Bạo lực'
    : isHateSpeech
    ? 'Cảnh báo Thù ghét'
    : 'Gợi ý thân thiện';

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onEdit?.();
        }
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-amber-200/90 overflow-hidden transform transition-all duration-200 scale-100 my-auto animate-in fade-in zoom-in-95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header với icon cảnh báo màu hổ phách / vàng cam */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent p-5 border-b border-amber-100 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 ring-4 ring-amber-50">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                isViolence 
                  ? 'bg-rose-100 text-rose-800' 
                  : isHateSpeech 
                  ? 'bg-orange-100 text-orange-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {badgeText}
              </span>
              <span className="text-xs text-amber-600 flex items-center gap-1 font-medium">
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
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-slate-700 italic border-l-4 border-l-amber-500 max-h-24 overflow-y-auto break-words">
              "{contentSnippet}"
            </div>
          )}

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1.5 leading-relaxed">
            <p className="font-bold text-slate-700">💡 Quyền lựa chọn của bạn:</p>
            <p>• Bấm <strong className="text-indigo-600 font-semibold">Chỉnh sửa</strong>: Bạn có thể thay đổi từ ngữ cho phù hợp. Tài khoản hoàn toàn <strong>không bị phạt</strong>.</p>
            <p>• Bấm <strong className="text-rose-600 font-semibold">Vẫn tiếp tục đăng</strong>: {consequenceText}</p>
          </div>
        </div>

        {/* 2 Nút lựa chọn */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onConfirmForce}
            disabled={isSubmitting}
            className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Đang xử lý...' : (targetType === 'bình luận' ? 'Vẫn gửi bình luận' : 'Vẫn tiếp tục đăng')}
          </button>

          <button
            type="button"
            onClick={onEdit}
            autoFocus
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs hover:shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Chỉnh sửa lại
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useState, useRef, useEffect } from 'react';
import { X, Share2, Loader2, ImageOff } from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';

/**
 * SharePostModal — Modal chia sẻ bài viết
 * Props:
 *   post         — Bài viết gốc cần chia sẻ
 *   currentUser  — Người dùng đang đăng nhập
 *   onConfirm    — async (content: string) => void  — callback gọi API
 *   onClose      — () => void
 */
export default function SharePostModal({ post, currentUser, onConfirm, onClose }) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  // Focus vào textarea khi modal mở
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Đóng modal khi bấm Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await onConfirm(content.trim());
      onClose();
    } catch (err) {
      setError(err.message || 'Chia sẻ thất bại, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý Ctrl+Enter để submit nhanh
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in"
        style={{ animation: 'fadeInScale 0.18s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Chia sẻ bài viết</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-2 space-y-4">
          {/* Người chia sẻ + Textarea */}
          <div className="flex items-start gap-3">
            <img
              src={currentUser?.avatar || DEFAULT_AVATAR}
              alt={currentUser?.name || 'Bạn'}
              className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800 mb-1">
                {currentUser?.name || 'Bạn'}
              </p>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hãy nói gì đó về bài viết này... (tùy chọn)"
                rows={3}
                maxLength={500}
                className="w-full resize-none border-0 outline-none text-sm text-slate-700 placeholder:text-slate-400 bg-transparent leading-relaxed"
              />
              <p className="text-[11px] text-slate-400 text-right">{content.length}/500</p>
            </div>
          </div>

          {/* Preview bài gốc */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            {/* Header bài gốc */}
            <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
              <img
                src={post?.author?.avatar || DEFAULT_AVATAR}
                alt={post?.author?.name || 'Tác giả'}
                className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
              />
              <div>
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {post?.author?.name || 'Người dùng'}
                </p>
                <p className="text-[11px] text-slate-400">{post?.createdAt || ''}</p>
              </div>
            </div>

            {/* Nội dung bài gốc (tóm tắt) */}
            <div className="px-3.5 pb-3 space-y-2">
              {post?.content && (
                <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">
                  {post.content}
                </p>
              )}
              {post?.image && (
                <div className="rounded-lg overflow-hidden border border-slate-200">
                  <img
                    src={post.image}
                    alt="Ảnh bài viết"
                    className="w-full max-h-36 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              {!post?.content && !post?.image && (
                <div className="flex items-center gap-2 text-slate-400 py-1">
                  <ImageOff className="w-4 h-4" />
                  <span className="text-xs">Không có nội dung</span>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            Nhấn <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500 font-mono text-[10px]">Ctrl+Enter</kbd> để đăng nhanh
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              id="share-post-confirm-btn"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang chia sẻ...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Đăng chia sẻ</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

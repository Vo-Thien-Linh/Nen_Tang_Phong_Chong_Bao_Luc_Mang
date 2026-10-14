import { useEffect } from 'react';
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';

export default function DeletePostModal({ 
  post = null, 
  isOpen, 
  isDeleting, 
  errorMessage, 
  onCancel, 
  onConfirm 
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onMouseDown={onCancel}
    >
      <div 
        onMouseDown={(event) => event.stopPropagation()} 
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 transition-all transform scale-100 overflow-hidden relative"
        style={{ animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Nút đóng nhanh góc trên */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Tiêu đề trung tâm */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100/70 border border-rose-200/80 text-rose-600 flex items-center justify-center mx-auto mb-3.5 shadow-xs">
            <Trash2 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Xác nhận xóa bài viết?</h2>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
            Hành động này <span className="font-semibold text-rose-600">không thể hoàn tác</span>. Toàn bộ nội dung và tương tác của bài viết sẽ bị xóa vĩnh viễn.
          </p>
        </div>

        {/* Preview bài viết ngắn (nếu có thông tin post) */}
        {post && (
          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2 text-left">
            <div className="flex items-center gap-2.5">
              <img
                src={post.author?.avatar || DEFAULT_AVATAR}
                alt={post.author?.name || 'Tác giả'}
                className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {post.author?.name || 'Người dùng'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {post.createdAt || 'Vừa xong'}
                </p>
              </div>
            </div>

            {post.content && (
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed italic">
                "{post.content}"
              </p>
            )}

            {post.imageUrl && (
              <div className="h-16 w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                <img
                  src={post.imageUrl}
                  alt="Thumbnail bài viết"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        )}

        {/* Thông báo lỗi nếu có */}
        {errorMessage && (
          <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Các nút hành động */}
        <div className="mt-5 flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button 
            type="button" 
            onClick={onCancel} 
            disabled={isDeleting}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/20 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận xóa</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

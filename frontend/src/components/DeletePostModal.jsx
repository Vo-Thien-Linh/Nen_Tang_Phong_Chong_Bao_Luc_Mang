import { useEffect } from 'react';

export default function DeletePostModal({ isOpen, isDeleting, errorMessage, onCancel, onConfirm }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-3 py-6" onMouseDown={onCancel}>
      <div onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
        <h2 className="text-base font-bold text-slate-900">Xóa bài viết</h2>
        <p className="mt-2 text-sm text-slate-600">Bài viết sẽ bị xóa khỏi bảng tin và trang cá nhân của bạn.</p>
        {errorMessage && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {errorMessage}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}

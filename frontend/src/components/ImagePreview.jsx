import { X } from 'lucide-react';

export default function ImagePreview({ src, alt = 'Ảnh xem trước', onRemove }) {
  if (!src) return null;

  return (
    <div className="relative mt-2 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <img
        src={src}
        alt={alt}
        className="block h-auto max-h-[60vh] w-full object-contain"
      />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 z-10 rounded-full bg-slate-950/70 p-1.5 text-white shadow-md transition hover:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-300"
          title="Xóa ảnh"
          aria-label="Xóa ảnh"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

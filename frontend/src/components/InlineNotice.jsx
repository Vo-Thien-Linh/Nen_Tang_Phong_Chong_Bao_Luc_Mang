import { useAutoDismissNotice } from '../utils/noticeTimer';

export default function InlineNotice({ notice, onDismiss, className = '' }) {
  useAutoDismissNotice(Boolean(notice), onDismiss);
  if (!notice) return null;

  const toneClass = notice.tone === 'danger'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${toneClass} ${className}`}
    >
      {notice.message}
    </div>
  );
}

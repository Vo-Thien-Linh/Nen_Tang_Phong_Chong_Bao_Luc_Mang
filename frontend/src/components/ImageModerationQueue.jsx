import { formatRelativeTime } from '../utils/timeAgo';
import { areImageReviewActionsDisabled, getPreviousImageDecisionLabel } from '../utils/imageModerationReviewLogic';

export default function ImageModerationQueue({ items, stage, pendingKey, onDecision, emptyText }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">{emptyText}</div> : items.map((item) => {
        const key = `${item.type}-${item.id}`;
        const busy = pendingKey === key;
        const anyPending = areImageReviewActionsDisabled(pendingKey);
        const scores = item.modelScores || {};
        return (
          <article key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {item.imageUrl && <img src={item.imageUrl} alt="Ảnh đang được duyệt" className="h-64 w-full bg-slate-100 object-contain" />}
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{item.type === 'comment' ? 'Bình luận' : 'Bài viết'} · {item.author?.name || 'Người dùng'}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{item.text || '[Không có văn bản]'}</p></div>
                <span className="shrink-0 text-[11px] text-slate-500">{formatRelativeTime(item.createdAt)}</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Điểm mô hình · {item.modelLabel || 'Chưa rõ'}</p>
                <p className="mt-1">Safe {scores.safe ?? '-'} · NSFW {scores.nsfw ?? '-'} · Violence {scores.violence ?? '-'}</p>
              </div>
              {stage === 'final' && item.previousDecision && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Quyết định trước: <strong>{getPreviousImageDecisionLabel(item)}</strong> · {item.previousDecision.reviewerName || 'Tự động'} · {item.previousDecision.reviewedAt ? formatRelativeTime(item.previousDecision.reviewedAt) : 'Không có'}
                  {item.appealedAt && <div className="mt-1">Khiếu nại: {formatRelativeTime(item.appealedAt)}</div>}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['safe', 'An toàn', 'bg-emerald-600 hover:bg-emerald-700'],
                  ['nsfw', 'Nhạy cảm', 'bg-amber-500 hover:bg-amber-600'],
                  ['violence', 'Bạo lực', 'bg-rose-600 hover:bg-rose-700'],
                ].map(([decision, label, color]) => (
                  <button key={decision} type="button" disabled={anyPending} onClick={() => onDecision(item, stage, decision)} className={`rounded-lg px-2 py-2 text-xs font-semibold text-white transition disabled:cursor-wait disabled:opacity-50 ${color}`}>
                    {busy ? 'Đang lưu...' : label}
                  </button>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

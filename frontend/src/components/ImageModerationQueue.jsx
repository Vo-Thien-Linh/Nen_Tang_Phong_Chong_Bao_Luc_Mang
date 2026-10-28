import { formatRelativeTime } from '../utils/timeAgo';
import { areImageReviewActionsDisabled, getPreviousImageDecisionLabel } from '../utils/imageModerationReviewLogic';
import { exportUncertainItemsToExcel, exportUncertainItemsToCSV } from '../utils/exportUtils';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

export default function ImageModerationQueue({ items = [], stage, pendingKey, onDecision, emptyText }) {
  const isFirstReview = stage === 'first';

  return (
    <div className="space-y-4">
      {/* Thanh công cụ trích xuất dữ liệu ảnh phân vân để huấn luyện lại mô hình (Retraining) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">
              {isFirstReview ? 'Hàng đợi duyệt ảnh phân vân (AI chưa chắc chắn)' : 'Hàng đợi duyệt khiếu nại ảnh'}
            </span>
            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">
              {items.length} mục
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isFirstReview
              ? 'Các ảnh này có điểm nhận diện lưng chừng. Bạn có thể trích xuất toàn bộ để gắn nhãn & huấn luyện lại (Retrain) mô hình.'
              : 'Các ảnh bị khiếu nại đang chờ bạn đưa ra quyết định phúc khảo cuối cùng.'}
          </p>
        </div>

        {items.length > 0 && isFirstReview && (
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/api/admin/moderation/export-uncertain-excel"
              target="_blank"
              rel="noreferrer"
              className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Tải tập dữ liệu Excel từ cơ sở dữ liệu máy chủ"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Tải từ CSDL</span>
            </a>
            <button
              type="button"
              onClick={() => exportUncertainItemsToCSV(items)}
              className="h-8 px-2.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              title="Xuất file CSV"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-700" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => exportUncertainItemsToExcel(items)}
              className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Xuất file Excel (.xlsx) các ca phân vân để train AI"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel Train</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">{emptyText}</div>
        ) : (
          items.map((item) => {
            const key = `${item.type}-${item.id}`;
            const busy = pendingKey === key;
            const anyPending = areImageReviewActionsDisabled(pendingKey);
            const scores = item.modelScores || {};
            return (
              <article key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {item.imageUrl && <img src={item.imageUrl} alt="Ảnh đang được duyệt" className="h-64 w-full bg-slate-100 object-contain" />}
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                        {item.type === 'comment' ? 'Bình luận' : 'Bài viết'} · {item.author?.name || 'Người dùng'}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">
                        {item.text || '[Không có văn bản]'}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">{formatRelativeTime(item.createdAt)}</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-700">Điểm mô hình · {item.modelLabel || 'Chưa rõ'}</p>
                    <p className="mt-1">
                      Safe {scores.safe ?? '-'} · NSFW {scores.nsfw ?? '-'} · Violence {scores.violence ?? '-'}
                    </p>
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
                      <button
                        key={decision}
                        type="button"
                        disabled={anyPending}
                        onClick={() => onDecision(item, stage, decision)}
                        className={`rounded-lg px-2 py-2 text-xs font-semibold text-white transition disabled:cursor-wait disabled:opacity-50 ${color}`}
                      >
                        {busy ? 'Đang lưu...' : label}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

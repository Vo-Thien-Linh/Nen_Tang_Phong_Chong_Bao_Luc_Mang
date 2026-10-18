import { useState } from 'react';
import { 
  X, AlertTriangle, CheckCircle, ShieldAlert, 
  HelpCircle, Sparkles, ArrowRight, Image as ImageIcon,
  Check, FileText, Info
} from 'lucide-react';

/**
 * Modal Xử lý Báo cáo vi phạm (Report Resolution Modal)
 * Nghiệp vụ chuẩn hóa:
 * 1. Báo cáo SAI -> Bác bỏ báo cáo (dismissed), GIỮ NGUYÊN nhãn cũ ban đầu.
 * 2. Báo cáo ĐÚNG -> Xác nhận vi phạm (resolved_violation), GÁN LẠI NHÃN (Toxic, Hate Speech, Violence),
 *    tự động ẩn nội dung và ghi vết vào Nhật ký hiệu chỉnh nhãn để xuất file.
 */
export default function ReportResolutionModal({
  isOpen,
  onClose,
  report,
  onConfirmResolve,
  isSubmitting = false
}) {
  if (!isOpen || !report) return null;

  // Lấy nhãn hiện tại của nội dung bị báo cáo
  const currentLabel = report.aiStatus?.label || report.oldLabel || 'Normal';
  
  // Quyết định: 'dismissed' (Báo cáo sai) hoặc 'resolved_violation' (Báo cáo đúng)
  const [decision, setDecision] = useState('dismissed');
  
  // Nhãn mới được gán lại nếu báo cáo đúng
  const [newLabel, setNewLabel] = useState('Toxic');
  
  // Ghi chú / lý do của quản trị viên
  const [adminNotes, setAdminNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onConfirmResolve) {
      onConfirmResolve(report.id, {
        status: decision,
        newLabel: decision === 'resolved_violation' ? newLabel : currentLabel,
        oldLabel: currentLabel,
        adminNotes: adminNotes.trim() || (decision === 'dismissed' 
          ? 'Báo cáo không có căn cứ. Nội dung hợp lệ, giữ nguyên nhãn ban đầu.' 
          : `Xác nhận vi phạm: Gán lại nhãn thành ${newLabel}.`
        )
      });
    }
  };

  const getBadgeStyle = (label) => {
    switch (label) {
      case 'Violence':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Hate Speech':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Toxic':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Normal':
      case 'Safe':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div 
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Xử lý báo cáo vi phạm</h3>
              <p className="text-xs text-slate-500">
                Thẩm định báo cáo từ thành viên và chuẩn hóa gắn nhãn nội dung
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Modal (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          
          {/* Khối 1: Thông tin báo cáo & Nội dung bị gắn cờ */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-900">{report.reporter?.name || 'Người dùng'}</span>
                <span className="text-slate-500">đã báo cáo mục của</span>
                <span className="font-semibold text-slate-900">{report.targetAuthor?.name || 'Thành viên'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                  Lý do: {report.reasonLabel || report.reason || 'Vi phạm tiêu chuẩn'}
                </span>
                <span className="text-[11px] text-slate-400">{report.createdAt || 'Gần đây'}</span>
              </div>
            </div>

            {/* Chi tiết người dùng mô tả */}
            {report.details && (
              <div className="text-slate-600 bg-white p-2.5 rounded border border-slate-100">
                <span className="font-medium text-slate-700">Mô tả từ người báo cáo: </span>
                <span className="italic">"{report.details}"</span>
              </div>
            )}

            {/* Trích đoạn nội dung bị báo cáo */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  Nội dung bị gắn cờ:
                </span>
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-500">Nhãn hiện tại:</span>
                  <span className={`px-2 py-0.5 rounded font-semibold border text-[11px] ${getBadgeStyle(currentLabel)}`}>
                    {currentLabel}
                  </span>
                </div>
              </div>

              {/* Text câu */}
              {(report.contentExcerpt || report.targetExcerpt) && (
                <div className="p-3 bg-white rounded-md border border-slate-200 text-slate-900 font-medium leading-relaxed">
                  "{report.contentExcerpt || report.targetExcerpt}"
                </div>
              )}

              {/* Ảnh đính kèm (nếu có) */}
              {report.imageUrl && (
                <div className="mt-2.5 p-2 bg-white rounded-md border border-slate-200 flex items-center gap-3">
                  <img 
                    src={report.imageUrl} 
                    alt="Ảnh báo cáo" 
                    className="w-16 h-16 object-cover rounded-md border border-slate-200 hover:opacity-90 cursor-pointer"
                    onClick={() => window.open(report.imageUrl, '_blank')}
                  />
                  <div>
                    <p className="font-medium text-slate-800">Hình ảnh kèm bài viết/bình luận</p>
                    <p className="text-[11px] text-slate-500">Bấm vào ảnh để xem chi tiết kích thước gốc</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Khối 2: Lựa chọn phán quyết (Báo cáo sai vs Báo cáo đúng) */}
          <div className="space-y-2.5">
            <label className="font-bold text-slate-900 text-xs block">
              1. Kết luận thẩm định của Kiểm duyệt viên:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Lựa chọn 1: BÁO CÁO SAI */}
              <label 
                className={`relative flex flex-col p-3.5 rounded-lg border-2 cursor-pointer transition ${
                  decision === 'dismissed'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="decision"
                      value="dismissed"
                      checked={decision === 'dismissed'}
                      onChange={() => setDecision('dismissed')}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-slate-900">Báo cáo SAI (Bác bỏ)</span>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 pl-6 leading-relaxed">
                  Báo cáo không đúng sự thật hoặc không vi phạm tiêu chuẩn. 
                  <strong className="text-emerald-800 block mt-0.5">➔ GIỮ NGUYÊN nhãn hiện tại ({currentLabel})</strong>
                </p>
              </label>

              {/* Lựa chọn 2: BÁO CÁO ĐÚNG */}
              <label 
                className={`relative flex flex-col p-3.5 rounded-lg border-2 cursor-pointer transition ${
                  decision === 'resolved_violation'
                    ? 'border-rose-600 bg-rose-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="decision"
                      value="resolved_violation"
                      checked={decision === 'resolved_violation'}
                      onChange={() => setDecision('resolved_violation')}
                      className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-bold text-slate-900">Báo cáo ĐÚNG (Vi phạm)</span>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                    <AlertTriangle className="w-3 h-3" />
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 pl-6 leading-relaxed">
                  Báo cáo mô tả chính xác hành vi vi phạm.
                  <strong className="text-rose-800 block mt-0.5">➔ GÁN LẠI NHÃN & GHI VÀO NHẬT KÝ</strong>
                </p>
              </label>
            </div>
          </div>

          {/* Khối 3: Gắn nhãn mới khi báo cáo ĐÚNG */}
          {decision === 'resolved_violation' && (
            <div className="p-4 rounded-lg bg-rose-50/60 border border-rose-200 space-y-3 animate-fade-in">
              <label className="font-bold text-rose-950 text-xs block">
                2. Chọn nhãn mới gán lại cho câu văn / hình ảnh (theo nghiệp vụ từng nhãn):
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {/* Nhãn 1: Normal (Minh oan / Trạng thái bình thường) */}
                <button
                  type="button"
                  onClick={() => setNewLabel('Normal')}
                  className={`p-2.5 rounded-md border text-left transition cursor-pointer flex flex-col ${
                    newLabel === 'Normal'
                      ? 'bg-white border-emerald-500 text-emerald-900 ring-2 ring-emerald-400 font-bold shadow-xs'
                      : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Normal (Bình thường)</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium mt-1">Gỡ án phạt & phục hồi</span>
                </button>

                {/* Nhãn 2: Toxic */}
                <button
                  type="button"
                  onClick={() => setNewLabel('Toxic')}
                  className={`p-2.5 rounded-md border text-left transition cursor-pointer flex flex-col ${
                    newLabel === 'Toxic'
                      ? 'bg-white border-amber-500 text-amber-900 ring-2 ring-amber-400 font-bold shadow-xs'
                      : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Toxic (Độc hại)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal mt-1">Lăng mạ, xúc phạm thô tục</span>
                </button>

                {/* Nhãn 3: Hate Speech */}
                <button
                  type="button"
                  onClick={() => setNewLabel('Hate Speech')}
                  className={`p-2.5 rounded-md border text-left transition cursor-pointer flex flex-col ${
                    newLabel === 'Hate Speech'
                      ? 'bg-white border-orange-500 text-orange-900 ring-2 ring-orange-400 font-bold shadow-xs'
                      : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <span>Hate Speech</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal mt-1">Ẩn cứng bài viết thù ghét</span>
                </button>

                {/* Nhãn 4: Violence */}
                <button
                  type="button"
                  onClick={() => setNewLabel('Violence')}
                  className={`p-2.5 rounded-md border text-left transition cursor-pointer flex flex-col ${
                    newLabel === 'Violence'
                      ? 'bg-white border-rose-500 text-rose-900 ring-2 ring-rose-400 font-bold shadow-xs'
                      : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>Violence (Bạo lực)</span>
                  </span>
                  <span className="text-[10px] text-rose-700 font-medium mt-1">Ẩn & phạt Cooldown 10 phút</span>
                </button>
              </div>

              {/* Tóm tắt thay đổi nhãn và nghiệp vụ xử lý */}
              <div className="p-2.5 bg-white rounded border border-rose-200/80 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Quy trình chuyển đổi nhãn:</span>
                  <div className="flex items-center gap-2 font-semibold">
                    <span className={`px-2 py-0.5 rounded border ${getBadgeStyle(currentLabel)}`}>
                      {currentLabel}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className={`px-2 py-0.5 rounded border ${getBadgeStyle(newLabel)}`}>
                      {newLabel}
                    </span>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-100 flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Tác động nghiệp vụ:</span>
                  {newLabel === 'Normal' && (
                    <span className="text-emerald-700 font-medium">Khôi phục hiển thị công khai & gỡ bỏ toàn bộ án phạt (cooldown/hạn chế) cho tác giả</span>
                  )}
                  {newLabel === 'Violence' && (
                    <span className="text-rose-700 font-medium">Ẩn nội dung & áp dụng án phạt Cooldown 10 phút cho tài khoản tác giả</span>
                  )}
                  {newLabel === 'Hate Speech' && (
                    <span className="text-orange-700 font-medium">Ẩn nội dung vi phạm tiêu chuẩn nghiêm trọng về ngôn từ thù địch</span>
                  )}
                  {newLabel === 'Toxic' && (
                    <span className="text-amber-700 font-medium">Ẩn nội dung độc hại xúc phạm</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Khối 4: Ghi chú xử lý */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 text-xs block">
              3. Ghi chú của Quản trị viên / Lý do xử lý:
            </label>
            <textarea
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder={decision === 'dismissed' 
                ? 'Nhập lý do bác bỏ (ví dụ: Ngữ cảnh bình thường, từ ngữ đùa vui giữa bạn bè...)' 
                : 'Nhập ghi chú vi phạm (ví dụ: Sử dụng từ ngữ kích động bạo lực, vi phạm điều 4...)'
              }
              className="w-full p-2.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 text-xs text-slate-800"
            />
          </div>

          {/* Footer nút hành động */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`h-9 px-5 rounded-md text-xs font-semibold text-white shadow-xs transition cursor-pointer flex items-center gap-1.5 ${
                decision === 'dismissed'
                  ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-400'
                  : 'bg-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-400'
              } disabled:opacity-50`}
            >
              {isSubmitting ? 'Đang lưu...' : (decision === 'dismissed' ? 'Xác nhận Báo Cáo Sai (Giữ nhãn)' : 'Xác nhận Báo Cáo Đúng (Đổi nhãn)')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

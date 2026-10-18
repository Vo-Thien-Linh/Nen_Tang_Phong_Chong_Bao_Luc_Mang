import { useState } from 'react';
import { 
  X, CheckCircle, AlertTriangle, FileText, 
  ArrowRight, Check, Scale, ShieldAlert, AlertCircle 
} from 'lucide-react';

/**
 * Modal Xử lý Khiếu nại vi phạm (Appeal Resolution Modal)
 * Nghiệp vụ chuẩn hóa:
 * 1. Từ chối khiếu nại (rejected) -> Giữ nguyên nhãn và hình phạt, không ghi bản ghi đổi nhãn.
 * 2. Chấp nhận khiếu nại (approved) -> Đổi nhãn (mặc định Normal, hoặc Toxic, Hate Speech, Violence),
 *    gỡ phạt theo nghiệp vụ nhãn và ghi vết vào Nhật ký hiệu chỉnh nhãn để xuất file.
 */
export default function AppealResolutionModal({
  isOpen,
  onClose,
  appeal,
  onConfirmResolve,
  isSubmitting = false
}) {
  if (!isOpen || !appeal) return null;

  const currentLabel = appeal.aiPredictedLabel || 'Toxic';
  
  // Quyết định: 'approved' (Chấp nhận khiếu nại) hoặc 'rejected' (Từ chối khiếu nại)
  const [decision, setDecision] = useState('approved');
  
  // Nhãn mới được gán lại nếu chấp nhận khiếu nại (mặc định là Normal)
  const [newLabel, setNewLabel] = useState('Normal');
  
  // Ghi chú / lý do của quản trị viên
  const [adminNotes, setAdminNotes] = useState('');

  // Bước xác nhận (Confirmation step)
  const [showConfirmStep, setShowConfirmStep] = useState(false);

  const getBadgeStyle = (label) => {
    switch (label) {
      case 'Violence':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Hate Speech':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Toxic':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Normal':
      case 'Safe':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getConsequenceText = (targetLabel) => {
    switch (targetLabel) {
      case 'Normal':
        return 'Khôi phục hiển thị công khai nội dung và gỡ bỏ toàn bộ án phạt (cooldown/hạn chế) cho tác giả.';
      case 'Violence':
        return 'Tiếp tục ẩn nội dung và áp dụng án phạt Cooldown 10 phút cấm đăng bài & bình luận cho tác giả.';
      case 'Hate Speech':
        return 'Tiếp tục ẩn nội dung vi phạm ngôn từ thù ghét; gỡ bỏ án phạt Cooldown nếu trước đó bị phạt do Violence.';
      case 'Toxic':
        return 'Tiếp tục ẩn nội dung độc hại; gỡ bỏ án phạt Cooldown nếu trước đó bị phạt do Violence.';
      default:
        return '';
    }
  };

  const handleInitialSubmit = (e) => {
    e.preventDefault();
    setShowConfirmStep(true);
  };

  const handleFinalConfirm = () => {
    if (onConfirmResolve) {
      onConfirmResolve(appeal.id, {
        status: decision,
        newLabel: decision === 'approved' ? newLabel : currentLabel,
        oldLabel: currentLabel,
        adminNotes: adminNotes.trim() || (decision === 'approved'
          ? (newLabel === 'Normal' 
              ? 'Chấp thuận khiếu nại: Minh oan và khôi phục nội dung an toàn.' 
              : `Chấp thuận khiếu nại: Hiệu chỉnh nhãn sang ${newLabel}.`)
          : 'Từ chối khiếu nại: Nội dung vi phạm tiêu chuẩn cộng đồng, giữ nguyên nhãn ban đầu.'
        )
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div 
        className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {showConfirmStep ? 'Xác nhận xử lý khiếu nại' : 'Xem chi tiết & xử lý khiếu nại'}
              </h3>
              <p className="text-xs text-slate-500">
                Đơn khiếu nại từ thành viên về phán quyết nhãn AI
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Modal */}
        {!showConfirmStep ? (
          <form onSubmit={handleInitialSubmit} className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
            {/* Khối 1: Thông tin người khiếu nại & nội dung */}
            <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <img 
                    src={appeal.user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'} 
                    alt={appeal.user?.name || 'Người khiếu nại'} 
                    className="w-7 h-7 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">{appeal.user?.name || 'Người dùng'}</span>
                    <span className="text-slate-400 ml-1.5 font-normal">({appeal.user?.username || 'user'})</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {appeal.contentType === 'comment' ? 'Bình luận' : 'Bài viết'}
                  </span>
                  <span className="text-[11px] text-slate-400">{appeal.createdAt || 'Gần đây'}</span>
                </div>
              </div>

              {/* Lời giải trình của người khiếu nại */}
              <div className="p-3 bg-blue-50/70 rounded border border-blue-200/80 text-blue-950">
                <div className="font-semibold text-blue-900 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Lời giải trình khiếu nại:</span>
                </div>
                <p className="leading-relaxed italic">
                  "{appeal.appealReason || 'Tác giả yêu cầu xem xét lại phán quyết của AI.'}"
                </p>
              </div>

              {/* Nội dung bị gắn nhãn */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-800">Nội dung nguyên văn:</span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500">Nhãn AI hiện tại:</span>
                    <span className={`px-2 py-0.5 rounded font-semibold border ${getBadgeStyle(currentLabel)}`}>
                      {currentLabel}
                    </span>
                    <span className="text-slate-400 font-mono">
                      ({Math.round((appeal.aiConfidence || 0.9) * 100)}%)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-slate-200 text-slate-900 leading-relaxed">
                  "{appeal.originalText || '[Không có nội dung văn bản]'}"
                </div>

                {/* Ảnh đính kèm (nếu có) */}
                {appeal.imageUrl && (
                  <div className="mt-2.5 p-2 bg-white rounded border border-slate-200 flex items-center gap-3">
                    <img 
                      src={appeal.imageUrl} 
                      alt="Hình ảnh đính kèm" 
                      className="w-16 h-16 object-cover rounded border border-slate-200 hover:opacity-90 cursor-pointer"
                      onClick={() => window.open(appeal.imageUrl, '_blank')}
                    />
                    <div>
                      <p className="font-medium text-slate-800">Hình ảnh đính kèm nội dung</p>
                      <p className="text-[11px] text-slate-500">Bấm vào ảnh để xem ảnh kích thước gốc</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Khối 2: Lựa chọn phán quyết */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-900 text-xs block">
                1. Quyết định của Điều hành viên / Quản trị viên:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Lựa chọn 1: CHẤP NHẬN KHIẾU NẠI */}
                <label 
                  className={`flex flex-col p-3 rounded-md border-2 cursor-pointer transition ${
                    decision === 'approved'
                      ? 'border-emerald-600 bg-emerald-50/30'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="appeal_decision"
                        value="approved"
                        checked={decision === 'approved'}
                        onChange={() => setDecision('approved')}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-bold text-slate-900">Chấp nhận khiếu nại (Nhãn sai)</span>
                    </div>
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 pl-6 leading-relaxed">
                    AI nhận diện nhầm ngữ cảnh. Đổi sang nhãn phù hợp, gỡ hình phạt và ghi lịch sử để xuất file.
                  </p>
                </label>

                {/* Lựa chọn 2: TỪ CHỐI KHIẾU NẠI */}
                <label 
                  className={`flex flex-col p-3 rounded-md border-2 cursor-pointer transition ${
                    decision === 'rejected'
                      ? 'border-slate-700 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="appeal_decision"
                        value="rejected"
                        checked={decision === 'rejected'}
                        onChange={() => setDecision('rejected')}
                        className="w-4 h-4 text-slate-700 focus:ring-slate-500"
                      />
                      <span className="font-bold text-slate-900">Từ chối khiếu nại (Bác bỏ)</span>
                    </div>
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 pl-6 leading-relaxed">
                    Khiếu nại không có cơ sở. Giữ nguyên nhãn vi phạm ({currentLabel}) và các hình phạt đang áp dụng.
                  </p>
                </label>
              </div>
            </div>

            {/* Khối 3: Chọn nhãn mới khi chấp nhận khiếu nại */}
            {decision === 'approved' && (
              <div className="p-3.5 rounded-md bg-emerald-50/50 border border-emerald-200 space-y-3">
                <label className="font-semibold text-emerald-950 text-xs block">
                  2. Chọn nhãn mới gán lại cho nội dung:
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewLabel('Normal')}
                    className={`p-2.5 rounded-md border text-left transition cursor-pointer flex flex-col ${
                      newLabel === 'Normal'
                        ? 'bg-white border-emerald-500 text-emerald-900 ring-2 ring-emerald-400 font-bold'
                        : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Bình thường (Normal)</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-medium mt-1">Khôi phục hiển thị & gỡ phạt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewLabel('Toxic')}
                    className={`p-2.5 rounded-md border text-left transition cursor-pointer flex flex-col ${
                      newLabel === 'Toxic'
                        ? 'bg-white border-amber-500 text-amber-900 ring-2 ring-amber-400 font-bold'
                        : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>Độc hại (Toxic)</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal mt-1">Ẩn nội dung xúc phạm</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewLabel('Hate Speech')}
                    className={`p-2.5 rounded-md border text-left transition cursor-pointer flex flex-col ${
                      newLabel === 'Hate Speech'
                        ? 'bg-white border-orange-500 text-orange-900 ring-2 ring-orange-400 font-bold'
                        : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      <span>Thù địch (Hate Speech)</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal mt-1">Ẩn nội dung thù ghét</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewLabel('Violence')}
                    className={`p-2.5 rounded-md border text-left transition cursor-pointer flex flex-col ${
                      newLabel === 'Violence'
                        ? 'bg-white border-rose-500 text-rose-900 ring-2 ring-rose-400 font-bold'
                        : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>Bạo lực (Violence)</span>
                    </span>
                    <span className="text-[10px] text-rose-700 font-medium mt-1">Ẩn & phạt Cooldown 10p</span>
                  </button>
                </div>

                {/* Tóm tắt chuyển đổi nhãn */}
                <div className="p-2.5 bg-white rounded border border-emerald-200 text-[11px] space-y-1.5">
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
                  <div className="pt-1 border-t border-slate-100 flex items-start gap-1.5">
                    <span className="font-semibold text-slate-700 shrink-0">Tác động:</span>
                    <span className="text-slate-600">{getConsequenceText(newLabel)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Khối 4: Ghi chú xử lý */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-900 text-xs block">
                {decision === 'approved' ? '3. Ghi chú xử lý / Lý do chấp thuận:' : '2. Ghi chú lý do từ chối khiếu nại:'}
              </label>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={decision === 'approved' 
                  ? 'Ví dụ: Từ ngữ thân mật giữa bạn bè, không vi phạm tiêu chuẩn...'
                  : 'Ví dụ: Nội dung chứa từ ngữ thô tục nhắm vào cá nhân, không đủ điều kiện gỡ phạt...'
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
                className={`h-9 px-5 rounded-md text-xs font-semibold text-white transition cursor-pointer flex items-center gap-1.5 ${
                  decision === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-800 hover:bg-slate-900'
                } disabled:opacity-50`}
              >
                {decision === 'approved' ? 'Tiếp tục chấp thuận khiếu nại' : 'Tiếp tục từ chối khiếu nại'}
              </button>
            </div>
          </form>
        ) : (
          /* Khối bước xác nhận hệ quả rõ ràng trước khi ghi vào CSDL */
          <div className="p-6 space-y-4 text-xs text-slate-700 animate-fade-in">
            <div className="p-4 rounded-md bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-amber-900 text-sm">
                  {decision === 'approved' 
                    ? `Xác nhận đổi nhãn từ ${currentLabel} sang ${newLabel}?`
                    : `Xác nhận từ chối khiếu nại của ${appeal.user?.name || 'người dùng'}?`
                  }
                </h4>
                <p className="text-amber-800 leading-relaxed">
                  {decision === 'approved'
                    ? (newLabel === 'Normal' 
                        ? `Nội dung sẽ được khôi phục hiển thị công khai. Toàn bộ hình phạt do nhãn ${currentLabel} gây ra (bao gồm cooldown) sẽ được gỡ bỏ ngay lập tức. Hệ thống sẽ ghi một bản ghi vào nhật ký hiệu chỉnh nhãn để xuất file.`
                        : `Nội dung sẽ được gán lại nhãn ${newLabel}. Hình phạt cũ của nhãn ${currentLabel} sẽ được gỡ và áp dụng hình phạt theo nghiệp vụ của nhãn ${newLabel}. Hệ thống sẽ ghi một bản ghi vào nhật ký hiệu chỉnh nhãn để xuất file.`)
                    : `Nhãn vi phạm (${currentLabel}) và toàn bộ hình phạt đang áp dụng sẽ được giữ nguyên. Hệ thống KHÔNG ghi bản ghi đổi nhãn.`
                  }
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between pb-1.5 border-b border-slate-200">
                <span className="text-slate-500">Đối tượng:</span>
                <span className="font-semibold text-slate-900">
                  {appeal.contentType === 'comment' ? 'Bình luận' : 'Bài viết'} #{appeal.contentId} của {appeal.user?.name}
                </span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-slate-200">
                <span className="text-slate-500">Quyết định:</span>
                <span className="font-bold text-slate-900">
                  {decision === 'approved' ? `Chấp thuận (Đổi sang ${newLabel})` : 'Từ chối (Giữ nguyên)'}
                </span>
              </div>
              {adminNotes && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Ghi chú:</span>
                  <span className="text-slate-800 italic max-w-sm text-right">{adminNotes}</span>
                </div>
              )}
            </div>

            {/* Footer nút xác nhận */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmStep(false)}
                disabled={isSubmitting}
                className="h-9 px-4 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleFinalConfirm}
                disabled={isSubmitting}
                className={`h-9 px-5 rounded-md text-xs font-semibold text-white transition cursor-pointer flex items-center gap-1.5 ${
                  decision === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-800 hover:bg-slate-900'
                } disabled:opacity-50`}
              >
                {isSubmitting ? 'Đang lưu...' : (decision === 'approved' ? 'Xác nhận chấp nhận khiếu nại' : 'Xác nhận từ chối khiếu nại')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

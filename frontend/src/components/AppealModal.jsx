import { useState } from 'react';
import { X, ShieldQuestion, Send, CheckCircle2, AlertOctagon, HelpCircle, Sparkles } from 'lucide-react';

export default function AppealModal({ isOpen, onClose, contentItem, currentUser, onSubmitAppeal }) {
  const [appealReason, setAppealReason] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen || !contentItem) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!appealReason.trim()) return;

    const appealData = {
      id: `app-${Date.now()}`,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar
      },
      contentType: contentItem.contentType || contentItem.targetType || 'post',
      contentId: contentItem.id || contentItem.targetId,
      originalText: contentItem.content || contentItem.originalText || contentItem.contentExcerpt || '',
      aiPredictedLabel: contentItem.aiStatus?.label || contentItem.ai_label || contentItem.aiLabel || 'Hate Speech',
      aiConfidence: contentItem.aiStatus?.confidence || contentItem.ai_confidence || 0.90,
      aiActionTaken: contentItem.aiStatus?.action || 'hide',
      appealReason: appealReason.trim(),
      status: 'pending',
      adminNotes: '',
      createdAt: 'Vừa xong'
    };

    onSubmitAppeal(appealData);
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setAppealReason('');
      onClose();
    }, 1500);
  };

  const getBadgeColor = (label) => {
    switch (label) {
      case 'Toxic': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Hate Speech': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Violence': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300 border border-amber-500/30">
              <ShieldQuestion className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Khiếu nại phán quyết AI
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/40 font-semibold">
                  Kháng nghị False Positive
                </span>
              </h2>
              <p className="text-xs text-slate-300">Yêu cầu Quản trị viên xem xét lại nội dung bị AI gắn nhãn sai</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-800">
          
          {isSubmitted ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Đơn khiếu nại đã được gửi!</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Admin sẽ kiểm tra ngữ cảnh thủ công. Nếu AI gắn nhãn sai, nội dung sẽ được phục hồi và tài khoản của bạn sẽ được minh oan ngay lập tức.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Thông tin phán quyết hiện tại của AI */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-amber-600" />
                    Phán quyết từ mô hình AI:
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-md font-bold border ${getBadgeColor(contentItem.aiStatus?.label || contentItem.ai_label || contentItem.aiLabel || 'Hate Speech')}`}>
                    {contentItem.aiStatus?.label || contentItem.ai_label || contentItem.aiLabel || 'Cảnh báo'} ({(((contentItem.aiStatus?.confidence || contentItem.ai_confidence || 0.9)) * 100).toFixed(0)}%)
                  </span>
                </div>
                {contentItem.aiStatus?.reason && (
                  <p className="text-[11px] text-amber-800">
                    Lý do hệ thống cảnh báo: {contentItem.aiStatus.reason}
                  </p>
                )}
              </div>

              {/* Trích dẫn nội dung bị phạt */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Nội dung bị ảnh hưởng:
                </label>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 italic">
                  "{contentItem.content || contentItem.originalText || contentItem.contentExcerpt || '[Nội dung tệp đính kèm]'}"
                </div>
              </div>

              {/* Gợi ý lý do khiếu nại thường gặp */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1 text-indigo-800">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Gợi ý giải trình lý do:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "AI hiểu sai nghĩa bóng / từ ngữ ví von",
                    "Đùa giỡn vô hại giữa bạn thân",
                    "Thuật ngữ công nghệ / trích dẫn",
                    "Từ ngữ địa phương thông dụng"
                  ].map((tip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAppealReason(tip + ": ")}
                      className="text-[11px] bg-white hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 transition cursor-pointer"
                    >
                      + {tip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ô nhập lời giải thích */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Lời giải trình của bạn cho Quản trị viên: <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  rows={3}
                  required
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="Hãy giải thích rõ ngữ cảnh vì sao câu nói này không vi phạm tiêu chuẩn cộng đồng..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none text-slate-800"
                />
              </div>

              {/* Nút hành động */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!appealReason.trim()}
                  className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi Đơn Khiếu Nại</span>
                </button>
              </div>

            </form>
          )}

        </div>

      </div>
    </div>
  );
}

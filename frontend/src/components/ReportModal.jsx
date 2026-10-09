import { useState } from 'react';
import { X, ShieldAlert, AlertTriangle, Send, CheckCircle2, MessageSquare, FileText } from 'lucide-react';
import { REPORT_REASONS } from '../data/mockData';

export default function ReportModal({ isOpen, onClose, target, currentUser, onSubmitReport }) {
  const [selectedReason, setSelectedReason] = useState('toxic');
  const [details, setDetails] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen || !target) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const reasonObj = REPORT_REASONS.find(r => r.id === selectedReason) || REPORT_REASONS[0];

    const reportData = {
      id: `rep-${Date.now()}`,
      reporter: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar
      },
      targetType: target.targetType, // 'post' | 'comment' | 'message'
      targetId: target.targetId,
      targetAuthor: target.targetAuthor || { name: 'Người dùng', username: 'user' },
      contentExcerpt: target.contentExcerpt || '',
      reason: selectedReason,
      reasonLabel: reasonObj.label,
      details: details.trim(),
      status: 'pending',
      adminNotes: '',
      createdAt: 'Vừa xong',
      aiStatus: target.aiStatus || { label: 'Pending Review', confidence: 0.90 }
    };

    onSubmitReport(reportData);
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setDetails('');
      setSelectedReason('toxic');
      onClose();
    }, 1500);
  };

  const getTargetTypeBadge = (type) => {
    switch (type) {
      case 'post':
        return { label: 'Bài viết', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'comment':
        return { label: 'Bình luận', color: 'bg-purple-100 text-purple-700 border-purple-200' };
      case 'message':
        return { label: 'Tin nhắn', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      default:
        return { label: 'Nội dung', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const badge = getTargetTypeBadge(target.targetType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-rose-900 via-rose-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-300 border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Báo cáo vi phạm tiêu chuẩn</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badge.color}`}>
                  {badge.label}
                </span>
              </h2>
              <p className="text-xs text-rose-200/80">Hệ thống gửi trực tiếp tới Ban Quản Trị để xử lý</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung Form */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-800">
          
          {isSubmitted ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Báo cáo đã được tiếp nhận!</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Cảm ơn bạn đã chung tay bảo vệ môi trường văn minh trên NexusSocial. Đội ngũ kiểm duyệt sẽ xử lý trong thời gian sớm nhất.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Preview nội dung bị báo cáo */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    {target.targetType === 'message' ? <MessageSquare className="w-3.5 h-3.5 text-blue-500" /> : <FileText className="w-3.5 h-3.5 text-blue-500" />}
                    Tác giả: {target.targetAuthor?.name || 'Ẩn danh'}
                  </span>
                  <span className="text-[11px] text-slate-400">@{target.targetAuthor?.username || 'user'}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-200 line-clamp-3">
                  "{target.contentExcerpt}"
                </p>
              </div>

              {/* Lựa chọn lý do */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Chọn lý do vi phạm:
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {REPORT_REASONS.map((reason) => (
                    <label 
                      key={reason.id}
                      className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition text-xs ${
                        selectedReason === reason.id 
                          ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-200' 
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="reportReason" 
                        value={reason.id}
                        checked={selectedReason === reason.id}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="mt-0.5 text-rose-600 focus:ring-rose-500 accent-rose-600 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-800">{reason.label}</div>
                        <div className="text-[11px] text-slate-500">{reason.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Chi tiết bổ sung */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Mô tả thêm bằng chứng hoặc ngữ cảnh (không bắt buộc):
                </label>
                <textarea 
                  rows={2}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Ví dụ: Người này liên tục gửi tin nhắn gây phiền toái, xúc phạm cá nhân..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 resize-none"
                />
              </div>

              {/* Footer hành động */}
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
                  className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi Báo Cáo</span>
                </button>
              </div>

            </form>
          )}

        </div>

      </div>
    </div>
  );
}

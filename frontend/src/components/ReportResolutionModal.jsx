import { useState, useEffect } from 'react';
import { 
  X, AlertTriangle, CheckCircle, ShieldAlert, 
  HelpCircle, Sparkles, ArrowRight, Image as ImageIcon,
  Check, FileText, Info, ShieldCheck
} from 'lucide-react';

/**
 * Modal Xử lý Báo cáo vi phạm (Report Resolution Modal)
 * Nghiệp vụ thẩm định đa phương thức (Multimodal Moderation):
 * 1. Khối Văn bản (Text): Normal / Toxic / Hate Speech / Violence (mặc định nhãn text hiện tại của AI)
 * 2. Khối Hình ảnh (Image): Clean / NSFW / Violence (mặc định nhãn ảnh hiện tại của AI, nếu bài viết có ảnh)
 * 3. Hai quy tắc kiểm tra:
 *    - Quy tắc 1: Nếu chọn "Báo cáo ĐÚNG" mà không đổi nhãn nào thì chặn lại (disable submit & cảnh báo).
 *    - Quy tắc 2: Chỉ ghi nhật ký ai_override_logs cho phần nào có nhãn thay đổi.
 * 4. Quy trình chuyển đổi nhãn: Hiện 2 dòng Văn bản & Hình ảnh, kèm điểm bị trừ và kiểu ẩn áp dụng.
 */

const normalizeTextLabel = (lbl) => {
  if (!lbl) return 'Normal';
  const s = String(lbl).trim();
  if (/hate/i.test(s)) return 'Hate Speech';
  if (/violen/i.test(s) || /bạo lực/i.test(s)) return 'Violence';
  if (/toxic/i.test(s) || /độc hại/i.test(s)) return 'Toxic';
  return 'Normal';
};

const normalizeImageLabel = (lbl) => {
  if (!lbl) return 'Clean';
  const s = String(lbl).trim();
  if (/violen/i.test(s) || /bạo lực/i.test(s) || /rejected/i.test(s)) return 'Violence';
  if (/nsfw/i.test(s) || /sensitive/i.test(s) || /nhạy cảm/i.test(s)) return 'NSFW';
  return 'Clean';
};

export default function ReportResolutionModal({
  isOpen,
  onClose,
  report,
  onConfirmResolve,
  isSubmitting = false
}) {
  if (!isOpen || !report) return null;

  const hasImage = Boolean(report.imageUrl || report.image);

  // Nhãn ban đầu của nội dung
  const initialTextLabel = normalizeTextLabel(
    report.textLabel || report.aiStatus?.textLabel || report.aiStatus?.label || report.oldLabel
  );
  const initialImageLabel = normalizeImageLabel(
    report.imageLabel || report.aiStatus?.imageLabel
  );

  // Quyết định: 'dismissed' (Báo cáo sai) hoặc 'resolved_violation' (Báo cáo đúng)
  const [decision, setDecision] = useState('dismissed');

  // Nhãn được chọn cho từng modality
  const [selectedTextLabel, setSelectedTextLabel] = useState(initialTextLabel);
  const [selectedImageLabel, setSelectedImageLabel] = useState(initialImageLabel);

  // Ghi chú / lý do của quản trị viên
  const [adminNotes, setAdminNotes] = useState('');

  const suggestViolationLabels = () => {
    const rReason = (report?.reason || '').toLowerCase();
    if (rReason.includes('nsfw') || rReason.includes('nhạy cảm')) {
      if (hasImage) setSelectedImageLabel('NSFW');
      setSelectedTextLabel(initialTextLabel);
    } else if (rReason.includes('violen') || rReason.includes('bạo lực')) {
      setSelectedTextLabel('Violence');
      if (hasImage) setSelectedImageLabel('Violence');
    } else if (rReason.includes('hate') || rReason.includes('thù ghét')) {
      setSelectedTextLabel('Hate Speech');
      if (hasImage) setSelectedImageLabel(initialImageLabel);
    } else {
      setSelectedTextLabel('Toxic');
      if (hasImage) setSelectedImageLabel(initialImageLabel);
    }
  };

  const handleDecisionChange = (newDecision) => {
    setDecision(newDecision);
    if (newDecision === 'resolved_violation') {
      suggestViolationLabels();
    } else {
      setSelectedTextLabel(initialTextLabel);
      setSelectedImageLabel(initialImageLabel);
    }
  };

  // Tự động đồng bộ khi mở modal hoặc thay đổi report
  useEffect(() => {
    if (report && isOpen) {
      const curText = normalizeTextLabel(
        report.textLabel || report.aiStatus?.textLabel || report.aiStatus?.label || report.oldLabel
      );
      const curImage = normalizeImageLabel(
        report.imageLabel || report.aiStatus?.imageLabel
      );

      if (report.status === 'dismissed') {
        setDecision('resolved_violation');
        suggestViolationLabels();
        setAdminNotes(report.adminNotes || '');
      } else if (report.status === 'resolved_violation') {
        setDecision('resolved_violation');
        setSelectedTextLabel(report.newLabel ? normalizeTextLabel(report.newLabel) : curText);
        setSelectedImageLabel(report.newImageLabel ? normalizeImageLabel(report.newImageLabel) : curImage);
        setAdminNotes(report.adminNotes || '');
      } else {
        // Pending
        setDecision('dismissed');
        setSelectedTextLabel(curText);
        setSelectedImageLabel(curImage);
        setAdminNotes('');
      }
    }
  }, [report, isOpen]);

  // Kiểm tra xem có khối nào thực sự thay đổi nhãn hay không
  const isTextChanged = selectedTextLabel !== initialTextLabel;
  const isImageChanged = hasImage ? (selectedImageLabel !== initialImageLabel) : false;
  const isAnyChanged = isTextChanged || isImageChanged;

  // QUY TẮC 1: Nếu chọn "Báo cáo ĐÚNG" mà không đổi nhãn nào thì chặn lại để tránh thao tác sai sót
  const isSubmitBlocked = decision === 'resolved_violation' && !isAnyChanged;

  // Tính toán điểm trừ và kiểu ẩn dự kiến theo nghiệp vụ Multimodal
  const textPenaltyMap = { 'Normal': 0, 'Toxic': 5, 'Hate Speech': 20, 'Violence': 35 };
  const imagePenaltyMap = { 'Clean': 0, 'NSFW': 10, 'Violence': 35 };
  const tPenalty = textPenaltyMap[selectedTextLabel] || 0;
  const iPenalty = hasImage ? (imagePenaltyMap[selectedImageLabel] || 0) : 0;
  
  let previewDeduction = 0;
  if (tPenalty > 0 && iPenalty > 0) {
    previewDeduction = Math.min(50, Math.round(Math.max(tPenalty, iPenalty) * 1.4));
  } else {
    previewDeduction = Math.max(tPenalty, iPenalty);
  }

  // Kiểu xử lý ẩn nội dung & án phạt dự kiến
  const isViolenceTriggered = selectedTextLabel === 'Violence' || (hasImage && selectedImageLabel === 'Violence');
  const isFullyClean = selectedTextLabel === 'Normal' && (!hasImage || selectedImageLabel === 'Clean');

  let previewSanctionText = '';
  if (isFullyClean) {
    previewSanctionText = 'Khôi phục hiển thị công khai & gỡ bỏ toàn bộ án phạt (Normal / Clean)';
  } else if (isViolenceTriggered) {
    previewSanctionText = 'Ẩn bài viết/bình luận & áp dụng án phạt Cooldown 10 phút cho tài khoản tác giả';
  } else if (selectedTextLabel === 'Hate Speech') {
    previewSanctionText = 'Ẩn cứng nội dung vi phạm tiêu chuẩn nghiêm trọng về ngôn từ thù địch (Hate Speech)';
  } else {
    previewSanctionText = 'Ẩn nội dung vi phạm tiêu chuẩn cộng đồng (Toxic / NSFW)';
  }

  const handleSubmit = (e) => {
    e.preventDefault();

    if (onConfirmResolve) {
      onConfirmResolve(report.id, {
        status: decision,
        newLabel: decision === 'resolved_violation' ? selectedTextLabel : initialTextLabel,
        oldLabel: initialTextLabel,
        newImageLabel: hasImage ? (decision === 'resolved_violation' ? selectedImageLabel : initialImageLabel) : null,
        oldImageLabel: hasImage ? initialImageLabel : null,
        textAction: {
          oldLabel: initialTextLabel,
          newLabel: selectedTextLabel,
          changed: isTextChanged
        },
        imageAction: hasImage ? {
          oldLabel: initialImageLabel,
          newLabel: selectedImageLabel,
          changed: isImageChanged
        } : null,
        hasImage,
        adminNotes: adminNotes.trim() || (decision === 'dismissed' 
          ? 'Báo cáo không có căn cứ. Nội dung hợp lệ, giữ nguyên nhãn ban đầu.' 
          : `Xác nhận vi phạm: Văn bản [${initialTextLabel} → ${selectedTextLabel}]${hasImage ? `, Hình ảnh [${initialImageLabel} → ${selectedImageLabel}]` : ''}.`
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
      case 'NSFW':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Normal':
      case 'Clean':
      case 'Safe':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const modalityBadge = () => {
    const mod = report.targetModality || report.target_modality || (hasImage ? 'both' : 'text');
    if (mod === 'text') {
      return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">Báo cáo: Chỉ phần văn bản</span>;
    }
    if (mod === 'image') {
      return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">Báo cáo: Chỉ phần hình ảnh</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">Báo cáo: Cả văn bản &amp; hình ảnh</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div 
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
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
          
          {/* Khối Thông tin báo cáo & Nội dung bị gắn cờ */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-900">{report.reporter?.name || 'Người dùng'}</span>
                <span className="text-slate-500">đã báo cáo mục của</span>
                <span className="font-semibold text-slate-900">{report.targetAuthor?.name || 'Thành viên'}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {modalityBadge()}
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

            {/* Trích đoạn nội dung bị báo cáo & Nhãn hiện tại */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  Nội dung bị gắn cờ:
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Nhãn văn bản:</span>
                    <span className={`px-2 py-0.5 rounded font-semibold border text-[11px] ${getBadgeStyle(initialTextLabel)}`}>
                      {initialTextLabel}
                    </span>
                  </div>
                  {hasImage && (
                    <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                      <span className="text-slate-500">Nhãn ảnh:</span>
                      <span className={`px-2 py-0.5 rounded font-semibold border text-[11px] ${getBadgeStyle(initialImageLabel)}`}>
                        {initialImageLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Text câu */}
              {(report.contentExcerpt || report.targetExcerpt) && (
                <div className="p-3 bg-white rounded-md border border-slate-200 text-slate-900 font-medium leading-relaxed">
                  "{report.contentExcerpt || report.targetExcerpt}"
                </div>
              )}

              {/* Ảnh đính kèm (nếu có) */}
              {hasImage && (
                <div className="mt-2.5 p-2 bg-white rounded-md border border-slate-200 flex items-center gap-3">
                  <img 
                    src={report.imageUrl || report.image} 
                    alt="Ảnh báo cáo" 
                    className="w-16 h-16 object-cover rounded-md border border-slate-200 hover:opacity-90 cursor-pointer"
                    onClick={() => window.open(report.imageUrl || report.image, '_blank')}
                  />
                  <div>
                    <p className="font-medium text-slate-800">Hình ảnh kèm bài viết/bình luận</p>
                    <p className="text-[11px] text-slate-500">Bấm vào ảnh để xem chi tiết kích thước gốc</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 1. Kết luận thẩm định của Kiểm duyệt viên */}
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
                      onChange={() => handleDecisionChange('dismissed')}
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
                  <strong className="text-emerald-800 block mt-0.5">➔ GIỮ NGUYÊN nhãn hiện tại ({initialTextLabel}{hasImage ? ` & ${initialImageLabel}` : ''})</strong>
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
                      onChange={() => handleDecisionChange('resolved_violation')}
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
                  <strong className="text-rose-800 block mt-0.5">➔ GÁN LẠI NHÃN &amp; GHI VÀO NHẬT KÝ</strong>
                </p>
              </label>
            </div>
          </div>

          {/* 2. Thẩm định độc lập từng khối (Chỉ hiển thị khi Báo cáo ĐÚNG) */}
          {decision === 'resolved_violation' && (
            <div className="p-4 rounded-lg bg-rose-50/50 border border-rose-200 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="font-bold text-rose-950 text-xs block">
                  2. Chọn nhãn mới gán lại (thẩm định độc lập từng khối):
                </label>
                <span className="text-[11px] text-slate-500">Mặc định chọn sẵn nhãn hiện tại, chỉ đổi khối vi phạm</span>
              </div>

              {/* KHỐI 1: VĂN BẢN (TEXT) */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    Khối Văn bản (Text)
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-slate-500">Hiện tại:</span>
                    <span className={`px-2 py-0.5 rounded font-semibold border ${getBadgeStyle(initialTextLabel)}`}>
                      {initialTextLabel}
                    </span>
                    {isTextChanged && (
                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">
                        Đã đổi
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {/* Normal */}
                  <button
                    type="button"
                    onClick={() => setSelectedTextLabel('Normal')}
                    className={`p-2 rounded-md border text-left transition cursor-pointer flex flex-col ${
                      selectedTextLabel === 'Normal'
                        ? 'bg-emerald-50/60 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span>Normal</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-normal mt-0.5">Bình thường</span>
                  </button>

                  {/* Toxic */}
                  <button
                    type="button"
                    onClick={() => setSelectedTextLabel('Toxic')}
                    className={`p-2 rounded-md border text-left transition cursor-pointer flex flex-col ${
                      selectedTextLabel === 'Toxic'
                        ? 'bg-amber-50/60 border-amber-500 text-amber-950 ring-2 ring-amber-400 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                      <span>Toxic</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5">Độc hại, xúc phạm</span>
                  </button>

                  {/* Hate Speech */}
                  <button
                    type="button"
                    onClick={() => setSelectedTextLabel('Hate Speech')}
                    className={`p-2 rounded-md border text-left transition cursor-pointer flex flex-col ${
                      selectedTextLabel === 'Hate Speech'
                        ? 'bg-orange-50/60 border-orange-500 text-orange-950 ring-2 ring-orange-400 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                      <span>Hate Speech</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5">Thù ghét, kỳ thị</span>
                  </button>

                  {/* Violence */}
                  <button
                    type="button"
                    onClick={() => setSelectedTextLabel('Violence')}
                    className={`p-2 rounded-md border text-left transition cursor-pointer flex flex-col ${
                      selectedTextLabel === 'Violence'
                        ? 'bg-rose-50/60 border-rose-500 text-rose-950 ring-2 ring-rose-400 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                      <span>Violence</span>
                    </span>
                    <span className="text-[10px] text-rose-700 font-normal mt-0.5">Bạo lực (Phạt 10p)</span>
                  </button>
                </div>
              </div>

              {/* KHỐI 2: HÌNH ẢNH (IMAGE) - CHỈ HIỂN THỊ NẾU CÓ ẢNH */}
              {hasImage && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                      Khối Hình ảnh (Image)
                    </span>
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-slate-500">Hiện tại:</span>
                      <span className={`px-2 py-0.5 rounded font-semibold border ${getBadgeStyle(initialImageLabel)}`}>
                        {initialImageLabel}
                      </span>
                      {isImageChanged && (
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">
                          Đã đổi
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {/* Clean */}
                    <button
                      type="button"
                      onClick={() => setSelectedImageLabel('Clean')}
                      className={`p-2 rounded-md border text-left transition cursor-pointer flex flex-col ${
                        selectedImageLabel === 'Clean'
                          ? 'bg-emerald-50/60 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                        <span>Clean</span>
                      </span>
                      <span className="text-[10px] text-emerald-700 font-normal mt-0.5">Ảnh sạch, an toàn</span>
                    </button>

                    {/* NSFW */}
                    <button
                      type="button"
                      onClick={() => setSelectedImageLabel('NSFW')}
                      className={`p-2 rounded-md border text-left transition cursor-pointer flex flex-col ${
                        selectedImageLabel === 'NSFW'
                          ? 'bg-amber-50/60 border-amber-500 text-amber-950 ring-2 ring-amber-400 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                        <span>NSFW</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal mt-0.5">Ảnh nhạy cảm 18+</span>
                    </button>

                    {/* Violence */}
                    <button
                      type="button"
                      onClick={() => setSelectedImageLabel('Violence')}
                      className={`p-2 rounded-md border text-left transition cursor-pointer flex flex-col ${
                        selectedImageLabel === 'Violence'
                          ? 'bg-rose-50/60 border-rose-500 text-rose-950 ring-2 ring-rose-400 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                        <span>Violence</span>
                      </span>
                      <span className="text-[10px] text-rose-700 font-normal mt-0.5">Máu me, bạo lực cấm</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CẢNH BÁO KHI CHỌN BÁO CÁO ĐÚNG NHƯNG CHƯA ĐỔI NHÃN (QUY TẮC 1) */}
              {isSubmitBlocked && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg flex items-center gap-2 text-amber-900 text-xs animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Lưu ý:</strong> Bạn đã chọn <em>Báo cáo ĐÚNG</em> nhưng chưa thay đổi nhãn nào của câu văn hoặc hình ảnh. Vui lòng chọn nhãn vi phạm mới cần gán lại ở trên để tránh sai sót.
                  </span>
                </div>
              )}

              {/* TÓM TẮT CHUYỂN ĐỔI NHÃN & TÁC ĐỘNG HẬU QUẢ (PREVIEW) */}
              <div className="p-3 bg-white rounded-lg border border-rose-200/90 text-xs space-y-2">
                <div className="font-semibold text-slate-800 pb-1 border-b border-slate-100 flex items-center justify-between">
                  <span>Quy trình chuyển đổi nhãn:</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Chỉ ghi nhật ký cho khối có nhãn thay đổi
                  </span>
                </div>

                {/* Dòng 1: Văn bản */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="text-slate-600 font-medium">Văn bản:</span>
                  {isTextChanged ? (
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className={`px-2 py-0.5 rounded border ${getBadgeStyle(initialTextLabel)}`}>
                        {initialTextLabel}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className={`px-2 py-0.5 rounded border ${getBadgeStyle(selectedTextLabel)}`}>
                        {selectedTextLabel}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-500 font-medium">
                      {initialTextLabel} <span className="text-slate-400 font-normal">(giữ nguyên)</span>
                    </span>
                  )}
                </div>

                {/* Dòng 2: Hình ảnh (nếu có) */}
                {hasImage && (
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="text-slate-600 font-medium">Hình ảnh:</span>
                    {isImageChanged ? (
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span className={`px-2 py-0.5 rounded border ${getBadgeStyle(initialImageLabel)}`}>
                          {initialImageLabel}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className={`px-2 py-0.5 rounded border ${getBadgeStyle(selectedImageLabel)}`}>
                          {selectedImageLabel}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 font-medium">
                        {initialImageLabel} <span className="text-slate-400 font-normal">(giữ nguyên)</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Điểm trừ và kiểu ẩn dự kiến */}
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <div className="flex items-center justify-between flex-wrap gap-1 text-[11px]">
                    <span className="text-slate-600">Điểm uy tín áp dụng:</span>
                    {previewDeduction > 0 ? (
                      <span className="font-bold text-rose-600">
                        -{previewDeduction} điểm {tPenalty > 0 && iPenalty > 0 ? '(hệ số tăng nặng multimodal 1.4x)' : ''}
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-600">
                        0 điểm (An toàn / Gỡ phạt)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-700">
                    <span className="font-medium">Kiểu ẩn &amp; án phạt: </span>
                    <span className={isViolenceTriggered ? 'text-rose-700 font-semibold' : isFullyClean ? 'text-emerald-700 font-semibold' : 'text-amber-800'}>
                      {previewSanctionText}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 3. Ghi chú của Quản trị viên */}
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
                : 'Nhập ghi chú vi phạm (ví dụ: Văn bản có từ ngữ bạo lực, ảnh đạt chuẩn...)'
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
              disabled={isSubmitting || isSubmitBlocked}
              title={isSubmitBlocked ? 'Vui lòng chọn ít nhất một nhãn khác với nhãn hiện tại trước khi xác nhận Báo cáo ĐÚNG' : ''}
              className={`h-9 px-5 rounded-md text-xs font-semibold text-white shadow-xs transition flex items-center gap-1.5 ${
                isSubmitBlocked
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                  : decision === 'dismissed'
                  ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-400 cursor-pointer'
                  : 'bg-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-400 cursor-pointer'
              }`}
            >
              {isSubmitting ? 'Đang lưu...' : (decision === 'dismissed' ? 'Xác nhận Báo Cáo Sai (Giữ nhãn)' : 'Xác nhận Báo Cáo Đúng (Cập nhật nhãn)')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Image as ImageIcon, Type, Video, Sparkles, AlertCircle, 
  Globe, Users, Lock, Loader2, ArrowLeft, CheckCircle2,
  RotateCw, FlipHorizontal, Maximize2, Minimize2,
  Sun, Contrast, Palette, SlidersHorizontal, RefreshCw,
  Volume2, VolumeX, Wand2, AlignLeft, AlignCenter, AlignRight,
  Paintbrush
} from 'lucide-react';
import { createStoryApi, uploadStoryMedia } from '../api/client';

const GRADIENT_PRESETS = [
  { id: 'sunset', label: 'Hoàng hôn', style: { background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' } },
  { id: 'ocean', label: 'Đại dương', style: { background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' } },
  { id: 'aurora', label: 'Bắc cực quang', style: { background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' } },
  { id: 'purple', label: 'Tím mộng mơ', style: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } },
  { id: 'fire', label: 'Lửa hồng', style: { background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' } },
  { id: 'midnight', label: 'Đêm huyền bí', style: { background: 'linear-gradient(135deg, #09203f 0%, #537895 100%)' } },
  { id: 'cyberpunk', label: 'Neon Cyber', style: { background: 'linear-gradient(135deg, #8a2387 0%, #e94057 50%, #f27121 100%)' } },
  { id: 'emerald', label: 'Ngọc lục bảo', style: { background: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)' } },
  { id: 'deepspace', label: 'Vũ trụ sâu', style: { background: 'linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)' } },
  { id: 'gold', label: 'Hoàng kim', style: { background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' } },
  { id: 'darkslate', label: 'Xám sang trọng', style: { background: 'linear-gradient(135deg, #232526 0%, #414345 100%)' } },
  { id: 'candy', label: 'Kẹo ngọt', style: { background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' } },
];

const FONT_OPTIONS = [
  { id: 'sans-serif', label: 'Hiện đại' },
  { id: 'serif', label: 'Cổ điển' },
  { id: 'cursive', label: 'Mềm mại' },
  { id: 'impact', label: 'Nổi bật' },
];

const MEDIA_FILTERS = [
  { id: 'normal', label: 'Gốc', filter: 'none', color: '#94a3b8' },
  { id: 'vivid', label: 'Rực rỡ', filter: 'contrast(115%) saturate(135%) brightness(105%)', color: '#f59e0b' },
  { id: 'vintage', label: 'Cổ điển', filter: 'sepia(35%) contrast(110%) brightness(95%)', color: '#d97706' },
  { id: 'bw', label: 'Đen trắng', filter: 'grayscale(100%) contrast(115%)', color: '#475569' },
  { id: 'warm', label: 'Ấm áp', filter: 'sepia(20%) saturate(125%) brightness(105%)', color: '#ea580c' },
  { id: 'cool', label: 'Mát lạnh', filter: 'hue-rotate(185deg) saturate(90%)', color: '#0284c7' },
  { id: 'dramatic', label: 'Điện ảnh', filter: 'contrast(130%) brightness(92%) saturate(115%)', color: '#7c3aed' },
];

/**
 * Xuất ảnh đã qua chỉnh sửa (Xoay, Lật, Bộ lọc, Độ sáng) sang File Blob qua Canvas
 */
function exportEditedImage(file, { rotation, isFlippedH, filterString }) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const isRotated90 = (rotation % 180) !== 0;

        canvas.width = isRotated90 ? img.naturalHeight : img.naturalWidth;
        canvas.height = isRotated90 ? img.naturalWidth : img.naturalHeight;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        if (isFlippedH) {
          ctx.scale(-1, 1);
        }
        if (filterString && filterString !== 'none') {
          ctx.filter = filterString;
        }
        ctx.drawImage(
          img,
          -img.naturalWidth / 2,
          -img.naturalHeight / 2,
          img.naturalWidth,
          img.naturalHeight
        );
        ctx.restore();

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob) {
              const editedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
              });
              resolve(editedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.92
        );
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        console.warn('Lỗi xử lý canvas, sử dụng file gốc:', err);
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

export default function CreateStoryModal({ currentUser, isOpen, onClose, onStoryCreated }) {
  const [mode, setMode] = useState(null); // 'text' | 'media' | null
  const [textContent, setTextContent] = useState('');
  const [privacy, setPrivacy] = useState('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [nudgeData, setNudgeData] = useState(null);

  // State cấu hình tin văn bản
  const [selectedGradient, setSelectedGradient] = useState(GRADIENT_PRESETS[0]);
  const [bgTab, setBgTab] = useState('presets'); // 'presets' | 'custom'
  const [bgType, setBgType] = useState('preset'); // 'preset' | 'customGradient' | 'solid'
  const [customColor1, setCustomColor1] = useState('#4f46e5'); // Màu đầu
  const [customColor2, setCustomColor2] = useState('#ec4899'); // Màu cuối
  const [customSolidColor, setCustomSolidColor] = useState('#0f172a'); // Màu đơn
  const [gradientDirection, setGradientDirection] = useState('135deg'); // '135deg' | '180deg' | '90deg' | 'radial'
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [textAlign, setTextAlign] = useState('center'); // 'left' | 'center' | 'right'

  // State cấu hình tin Media
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('image'); // 'image' | 'video'
  const [fitMode, setFitMode] = useState('contain'); // 'contain' (vừa vặn, không mất góc) | 'cover' (lấp đầy khung)
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [isFlippedH, setIsFlippedH] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [brightness, setBrightness] = useState(100); // 50 - 150
  const [contrast, setContrast] = useState(100); // 50 - 150
  const [saturation, setSaturation] = useState(100); // 0 - 200
  const [isMuted, setIsMuted] = useState(false);
  const [editTab, setEditTab] = useState('fit'); // 'fit' | 'filter' | 'tune'

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !isSubmitting) {
          handleClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow || 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, isSubmitting]);

  if (!isOpen) return null;

  const resetState = () => {
    setMode(null);
    setTextContent('');
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType('image');
    setErrorMsg('');
    setNudgeData(null);
    setSelectedGradient(GRADIENT_PRESETS[0]);
    setBgTab('presets');
    setBgType('preset');
    setCustomColor1('#4f46e5');
    setCustomColor2('#ec4899');
    setCustomSolidColor('#0f172a');
    setGradientDirection('135deg');
    setFontFamily('sans-serif');
    setTextAlign('center');
    setFitMode('contain');
    setRotation(0);
    setIsFlippedH(false);
    setSelectedFilter('normal');
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setIsMuted(false);
    setEditTab('fit');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      setErrorMsg('Vui lòng chọn file hình ảnh (JPG, PNG) hoặc video (MP4, MOV)');
      return;
    }

    if (isVideo && file.size > 60 * 1024 * 1024) {
      setErrorMsg('Video không được vượt quá 60MB (tối đa 60 giây)');
      return;
    }

    if (isImage && file.size > 10 * 1024 * 1024) {
      setErrorMsg('Ảnh không được vượt quá 10MB');
      return;
    }

    setErrorMsg('');
    setMediaFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
    setFitMode('contain'); // Mặc định vừa vặn không mất góc ảnh
    setMode('media');
  };

  // Tính style màu nền cho Tin Văn Bản
  const getComputedBackgroundStyle = () => {
    if (bgType === 'preset') {
      return selectedGradient.style;
    }
    if (bgType === 'solid') {
      return { background: customSolidColor };
    }
    if (gradientDirection === 'radial') {
      return { background: `radial-gradient(circle, ${customColor1} 0%, ${customColor2} 100%)` };
    }
    return { background: `linear-gradient(${gradientDirection}, ${customColor1} 0%, ${customColor2} 100%)` };
  };

  // Font family hiển thị
  const getFontFamilyValue = () => {
    switch (fontFamily) {
      case 'serif':
        return 'Georgia, Cambria, "Times New Roman", serif';
      case 'cursive':
        return '"Brush Script MT", "Dancing Script", cursive';
      case 'impact':
        return 'Impact, "Arial Black", sans-serif';
      default:
        return 'system-ui, -apple-system, sans-serif';
    }
  };

  // Tính chuỗi CSS filter tổng hợp cho ảnh/video
  const getCombinedFilterString = () => {
    const filterObj = MEDIA_FILTERS.find((f) => f.id === selectedFilter);
    const baseFilter = filterObj && filterObj.filter !== 'none' ? filterObj.filter : '';
    
    const adjustments = [];
    if (brightness !== 100) adjustments.push(`brightness(${brightness}%)`);
    if (contrast !== 100) adjustments.push(`contrast(${contrast}%)`);
    if (saturation !== 100) adjustments.push(`saturate(${saturation}%)`);

    const combined = [baseFilter, ...adjustments].filter(Boolean).join(' ');
    return combined || 'none';
  };

  const handleResetAdjustments = () => {
    setSelectedFilter('normal');
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setRotation(0);
    setIsFlippedH(false);
    setFitMode('contain');
  };

  const handleSubmit = async (force = false) => {
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      let finalMediaUrl = null;

      if (mode === 'media') {
        if (!mediaFile) {
          setErrorMsg('Vui lòng chọn hình ảnh hoặc video');
          setIsSubmitting(false);
          return;
        }

        let fileToUpload = mediaFile;
        const combinedFilterCss = getCombinedFilterString();
        const hasVisualEdits = rotation !== 0 || isFlippedH || combinedFilterCss !== 'none';

        // Nếu là ảnh và có chỉnh sửa, xuất file mới qua Canvas
        if (mediaType === 'image' && hasVisualEdits) {
          fileToUpload = await exportEditedImage(mediaFile, {
            rotation,
            isFlippedH,
            filterString: combinedFilterCss,
          });
        }

        // Upload media lên Cloudinary
        const uploadRes = await uploadStoryMedia(fileToUpload);
        finalMediaUrl = uploadRes.url;
      }

      const res = await createStoryApi({
        storyType: mode === 'text' ? 'text' : mediaType,
        mediaUrl: finalMediaUrl,
        textContent: textContent.trim() || null,
        backgroundStyle: mode === 'text' ? {
          ...getComputedBackgroundStyle(),
          fontFamily: getFontFamilyValue(),
          textAlign,
          color: '#ffffff',
        } : {
          fitMode,
          filter: getCombinedFilterString(),
          rotation,
          isFlippedH,
          isMuted,
        },
        privacy,
        forcePost: force,
      });

      // Nếu hệ thống kích hoạt Friendly Nudge cảnh báo từ ngữ
      if (res?.nudge) {
        setNudgeData(res);
        setIsSubmitting(false);
        return;
      }

      if (res?.success) {
        if (onStoryCreated) onStoryCreated(res.data);
        handleClose();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Không thể đăng tin. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) handleClose();
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${mode ? 'max-w-3xl' : 'max-w-2xl'} bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]`}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {mode && (
              <button 
                onClick={() => setMode(null)}
                className="p-1 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Quay lại chọn định dạng"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              {mode === 'text' ? 'Tạo tin văn bản' : mode === 'media' ? 'Chỉnh sửa & Đăng tin Media' : 'Tạo tin của bạn'}
            </h2>
          </div>
          <button 
            onClick={handleClose} 
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Friendly Nudge Dialog (Nếu AI phát hiện từ ngữ tiêu cực) */}
        {nudgeData && (
          <div className="p-5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                  Lời nhắc nhở thân thiện từ NexusAI
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  {nudgeData.message}
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={() => setNudgeData(null)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Xem lại & Chỉnh sửa
                  </button>
                  <button
                    onClick={() => handleSubmit(true)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm cursor-pointer"
                  >
                    Vẫn tiếp tục đăng
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Màn hình chọn ban đầu: Chọn Tin ảnh/video hoặc Tin chữ */}
          {!mode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-8">
              <button
                onClick={() => setMode('text')}
                className="group p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition flex flex-col items-center justify-center text-center gap-4 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition">
                  <Type className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Tạo tin văn bản</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Viết thông điệp, tự phối màu nền gradient hoặc màu đơn sắc hiện đại
                  </p>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="group p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition flex flex-col items-center justify-center text-center gap-4 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Tạo tin ảnh hoặc video</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Chỉnh sửa khung hình (không cắt mép), xoay lật, bộ lọc màu chuẩn Story
                  </p>
                </div>
              </button>

              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*,video/*" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </div>
          )}

          {/* Màn hình soạn Tin Văn Bản (Bố cục 2 cột chuẩn Studio) */}
          {mode === 'text' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* CỘT TRÁI: LIVE STORY 9:16 PREVIEW (Không bị đè / méo tỉ lệ) */}
              <div className="md:col-span-5 flex flex-col items-center">
                <div 
                  className="relative w-full max-w-[240px] aspect-[9/16] rounded-2xl p-5 flex items-center justify-center text-center shadow-xl transition-all border border-slate-700/30 overflow-hidden"
                  style={getComputedBackgroundStyle()}
                >
                  <p 
                    className="text-white font-bold text-lg sm:text-xl break-words max-w-full drop-shadow-md select-none transition-all leading-relaxed"
                    style={{ 
                      fontFamily: getFontFamilyValue(),
                      textAlign,
                    }}
                  >
                    {textContent.trim() || 'Bắt đầu nhập nội dung tin...'}
                  </p>

                  {/* Badge đếm ký tự nhỏ góc dưới */}
                  <div className="absolute bottom-2.5 right-3 text-[10px] text-white/70 font-semibold bg-black/30 backdrop-blur-xs px-2 py-0.5 rounded-full">
                    {textContent.length}/500
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  Xem trước trực tiếp định dạng 9:16 trên Tin
                </p>
              </div>

              {/* CỘT PHẢI: TRÌNH SOẠN THẢO VĂN BẢN & PHỐI MÀU HIỆN ĐẠI */}
              <div className="md:col-span-7 space-y-4">
                {/* 1. Ô soạn thảo văn bản */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    NỘI DUNG TIN VĂN BẢN *
                  </label>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Bạn đang nghĩ gì thế? Viết điều gì đó thật thú vị nào..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 text-sm resize-none shadow-inner"
                  />
                </div>

                {/* 2. Căn lề & Kiểu chữ */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Kiểu chữ */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      PHÔNG CHỮ
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FONT_OPTIONS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFontFamily(f.id)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition truncate cursor-pointer ${
                            fontFamily === f.id
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-500'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Căn lề */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      CĂN LỀ CHỮ
                    </label>
                    <div className="flex gap-1.5">
                      {[
                        { id: 'left', icon: AlignLeft, label: 'Trái' },
                        { id: 'center', icon: AlignCenter, label: 'Giữa' },
                        { id: 'right', icon: AlignRight, label: 'Phải' },
                      ].map((al) => {
                        const IconComp = al.icon;
                        return (
                          <button
                            key={al.id}
                            type="button"
                            onClick={() => setTextAlign(al.id)}
                            className={`flex-1 py-2 rounded-lg border flex items-center justify-center transition cursor-pointer ${
                              textAlign === al.id
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 border-blue-500'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                            }`}
                            title={al.label}
                          >
                            <IconComp className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. Tùy chọn Màu Nền (Presets vs Tự Chọn Màu Hiện Đại) */}
                <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Paintbrush className="w-3.5 h-3.5 text-blue-500" />
                      <span>CHỌN MÀU NỀN</span>
                    </label>
                    <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setBgTab('presets')}
                        className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                          bgTab === 'presets'
                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Mẫu phối sẵn
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBgTab('custom');
                          if (bgType === 'preset') setBgType('customGradient');
                        }}
                        className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                          bgTab === 'custom'
                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Tự phối màu
                      </button>
                    </div>
                  </div>

                  {/* Tab 1: Mẫu gradient có sẵn */}
                  {bgTab === 'presets' && (
                    <div className="grid grid-cols-6 gap-2">
                      {GRADIENT_PRESETS.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setSelectedGradient(g);
                            setBgType('preset');
                          }}
                          className={`w-full aspect-square rounded-xl transition transform hover:scale-105 flex items-center justify-center cursor-pointer ${
                            bgType === 'preset' && selectedGradient.id === g.id
                              ? 'ring-2 ring-blue-500 ring-offset-2'
                              : 'border border-slate-200/50'
                          }`}
                          style={g.style}
                          title={g.label}
                        >
                          {bgType === 'preset' && selectedGradient.id === g.id && (
                            <CheckCircle2 className="w-4 h-4 text-white drop-shadow" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tab 2: Tự chọn màu nền hiện đại */}
                  {bgTab === 'custom' && (
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      {/* Chuyển đổi Gradient vs Solid */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBgType('customGradient')}
                          className={`flex-1 py-1 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                            bgType === 'customGradient'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600'
                          }`}
                        >
                          Dải màu Gradient
                        </button>
                        <button
                          type="button"
                          onClick={() => setBgType('solid')}
                          className={`flex-1 py-1 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                            bgType === 'solid'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600'
                          }`}
                        >
                          Màu đơn sắc
                        </button>
                      </div>

                      {/* Nếu là Gradient: 2 ô chọn màu + Hướng gradient */}
                      {bgType === 'customGradient' ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            {/* Màu 1 */}
                            <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                              <input
                                type="color"
                                value={customColor1}
                                onChange={(e) => setCustomColor1(e.target.value)}
                                className="w-7 h-7 rounded-lg cursor-pointer border-none bg-transparent"
                              />
                              <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 font-bold">MÀU ĐẦU</p>
                                <p className="text-xs font-mono font-semibold uppercase">{customColor1}</p>
                              </div>
                            </div>

                            {/* Màu 2 */}
                            <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                              <input
                                type="color"
                                value={customColor2}
                                onChange={(e) => setCustomColor2(e.target.value)}
                                className="w-7 h-7 rounded-lg cursor-pointer border-none bg-transparent"
                              />
                              <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 font-bold">MÀU CUỐI</p>
                                <p className="text-xs font-mono font-semibold uppercase">{customColor2}</p>
                              </div>
                            </div>
                          </div>

                          {/* Hướng đổ màu */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-medium">Hướng màu:</span>
                            <div className="flex gap-1.5">
                              {[
                                { id: '135deg', label: 'Chéo ↗' },
                                { id: '180deg', label: 'Dọc ↓' },
                                { id: '90deg', label: 'Ngang →' },
                                { id: 'radial', label: 'Tỏa tròn' },
                              ].map((d) => (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => setGradientDirection(d.id)}
                                  className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
                                    gradientDirection === d.id
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Gợi ý phối màu hiện đại */}
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold mb-1.5">GỢI Ý PHỐI MÀU TRENDING:</p>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                              {[
                                ['#4f46e5', '#ec4899'],
                                ['#06b6d4', '#3b82f6'],
                                ['#f97316', '#e11d48'],
                                ['#10b981', '#06b6d4'],
                                ['#8b5cf6', '#d946ef'],
                                ['#111827', '#4b5563'],
                              ].map(([c1, c2], idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setCustomColor1(c1);
                                    setCustomColor2(c2);
                                    setBgType('customGradient');
                                  }}
                                  className="w-7 h-7 rounded-lg shrink-0 border border-white/50 shadow-xs hover:scale-110 transition cursor-pointer"
                                  style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Nếu là Solid Color */
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <input
                              type="color"
                              value={customSolidColor}
                              onChange={(e) => setCustomSolidColor(e.target.value)}
                              className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent"
                            />
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold">MÃ MÀU CHỌN</p>
                              <p className="text-xs font-mono font-semibold uppercase">{customSolidColor}</p>
                            </div>
                          </div>

                          {/* Các màu đơn sắc sang trọng */}
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {['#0f172a', '#1e1b4b', '#4c0519', '#14532d', '#701a75', '#451a03', '#1e293b'].map((col) => (
                              <button
                                key={col}
                                type="button"
                                onClick={() => {
                                  setCustomSolidColor(col);
                                  setBgType('solid');
                                }}
                                className="w-7 h-7 rounded-lg shrink-0 border border-slate-300 shadow-xs hover:scale-110 transition cursor-pointer"
                                style={{ background: col }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Màn hình xem trước & Bộ công cụ chỉnh sửa Media */}
          {mode === 'media' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* CỘT TRÁI: KHUNG XEM TRƯỚC LIVE STORY 9:16 */}
              <div className="md:col-span-5 flex flex-col items-center">
                <div className="relative w-full max-w-[240px] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-xl flex items-center justify-center border border-slate-700">
                  {/* Nền mờ Ambient khi ở chế độ contain */}
                  {fitMode === 'contain' && (
                    <div
                      className="absolute inset-0 bg-cover bg-center blur-xl opacity-60 scale-125 pointer-events-none transition-all duration-300"
                      style={{
                        backgroundImage: mediaType === 'image' ? `url(${mediaPreview})` : undefined,
                      }}
                    />
                  )}

                  {mediaType === 'video' ? (
                    <video
                      src={mediaPreview}
                      controls
                      muted={isMuted}
                      playsInline
                      className={`relative z-10 w-full h-full transition-all duration-200 ${
                        fitMode === 'cover' ? 'object-cover' : 'object-contain'
                      }`}
                      style={{
                        transform: `rotate(${rotation}deg) scaleX(${isFlippedH ? -1 : 1})`,
                        filter: getCombinedFilterString(),
                      }}
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Preview"
                      className={`relative z-10 w-full h-full transition-all duration-200 ${
                        fitMode === 'cover' ? 'object-cover' : 'object-contain'
                      }`}
                      style={{
                        transform: `rotate(${rotation}deg) scaleX(${isFlippedH ? -1 : 1})`,
                        filter: getCombinedFilterString(),
                      }}
                    />
                  )}

                  {/* Chú thích hiển thị trực tiếp trên Story */}
                  {textContent.trim() && (
                    <div className="absolute bottom-3 inset-x-2 z-20 p-2 rounded-xl bg-black/60 backdrop-blur-md text-white text-center text-xs line-clamp-2">
                      {textContent}
                    </div>
                  )}

                  {/* Nút Đổi tệp */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute top-2.5 right-2.5 z-20 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-[11px] font-semibold backdrop-blur-md transition cursor-pointer"
                  >
                    Đổi tệp
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  Xem trước định dạng 9:16 trên Tin
                </p>
              </div>

              {/* CỘT PHẢI: BỘ CÔNG CỤ CHỈNH SỬA ĐA NĂNG */}
              <div className="md:col-span-7 space-y-4">
                {/* Tabs chuyển đổi công cụ */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    onClick={() => setEditTab('fit')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      editTab === 'fit'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Khung & Góc</span>
                  </button>
                  <button
                    onClick={() => setEditTab('filter')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      editTab === 'filter'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Bộ lọc màu</span>
                  </button>
                  <button
                    onClick={() => setEditTab('tune')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      editTab === 'tune'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Tinh chỉnh</span>
                  </button>
                </div>

                {/* TAB 1: KHUNG HÌNH & GÓC QUAY */}
                {editTab === 'fit' && (
                  <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                        CHẾ ĐỘ HIỂN THỊ
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFitMode('contain')}
                          className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                            fitMode === 'contain'
                              ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <Minimize2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Vừa vặn (Không cắt mép)</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Thấy trọn 100% ảnh/video, kèm nền mờ sang trọng
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFitMode('cover')}
                          className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                            fitMode === 'cover'
                              ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Lấp đầy khung</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Phóng to tràn viền 9:16 (có thể cắt mép nếu ảnh ngang)
                          </p>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                        XOAY & ĐẢO HƯỚNG
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRotation((prev) => (prev + 90) % 360)}
                          className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          <RotateCw className="w-4 h-4 text-blue-600" />
                          <span>Xoay 90° ({rotation}°)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsFlippedH((prev) => !prev)}
                          className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                            isFlippedH
                              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950/40'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <FlipHorizontal className="w-4 h-4 text-blue-600" />
                          <span>Lật ảnh ngang</span>
                        </button>

                        {mediaType === 'video' && (
                          <button
                            type="button"
                            onClick={() => setIsMuted((prev) => !prev)}
                            className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                              isMuted
                                ? 'border-rose-500 bg-rose-50 text-rose-600 dark:bg-rose-950/40'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                            title={isMuted ? 'Đang tắt tiếng' : 'Bật tiếng'}
                          >
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            <span>{isMuted ? 'Tắt tiếng' : 'Có tiếng'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: BỘ LỌC MÀU (FILTERS) */}
                {editTab === 'filter' && (
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      CHỌN BỘ LỌC NGHỆ THUẬT
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {MEDIA_FILTERS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setSelectedFilter(f.id)}
                          className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                            selectedFilter === f.id
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-bold ring-2 ring-blue-500/20'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <div 
                            className="w-8 h-8 rounded-full border border-slate-300 shadow-xs flex items-center justify-center text-xs"
                            style={{ background: f.color || '#3b82f6' }}
                          >
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-[11px] truncate w-full">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: TINH CHỈNH ÁNH SÁNG */}
                {editTab === 'tune' && (
                  <div className="space-y-3.5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        TINH CHỈNH ÁNH SÁNG & MÀU SẮC
                      </label>
                      <button
                        type="button"
                        onClick={handleResetAdjustments}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Khôi phục gốc</span>
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      {/* Độ sáng */}
                      <div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                          <span className="flex items-center gap-1 font-medium">
                            <Sun className="w-3.5 h-3.5 text-amber-500" /> Độ sáng
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">{brightness}%</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="150"
                          value={brightness}
                          onChange={(e) => setBrightness(Number(e.target.value))}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>

                      {/* Độ tương phản */}
                      <div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                          <span className="flex items-center gap-1 font-medium">
                            <Contrast className="w-3.5 h-3.5 text-indigo-500" /> Độ tương phản
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">{contrast}%</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="150"
                          value={contrast}
                          onChange={(e) => setContrast(Number(e.target.value))}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>

                      {/* Độ bão hòa màu */}
                      <div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                          <span className="flex items-center gap-1 font-medium">
                            <Wand2 className="w-3.5 h-3.5 text-rose-500" /> Độ bão hòa màu
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">{saturation}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={saturation}
                          onChange={(e) => setSaturation(Number(e.target.value))}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Ô NHẬP CHÚ THÍCH */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    CHÚ THÍCH (TÙY CHỌN)
                  </label>
                  <input
                    type="text"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Thêm chú thích cho tin của bạn..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {mode && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
            {/* Chọn Quyền riêng tư */}
            <div className="flex items-center gap-2">
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value)}
                className="text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 px-3 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="public">Công khai</option>
                <option value="friends">Bạn bè</option>
                <option value="private">Chỉ mình tôi</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || (mode === 'text' && !textContent.trim()) || (mode === 'media' && !mediaFile)}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang chia sẻ...</span>
                  </>
                ) : (
                  <span>Chia sẻ lên tin</span>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Image as ImageIcon, Type, Sparkles, AlertCircle, 
  Globe, Users, Lock, Loader2, ArrowLeft,
  RotateCw, Settings, Clock, ChevronDown, Check, Smile, Minus, Plus,
  FileText
} from 'lucide-react';
import { createStoryApi, uploadStoryMedia } from '../api/client';
import { DEFAULT_AVATAR } from '../constants/defaults';

// Danh sách phông nền chuyển sắc & đơn sắc phong cách Facebook Story
const GRADIENT_PRESETS = [
  { id: 'fb-blue', label: 'Xanh Facebook', style: { background: 'linear-gradient(135deg, #0064e0 0%, #00b4d8 100%)' } },
  { id: 'purple-pink', label: 'Tím hồng', style: { background: 'linear-gradient(135deg, #8a2387 0%, #e94057 50%, #f27121 100%)' } },
  { id: 'sunset', label: 'Cam hoàng hôn', style: { background: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)' } },
  { id: 'crimson', label: 'Đỏ tươi', style: { background: 'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)' } },
  { id: 'deep-blue', label: 'Xanh thẳm', style: { background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' } },
  { id: 'solid-dark', label: 'Đen tuyền', style: { background: '#18191a' } },
  { id: 'cosmic', label: 'Tím vũ trụ', style: { background: 'linear-gradient(135deg, #7f00ff 0%, #e100ff 100%)' } },
  { id: 'sunset-glow', label: 'Lửa hồng', style: { background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' } },
  { id: 'ruby', label: 'Đỏ ruby', style: { background: 'linear-gradient(135deg, #ed213a 0%, #93291e 100%)' } },
  { id: 'pastel', label: 'Hồng pastel', style: { background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' } },
  { id: 'mint', label: 'Xanh ngọc', style: { background: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)' } },
  { id: 'midnight', label: 'Đêm đen', style: { background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' } },
  { id: 'dark-obsidian', label: 'Đen xám', style: { background: '#111827' } },
  { id: 'cyber', label: 'Cyber Blue', style: { background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' } },
  { id: 'gold', label: 'Hoàng kim', style: { background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' } },
  { id: 'darkslate', label: 'Xám sang trọng', style: { background: 'linear-gradient(135deg, #232526 0%, #414345 100%)' } },
];

// Danh sách kiểu chữ Facebook Story
const FONT_OPTIONS = [
  { id: 'clean', label: 'Gọn gàng', font: 'system-ui, -apple-system, sans-serif' },
  { id: 'simple', label: 'Đơn giản', font: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  { id: 'serif', label: 'Cổ điển', font: 'Georgia, Cambria, "Times New Roman", serif' },
  { id: 'cursive', label: 'Mềm mại', font: '"Dancing Script", "Brush Script MT", cursive' },
  { id: 'impact', label: 'Tiêu đề', font: 'Impact, "Arial Black", sans-serif' },
];

// Quyền riêng tư tin
const PRIVACY_OPTIONS = [
  { id: 'public', label: 'Công khai', desc: 'Bất kỳ ai trên WINGS đều có thể xem tin', icon: Globe },
  { id: 'friends', label: 'Bạn bè', desc: 'Chỉ bạn bè của bạn mới có thể xem tin', icon: Users },
  { id: 'private', label: 'Chỉ mình tôi', desc: 'Chỉ một mình bạn mới có thể xem tin này', icon: Lock },
];

// Bảng màu cho văn bản chèn lên ảnh
const TEXT_COLORS = [
  '#ffffff', '#000000', '#facc15', '#f87171', '#38bdf8', '#4ade80', '#c084fc', '#fb923c'
];

/**
 * Xuất ảnh đã qua chỉnh sửa (Xoay, Phóng to, Chèn chữ, Nhãn thời gian) sang File Blob
 */
function exportEditedImage(file, { rotation = 0, zoomLevel = 1, overlayText = '', overlayFont = '', overlayColor = '#ffffff', hasTimeSticker = false, timeText = '' }) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const isRotated90 = (rotation % 180) !== 0;

        // Chuẩn khung Story dọc 9:16 (1080 x 1920)
        const canvasWidth = 1080;
        const canvasHeight = 1920;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Nền tối
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Vẽ ảnh với xoay và zoom
        ctx.save();
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(zoomLevel, zoomLevel);

        const imgW = isRotated90 ? img.naturalHeight : img.naturalWidth;
        const imgH = isRotated90 ? img.naturalWidth : img.naturalHeight;
        const scale = Math.max(canvasWidth / imgW, canvasHeight / imgH);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;

        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        // Vẽ nhãn thời gian nếu được bật
        if (hasTimeSticker && timeText) {
          ctx.save();
          ctx.font = 'bold 38px system-ui, sans-serif';
          const textMetrics = ctx.measureText(timeText);
          const boxW = textMetrics.width + 48;
          const boxH = 64;
          const boxX = canvasWidth / 2 - boxW / 2;
          const boxY = 220;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 32);
            ctx.fill();
          } else {
            ctx.fillRect(boxX, boxY, boxW, boxH);
          }

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(timeText, canvasWidth / 2, boxY + boxH / 2);
          ctx.restore();
        }

        // Vẽ chữ chèn lên ảnh nếu có
        if (overlayText && overlayText.trim()) {
          ctx.save();
          ctx.font = `bold 56px ${overlayFont || 'system-ui, sans-serif'}`;
          ctx.fillStyle = overlayColor || '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
          ctx.shadowBlur = 14;

          const lines = overlayText.split('\n');
          const lineHeight = 72;
          const startY = canvasHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
          lines.forEach((line, idx) => {
            ctx.fillText(line, canvasWidth / 2, startY + idx * lineHeight);
          });
          ctx.restore();
        }

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
        console.warn('Lỗi xuất canvas ảnh story:', err);
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
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [nudgeData, setNudgeData] = useState(null);

  // Cấu hình Tin văn bản
  const [selectedGradient, setSelectedGradient] = useState(GRADIENT_PRESETS[0]);
  const [selectedFont, setSelectedFont] = useState(FONT_OPTIONS[0]);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);

  // Cấu hình Tin hình ảnh / Video
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('image'); // 'image' | 'video'
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5 -> 2.5
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [hasTimeSticker, setHasTimeSticker] = useState(false);
  const [currentTimeText, setCurrentTimeText] = useState('');
  const [overlayText, setOverlayText] = useState('');
  const [isAddingText, setIsAddingText] = useState(false);
  const [overlayColor, setOverlayColor] = useState('#ffffff');
  const [overlayFont, setOverlayFont] = useState(FONT_OPTIONS[0]);
  const [altText, setAltText] = useState('');
  const [isAddingAltText, setIsAddingAltText] = useState(false);

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

  // Cập nhật nhãn thời gian khi mở tính năng
  useEffect(() => {
    if (hasTimeSticker && !currentTimeText) {
      const now = new Date();
      setCurrentTimeText(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [hasTimeSticker, currentTimeText]);

  if (!isOpen) return null;

  const resetState = () => {
    setMode(null);
    setTextContent('');
    setPrivacy('public');
    setShowPrivacyMenu(false);
    setIsAiGenerated(false);
    setErrorMsg('');
    setNudgeData(null);
    setSelectedGradient(GRADIENT_PRESETS[0]);
    setSelectedFont(FONT_OPTIONS[0]);
    setIsFontDropdownOpen(false);

    setMediaFile(null);
    setMediaPreview(null);
    setMediaType('image');
    setZoomLevel(1);
    setRotation(0);
    setHasTimeSticker(false);
    setCurrentTimeText('');
    setOverlayText('');
    setIsAddingText(false);
    setOverlayColor('#ffffff');
    setOverlayFont(FONT_OPTIONS[0]);
    setAltText('');
    setIsAddingAltText(false);
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
      setErrorMsg('Vui lòng chọn hình ảnh (JPG, PNG) hoặc video (MP4, MOV)');
      return;
    }

    if (isVideo && file.size > 60 * 1024 * 1024) {
      setErrorMsg('Video không được vượt quá 60MB (tối đa 60 giây)');
      return;
    }

    if (isImage && file.size > 15 * 1024 * 1024) {
      setErrorMsg('Ảnh không được vượt quá 15MB');
      return;
    }

    setErrorMsg('');
    setMediaFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
    setZoomLevel(1);
    setRotation(0);
    setMode('media');
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
        const hasVisualEdits = rotation !== 0 || zoomLevel !== 1 || overlayText.trim() || hasTimeSticker;

        // Nếu là hình ảnh và có thao tác chỉnh sửa, xuất file mới qua Canvas
        if (mediaType === 'image' && hasVisualEdits) {
          fileToUpload = await exportEditedImage(mediaFile, {
            rotation,
            zoomLevel,
            overlayText: overlayText.trim(),
            overlayFont: overlayFont.font,
            overlayColor,
            hasTimeSticker,
            timeText: currentTimeText,
          });
        }

        const uploadRes = await uploadStoryMedia(fileToUpload);
        finalMediaUrl = uploadRes.url;
      }

      const res = await createStoryApi({
        storyType: mode === 'text' ? 'text' : mediaType,
        mediaUrl: finalMediaUrl,
        textContent: mode === 'text' ? textContent.trim() : (overlayText.trim() || altText.trim() || null),
        backgroundStyle: mode === 'text' ? {
          ...selectedGradient.style,
          fontFamily: selectedFont.font,
          textAlign: 'center',
          color: '#ffffff',
          isAiGenerated,
        } : {
          zoomLevel,
          rotation,
          hasTimeSticker,
          timeText: currentTimeText,
          overlayText: overlayText.trim() || null,
          altText: altText.trim() || null,
          isAiGenerated,
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

  const userName = currentUser?.name || currentUser?.full_name || 'Bùi Minh Trọng';
  const userAvatar = currentUser?.avatar || currentUser?.avatar_url || DEFAULT_AVATAR;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) handleClose();
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* MÀN HÌNH 1: BẢNG CHỌN BAN ĐẦU (TẠO TIN VĂN BẢN HOẶC ẢNH/VIDEO) */}
      {!mode && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-up"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-blue-600" />
              <span>Tạo tin của bạn</span>
            </h2>
            <button 
              onClick={handleClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cards selection */}
          <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <button
              onClick={() => setMode('text')}
              className="group p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all flex flex-col items-center justify-center text-center gap-4 cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 group-hover:scale-105 transition">
                <Type className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Tạo tin văn bản</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Viết thông điệp trên nền màu chuyển sắc hoặc màu đơn phong phú
                </p>
              </div>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="group p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all flex flex-col items-center justify-center text-center gap-4 cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition">
                <ImageIcon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Tạo tin ảnh hoặc video</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Chia sẻ khoảnh khắc với công cụ chỉnh sửa, phóng to, xoay ảnh
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* MÀN HÌNH 2: STUDIO TẠO TIN FACEBOOK-STYLE CHO TIN VĂN BẢN HOẶC ẢNH/VIDEO */}
      {mode && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-6xl h-[92vh] max-h-[860px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row overflow-hidden animate-scale-up"
        >
          {/* CỘT TRÁI: SIDEBAR ĐIỀU KHIỂN & CÀI ĐẶT */}
          <div className="w-full lg:w-[360px] xl:w-[380px] shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 z-20">
            
            {/* Header Sidebar */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode(null)}
                  className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
                  title="Quay lại chọn định dạng"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Tin của bạn</h2>
              </div>

              {/* Nút Cài đặt quyền riêng tư (Icon Bánh răng) */}
              <div className="relative">
                <button
                  onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                  className={`p-2 rounded-full transition cursor-pointer ${
                    showPrivacyMenu 
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-600' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Quyền riêng tư của tin"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Popover Quyền riêng tư */}
                {showPrivacyMenu && (
                  <div className="absolute right-0 top-11 w-64 p-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 animate-scale-up">
                    <p className="px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Quyền riêng tư
                    </p>
                    {PRIVACY_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = privacy === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setPrivacy(opt.id);
                            setShowPrivacyMenu(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer ${
                            isSelected 
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold' 
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 text-slate-500" />
                            <div>
                              <p className="text-xs font-medium">{opt.label}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">{opt.desc}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Thông tin tác giả */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <img
                src={userAvatar}
                alt={userName}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/30"
              />
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{userName}</p>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <Globe className="w-3 h-3" />
                  <span>{PRIVACY_OPTIONS.find(p => p.id === privacy)?.label}</span>
                </div>
              </div>
            </div>

            {/* NỘI DUNG ĐIỀU KHIỂN CHÍNH CUỘN ĐƯỢC */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Thông báo lỗi nếu có */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Friendly Nudge nếu AI cảnh báo */}
              {nudgeData && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Nhắc nhở thân thiện từ NexusAI</span>
                  </div>
                  <p className="text-amber-800 dark:text-amber-300 leading-relaxed">{nudgeData.message}</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setNudgeData(null)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
                    >
                      Sửa lại
                    </button>
                    <button
                      onClick={() => handleSubmit(true)}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold cursor-pointer"
                    >
                      Vẫn đăng
                    </button>
                  </div>
                </div>
              )}

              {/* === NẾU LÀ MODE VĂN BẢN (TEXT STORY) === */}
              {mode === 'text' && (
                <>
                  {/* Ô nhập nội dung văn bản */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Nội dung tin
                    </label>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Bắt đầu nhập nội dung tin..."
                      rows={4}
                      maxLength={500}
                      className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition"
                    />
                    <div className="text-right text-[11px] text-slate-400 mt-1">
                      {textContent.length}/500
                    </div>
                  </div>

                  {/* Chọn kiểu chữ (Dropdown giống Facebook) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                      className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold hover:border-slate-300 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-500">Aa</span>
                        <span>{selectedFont.label}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </button>

                    {isFontDropdownOpen && (
                      <div className="absolute left-0 right-0 top-12 p-1.5 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-30 animate-scale-up">
                        {FONT_OPTIONS.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setSelectedFont(f);
                              setIsFontDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm transition cursor-pointer ${
                              selectedFont.id === f.id
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                            }`}
                            style={{ fontFamily: f.font }}
                          >
                            <span>Aa {f.label}</span>
                            {selectedFont.id === f.id && <Check className="w-4 h-4 text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bảng chọn Phông nền (Màu chuyển sắc) */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="mb-3">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Phông nền</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Màu chuyển sắc</p>
                    </div>

                    <div className="grid grid-cols-6 sm:grid-cols-6 gap-2.5">
                      {GRADIENT_PRESETS.map((preset) => {
                        const isSelected = selectedGradient.id === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setSelectedGradient(preset)}
                            className={`w-8 h-8 rounded-full border border-black/10 dark:border-white/10 shadow-xs transition transform hover:scale-110 cursor-pointer ${
                              isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 scale-110' : ''
                            }`}
                            style={preset.style}
                            title={preset.label}
                          />
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* === NẾU LÀ MODE MEDIA (IMAGE / VIDEO STORY) === */}
              {mode === 'media' && (
                <div className="space-y-3">
                  {/* Mục 1: Thêm văn bản lên ảnh */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsAddingText(!isAddingText)}
                      className={`w-full flex items-center justify-between p-3.5 text-left text-sm font-semibold transition cursor-pointer ${
                        isAddingText 
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-500">Aa</span>
                        <span>Thêm văn bản</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isAddingText ? 'rotate-180' : ''}`} />
                    </button>

                    {isAddingText && (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-fade-in">
                        <textarea
                          value={overlayText}
                          onChange={(e) => setOverlayText(e.target.value)}
                          placeholder="Nhập nội dung văn bản lên ảnh..."
                          rows={2}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        {/* Chọn màu chữ */}
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Màu chữ</p>
                          <div className="flex items-center gap-2">
                            {TEXT_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setOverlayColor(c)}
                                className={`w-6 h-6 rounded-full border border-black/20 shadow-xs transition transform hover:scale-110 cursor-pointer ${
                                  overlayColor === c ? 'ring-2 ring-blue-500 ring-offset-1 scale-110' : ''
                                }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Chọn font chữ cho overlay */}
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Kiểu chữ</p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {FONT_OPTIONS.slice(0, 3).map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setOverlayFont(f)}
                                className={`py-1 px-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
                                  overlayFont.id === f.id
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mục 2: Thêm thời gian (Timestamp Sticker) */}
                  <button
                    type="button"
                    onClick={() => setHasTimeSticker(!hasTimeSticker)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition cursor-pointer ${
                      hasTimeSticker 
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400' 
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-slate-500" />
                      <span className="text-sm font-semibold">Thêm thời gian</span>
                    </div>
                    {hasTimeSticker && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                        {currentTimeText || 'Bật'}
                      </span>
                    )}
                  </button>

                  {/* Mục 3: Văn bản thay thế (Alt Text / Chú thích ảnh) */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsAddingAltText(!isAddingAltText)}
                      className={`w-full flex items-center justify-between p-3.5 text-left text-sm font-semibold transition cursor-pointer ${
                        isAddingAltText 
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-500" />
                        <span>Văn bản thay thế</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isAddingAltText ? 'rotate-180' : ''}`} />
                    </button>

                    {isAddingAltText && (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 animate-fade-in">
                        <input
                          type="text"
                          value={altText}
                          onChange={(e) => setAltText(e.target.value)}
                          placeholder="Mô tả ngắn gọn nội dung hình ảnh..."
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MỤC CHUNG: THÊM NHÃN AI (AI LABELING TOGGLE) */}
              <div className="pt-2">
                <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Thêm nhãn AI</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                        Chúng tôi yêu cầu bạn gắn nhãn cho một số nội dung nhất định tạo bằng AI và cảm giác như thật.{' '}
                        <span className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">Tìm hiểu thêm</span>
                      </p>
                    </div>
                  </div>

                  {/* Switch Toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAiGenerated}
                    onClick={() => setIsAiGenerated(!isAiGenerated)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isAiGenerated ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isAiGenerated ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

            </div>

            {/* THANH THAO TÁC CỐ ĐỊNH Ở DƯỚI (NÚT BỎ & CHIA SẺ LÊN TIN) */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition cursor-pointer"
              >
                Bỏ
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || (mode === 'text' && !textContent.trim()) || (mode === 'media' && !mediaFile)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang đăng...</span>
                  </>
                ) : (
                  <span>Chia sẻ lên tin</span>
                )}
              </button>
            </div>
          </div>

          {/* CỘT PHẢI: KHUNG XEM TRƯỚC (CANVAS XEM TRƯỚC CHUẨN FACEBOOK) */}
          <div className="flex-1 flex flex-col bg-[#18191a] relative overflow-hidden">
            
            {/* Header Xem trước */}
            <div className="px-6 py-4 flex items-center justify-between text-white/90 z-20">
              <span className="text-sm font-bold tracking-wide">Xem trước</span>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vùng Canvas hiển thị điện thoại 9:16 */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden relative">
              
              {/* Thẻ Story 9:16 */}
              <div 
                className="w-[280px] sm:w-[310px] h-[490px] sm:h-[540px] rounded-2xl shadow-2xl relative flex items-center justify-center overflow-hidden transition-all duration-300 border border-white/10 select-none"
                style={mode === 'text' ? selectedGradient.style : { backgroundColor: '#000000' }}
              >
                {/* 1. HIỂN THỊ TIN VĂN BẢN */}
                {mode === 'text' && (
                  <div className="w-full h-full flex flex-col justify-between p-6">
                    <div />
                    <p 
                      className="text-white font-bold text-xl sm:text-2xl break-words max-w-full drop-shadow-md text-center leading-relaxed"
                      style={{ fontFamily: selectedFont.font }}
                    >
                      {textContent.trim() || (
                        <span className="text-white/60 font-semibold text-base sm:text-lg">
                          Bắt đầu nhập nội dung tin...
                        </span>
                      )}
                    </p>
                    {/* Icon mặt cười góc phải dưới */}
                    <div className="flex justify-end">
                      <div className="p-1.5 rounded-full bg-white/20 text-white backdrop-blur-md">
                        <Smile className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. HIỂN THỊ TIN MEDIA (ẢNH / VIDEO) */}
                {mode === 'media' && mediaPreview && (
                  <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
                    {/* Nền mờ Ambient phía sau */}
                    <div 
                      className="absolute inset-0 bg-cover bg-center blur-2xl opacity-50 scale-125 pointer-events-none"
                      style={{ backgroundImage: `url(${mediaPreview})` }}
                    />

                    {/* Đối tượng Media chính áp dụng xoay và zoom */}
                    {mediaType === 'image' ? (
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="relative z-10 w-full h-full object-contain transition-transform duration-150"
                        style={{
                          transform: `rotate(${rotation}deg) scale(${zoomLevel})`,
                        }}
                      />
                    ) : (
                      <video
                        src={mediaPreview}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="relative z-10 w-full h-full object-contain transition-transform duration-150"
                        style={{
                          transform: `rotate(${rotation}deg) scale(${zoomLevel})`,
                        }}
                      />
                    )}

                    {/* Nhãn thời gian (Timestamp Sticker) */}
                    {hasTimeSticker && currentTimeText && (
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-md text-white font-bold text-xs tracking-wider border border-white/20 shadow-lg flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{currentTimeText}</span>
                      </div>
                    )}

                    {/* Chữ chèn lên ảnh (Overlay Text) */}
                    {overlayText && overlayText.trim() && (
                      <div 
                        className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-20 text-center pointer-events-none drop-shadow-xl"
                        style={{ 
                          fontFamily: overlayFont.font, 
                          color: overlayColor 
                        }}
                      >
                        <p className="font-bold text-xl sm:text-2xl break-words leading-snug">
                          {overlayText}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* THANH ĐIỀU KHIỂN PHÓNG TO & XOAY ẢNH DƯỚI KHUNG PREVIEW (CHUẨN SCREENSHOT 2) */}
              {mode === 'media' && (
                <div className="mt-4 flex items-center gap-4 px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-white z-20 animate-fade-in">
                  {/* Cụm Zoom Slider */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(0.5, parseFloat((z - 0.1).toFixed(2))))}
                      className="p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
                      title="Thu nhỏ"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.05"
                      value={zoomLevel}
                      onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                      className="w-28 sm:w-36 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />

                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(2.5, parseFloat((z + 0.1).toFixed(2))))}
                      className="p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
                      title="Phóng to"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="w-px h-5 bg-white/20" />

                  {/* Nút Xoay ảnh 90 độ */}
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/15 hover:bg-white/25 transition text-xs font-semibold cursor-pointer"
                    title="Xoay 90 độ"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Xoay</span>
                  </button>
                </div>
              )}

            </div>

          </div>

        </div>
      )}

    </div>,
    document.body
  );
}

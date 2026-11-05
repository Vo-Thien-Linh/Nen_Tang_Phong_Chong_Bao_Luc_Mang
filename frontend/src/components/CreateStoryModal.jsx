import { useState, useRef } from 'react';
import { 
  X, Image as ImageIcon, Type, Video, Sparkles, AlertCircle, 
  Globe, Users, Lock, Loader2, ArrowLeft, CheckCircle2 
} from 'lucide-react';
import { createStoryApi, uploadStoryMedia } from '../api/client';

const GRADIENT_PRESETS = [
  { id: 'sunset', label: 'Hoàng hôn', style: { background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' } },
  { id: 'ocean', label: 'Đại dương', style: { background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' } },
  { id: 'aurora', label: 'Bắc cực quang', style: { background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' } },
  { id: 'purple', label: 'Tím mộng mơ', style: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } },
  { id: 'fire', label: 'Lửa hồng', style: { background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' } },
  { id: 'midnight', label: 'Đêm đen', style: { background: 'linear-gradient(135deg, #09203f 0%, #537895 100%)' } },
];

export default function CreateStoryModal({ currentUser, isOpen, onClose, onStoryCreated }) {
  const [mode, setMode] = useState(null); // 'text' | 'media' | null (chọn ban đầu)
  const [textContent, setTextContent] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENT_PRESETS[0]);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('image'); // 'image' | 'video'
  const [privacy, setPrivacy] = useState('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [nudgeData, setNudgeData] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const resetState = () => {
    setMode(null);
    setTextContent('');
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType('image');
    setErrorMsg('');
    setNudgeData(null);
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
        // Upload media lên Cloudinary
        const uploadRes = await uploadStoryMedia(mediaFile);
        finalMediaUrl = uploadRes.url;
      }

      const res = await createStoryApi({
        storyType: mode === 'text' ? 'text' : mediaType,
        mediaUrl: finalMediaUrl,
        textContent: textContent.trim() || null,
        backgroundStyle: mode === 'text' ? {
          background: selectedGradient.style.background,
          fontFamily,
          color: '#ffffff',
          textAlign: 'center',
        } : null,
        privacy,
        forcePost: force,
      });

      // Nếu hệ thống kích hoạt Friendly Nudge cảnh báo
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {mode && (
              <button 
                onClick={() => setMode(null)}
                className="p-1 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Quay lại chọn định dạng"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              {mode === 'text' ? 'Tạo tin văn bản' : mode === 'media' ? 'Tạo tin ảnh/video' : 'Tạo tin của bạn'}
            </h2>
          </div>
          <button 
            onClick={handleClose} 
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition"
                  >
                    Xem lại & Chỉnh sửa
                  </button>
                  <button
                    onClick={() => handleSubmit(true)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm"
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
                className="group p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition flex flex-col items-center justify-center text-center gap-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition">
                  <Type className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Tạo tin văn bản</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Viết thông điệp trên nền màu gradient phong phú
                  </p>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="group p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition flex flex-col items-center justify-center text-center gap-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Tạo tin ảnh hoặc video</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Chia sẻ khoảnh khắc với video tối đa 60 giây
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

          {/* Màn hình soạn tin văn bản */}
          {mode === 'text' && (
            <div className="space-y-6">
              {/* Vùng xem trước Tin văn bản */}
              <div 
                className="w-full h-72 rounded-2xl flex items-center justify-center p-6 text-white shadow-inner relative transition-all duration-300"
                style={selectedGradient.style}
              >
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Bắt đầu nhập nội dung tin..."
                  maxLength={500}
                  style={{ fontFamily }}
                  className="w-full bg-transparent text-center text-xl md:text-2xl font-bold placeholder-white/60 text-white resize-none outline-none border-none focus:ring-0"
                  rows={4}
                />
                <span className="absolute bottom-3 right-4 text-xs text-white/70">
                  {textContent.length}/500
                </span>
              </div>

              {/* Bộ chọn màu nền Gradient */}
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                  CHỌN MÀU NỀN
                </label>
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {GRADIENT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedGradient(preset)}
                      className={`w-10 h-10 rounded-full shrink-0 transition-transform ${
                        selectedGradient.id === preset.id ? 'ring-4 ring-blue-500 ring-offset-2 scale-110' : 'hover:scale-105'
                      }`}
                      style={preset.style}
                      title={preset.label}
                    />
                  ))}
                </div>
              </div>

              {/* Chọn kiểu chữ */}
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                  KIỂU CHỮ
                </label>
                <div className="flex gap-2">
                  {[
                    { id: 'sans-serif', label: 'Hiện đại' },
                    { id: 'serif', label: 'Cổ điển' },
                    { id: 'cursive', label: 'Mềm mại' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFontFamily(f.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium border transition ${
                        fontFamily === f.id
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Màn hình xem trước & chú thích tin Media */}
          {mode === 'media' && (
            <div className="space-y-4">
              <div className="relative w-full max-h-80 bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center">
                {mediaType === 'video' ? (
                  <video 
                    src={mediaPreview} 
                    controls 
                    className="max-h-80 w-auto rounded-lg mx-auto"
                  />
                ) : (
                  <img 
                    src={mediaPreview} 
                    alt="Preview" 
                    className="max-h-80 w-auto object-contain rounded-lg mx-auto"
                  />
                )}
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs hover:bg-black/80 transition backdrop-blur-sm"
                  >
                    Đổi tệp
                  </button>
                </div>
              </div>

              {/* Caption tuỳ chọn */}
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
                className="text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 px-3 py-1.5 focus:outline-none"
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
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Hủy
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || (mode === 'text' && !textContent.trim()) || (mode === 'media' && !mediaFile)}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-500/20"
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
    </div>
  );
}


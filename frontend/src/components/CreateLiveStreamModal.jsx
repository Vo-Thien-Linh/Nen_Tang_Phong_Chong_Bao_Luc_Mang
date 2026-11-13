import React, { useState, useRef, useEffect } from 'react';
import { Radio, Video, VideoOff, Mic, MicOff, X, Sparkles, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

function createSyntheticPreviewStream() {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  let frame = 0;
  const intervalId = setInterval(() => {
    frame += 1;
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#31102f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const radius = 56 + Math.sin(frame * 0.08) * 10;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 20, radius + 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 20, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.35)';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WINGS LIVE STUDIO', canvas.width / 2, canvas.height / 2 + 75);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px sans-serif';
    ctx.fillText(
      new Date().toLocaleTimeString('vi-VN') + ' • Sẵn sàng phát sóng trực tiếp',
      canvas.width / 2,
      canvas.height / 2 + 108
    );
  }, 33);

  const stream = canvas.captureStream(30);
  stream.getTracks().forEach((track) => {
    const origStop = track.stop.bind(track);
    track.stop = () => {
      clearInterval(intervalId);
      origStop();
    };
  });
  return stream;
}

export default function CreateLiveStreamModal({
  isOpen = false,
  onClose,
  onCreateStream
}) {
  const { t, isEn } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(isEn ? 'Casual Chat' : 'Giao lưu');
  const [previewStream, setPreviewStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isMicActive, setIsMicActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const videoPreviewRef = useRef(null);

  useEffect(() => {
    let activeStream = null;
    let isMounted = true;

    if (isOpen) {
      setTitle('');
      setDescription('');
      setCategory(isEn ? 'Casual Chat' : 'Giao lưu');
      setErrorMessage('');

      // Khởi động preview camera với tiered fallback
      const initCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 960, max: 1280 },
              height: { ideal: 540, max: 720 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: 'user'
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          if (!isMounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          activeStream = stream;
          setPreviewStream(stream);
          setIsCameraActive(true);
          setIsMicActive(true);
        } catch (e1) {
          console.warn('Lỗi lấy cả camera và mic preview, thử chỉ lấy video:', e1);
          try {
            const videoOnly = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
            if (!isMounted) {
              videoOnly.getTracks().forEach(t => t.stop());
              return;
            }
            activeStream = videoOnly;
            setPreviewStream(videoOnly);
            setIsCameraActive(true);
            setIsMicActive(false);
          } catch (e2) {
            console.warn('Sử dụng luồng phát sóng ảo dự phòng (HTTP hoặc thiết bị chưa có webcam):', e2);
            if (isMounted) {
              try {
                const synthetic = createSyntheticPreviewStream();
                activeStream = synthetic;
                setPreviewStream(synthetic);
                setIsCameraActive(true);
                setIsMicActive(false);
              } catch {
                setIsCameraActive(false);
              }
            }
          }
        }
      };

      initCamera();
    }

    return () => {
      isMounted = false;
      // Chỉ stop nếu modal bị đóng mà không submit
    };
  }, [isOpen]);

  // Đảm bảo gắn srcObject ngay khi videoPreviewRef sẵn sàng
  useEffect(() => {
    if (videoPreviewRef.current && previewStream) {
      videoPreviewRef.current.srcObject = previewStream;
      videoPreviewRef.current.play().catch(() => {});
    }
  }, [previewStream]);

  const handleModalClose = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      setErrorMessage(isEn ? 'Live stream title must have at least 3 characters.' : 'Tiêu đề buổi live phải có ít nhất 3 ký tự.');
      return;
    }
    setErrorMessage('');
    setIsLoading(true);

    try {
      // Chuyển giao luồng camera đã mở sẵn sang LiveStreamModal để không bị ngắt quãng hoặc khóa camera
      await onCreateStream({
        title: title.trim(),
        description: description.trim(),
        category
      }, previewStream);
      onClose();
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || err.message || 'Lỗi khi khởi tạo buổi live');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 relative">
        <button
          onClick={handleModalClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-rose-600/20 text-rose-500 border border-rose-500/30 flex items-center justify-center">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t('livestream.start_title')}</h3>
            <p className="text-xs text-slate-400">{t('livestream.start_subtitle')}</p>
          </div>
        </div>

        {/* Khung Preview Video */}
        <div className="relative w-full h-44 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 mb-5 flex items-center justify-center">
          {previewStream ? (
            <video
              ref={(el) => {
                videoPreviewRef.current = el;
                if (el && previewStream && el.srcObject !== previewStream) {
                  el.srcObject = previewStream;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="text-center text-slate-500 text-xs">
              <Video className="w-8 h-8 mx-auto mb-1 text-slate-600" />
              {t('livestream.camera_unconnected')}
            </div>
          )}
          <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-[11px] text-emerald-400 border border-white/10 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t('livestream.cyberbullying_active')}
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {t('livestream.stream_title')} <span className="text-rose-400">*</span>
            </label>
            <input
              id="input-livestream-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('livestream.stream_title_placeholder')}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">{t('livestream.category')}</label>
              <select
                id="select-livestream-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Giao lưu">{t('livestream.category_chat')}</option>
                <option value="Học tập">{t('livestream.category_study')}</option>
                <option value="Tâm sự an toàn">{t('livestream.category_safe_talk')}</option>
                <option value="Giải trí lành mạnh">{t('livestream.category_entertainment')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">{t('livestream.description')}</label>
              <input
                id="input-livestream-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('livestream.description_placeholder')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              id="btn-cancel-create-livestream"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
            >
              {isEn ? 'Cancel' : 'Hủy'}
            </button>
            <button
              id="btn-submit-create-livestream"
              type="submit"
              disabled={isLoading || !title.trim()}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white flex items-center gap-2 transition shadow-lg shadow-rose-600/30 cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              {isLoading ? t('livestream.starting') : t('livestream.start_btn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

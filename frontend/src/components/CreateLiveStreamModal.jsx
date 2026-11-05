import React, { useState, useRef, useEffect } from 'react';
import { Radio, Video, VideoOff, Mic, MicOff, X, Sparkles, ShieldCheck } from 'lucide-react';

export default function CreateLiveStreamModal({
  isOpen = false,
  onClose,
  onCreateStream
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Giao lưu');
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
      setCategory('Giao lưu');
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
            console.error('Không thể truy cập camera thực tế:', e2);
            if (isMounted) {
              setIsCameraActive(false);
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
      setErrorMessage('Tiêu đề buổi live phải có ít nhất 3 ký tự.');
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
            <h3 className="text-lg font-bold text-white">Khởi tạo buổi phát trực tiếp</h3>
            <p className="text-xs text-slate-400">Kết nối và giao lưu an toàn với cộng đồng</p>
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
              Camera chưa kết nối hoặc chưa được cấp quyền
            </div>
          )}
          <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-[11px] text-emerald-400 border border-white/10 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Bảo vệ chống bạo lực mạng kích hoạt
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
              Tiêu đề phát trực tiếp <span className="text-rose-400">*</span>
            </label>
            <input
              id="input-livestream-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Cùng tâm sự và chia sẻ kiến thức tích cực..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Chủ đề</label>
              <select
                id="select-livestream-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Giao lưu">Giao lưu / Trò chuyện</option>
                <option value="Học tập">Học tập & Chia sẻ</option>
                <option value="Tâm sự an toàn">Tâm sự an toàn</option>
                <option value="Giải trí lành mạnh">Giải trí lành mạnh</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mô tả (tùy chọn)</label>
              <input
                id="input-livestream-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn gọn..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              id="btn-cancel-create-livestream"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Hủy
            </button>
            <button
              id="btn-submit-create-livestream"
              type="submit"
              disabled={isLoading || !title.trim()}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white flex items-center gap-2 transition shadow-lg shadow-rose-600/30 cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              {isLoading ? 'Đang tạo...' : 'Bắt đầu phát trực tiếp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

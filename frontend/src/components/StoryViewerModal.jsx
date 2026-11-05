import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ChevronLeft, ChevronRight, Eye, Trash2, Heart, 
  ThumbsUp, Smile, AlertCircle, Play, Pause, Volume2, VolumeX, ShieldAlert,
  Send, Loader2
} from 'lucide-react';
import { viewStoryApi, reactToStoryApi, deleteStoryApi, fetchStoryViewersApi } from '../api/client';
import { messageService } from '../services/messageService';
import { DEFAULT_AVATAR } from '../constants/defaults';

const REACTION_ICONS = [
  { type: 'like', label: 'Thích', emoji: '👍' },
  { type: 'love', label: 'Yêu thích', emoji: '❤️' },
  { type: 'haha', label: 'Haha', emoji: '😆' },
  { type: 'wow', label: 'Wow', emoji: '😮' },
  { type: 'sad', label: 'Buồn', emoji: '😢' },
  { type: 'angry', label: 'Phẫn nộ', emoji: '😡' },
];

export default function StoryViewerModal({ 
  currentUser, 
  tray, 
  isOpen, 
  onClose, 
  onStoryDeleted,
  onNextTray,
  onPrevTray,
  initialStoryId,
  initialShowViewers = false,
  targetViewerId = null,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewersList, setViewersList] = useState([]);
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);
  const [myReaction, setMyReaction] = useState(null);

  // Hiệu ứng hạt Reaction bay lượn mượt mà (Facebook style)
  const [floatingParticles, setFloatingParticles] = useState([]);

  // Trạng thái trả lời tin bằng tin nhắn (Reply Story)
  const [replyMessage, setReplyMessage] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySuccessMsg, setReplySuccessMsg] = useState('');
  const [replyErrorMsg, setReplyErrorMsg] = useState('');

  const videoRef = useRef(null);
  const progressTimerRef = useRef(null);

  const stories = tray?.stories || [];
  const currentStory = stories[currentIndex];
  const isAuthor = Boolean(currentUser?.id && String(tray?.author?.id) === String(currentUser?.id));

  // Reset khi mở tray mới hoặc điều hướng từ thông báo mục tiêu
  useEffect(() => {
    if (isOpen && stories.length > 0) {
      let startIndex = 0;
      if (initialStoryId) {
        const foundIdx = stories.findIndex((s) => String(s.id) === String(initialStoryId));
        if (foundIdx >= 0) startIndex = foundIdx;
      } else {
        const firstUnviewedIndex = stories.findIndex((s) => !s.isViewed);
        if (firstUnviewedIndex >= 0) startIndex = firstUnviewedIndex;
      }

      setCurrentIndex(startIndex);
      setProgress(0);
      setReplyMessage('');
      setReplySuccessMsg('');
      setReplyErrorMsg('');

      // Tự động mở danh sách người xem tin nếu đến từ thông báo cảm xúc/lượt xem
      if (initialShowViewers && isAuthor) {
        setShowViewers(true);
        setIsPaused(true);
        setIsLoadingViewers(true);
        const targetStory = stories[startIndex];
        if (targetStory?.id) {
          fetchStoryViewersApi(targetStory.id)
            .then((res) => {
              if (res?.success) setViewersList(res.data || []);
            })
            .catch((err) => console.warn('Lỗi lấy viewers từ thông báo:', err.message))
            .finally(() => setIsLoadingViewers(false));
        }
      } else {
        setShowViewers(false);
      }
    }
  }, [isOpen, tray, initialStoryId, initialShowViewers, currentUser?.id]);

  // Khóa cuộn trang nền và hỗ trợ phím Escape / Mũi tên trái phải
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        // Không trigger phím chuyển tin nếu người dùng đang nhập tin nhắn
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          if (e.key === 'Escape') {
            document.activeElement.blur();
          }
          return;
        }

        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'ArrowRight') {
          handleNextStory();
        } else if (e.key === 'ArrowLeft') {
          handlePrevStory();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow || 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, currentIndex, stories.length]);

  // Ghi nhận lượt xem tin và thiết lập myReaction
  useEffect(() => {
    if (!currentStory) return;

    setMyReaction(currentStory.myReaction || null);
    setReplySuccessMsg('');
    setReplyErrorMsg('');

    if (currentUser?.id && !isAuthor) {
      viewStoryApi(currentStory.id).catch((err) => console.warn('Lỗi viewStory:', err.message));
    }
  }, [currentStory?.id]);

  // Bộ đếm tiến trình (Progress bar 5s cho static / theo video duration)
  useEffect(() => {
    if (!isOpen || isPaused || showViewers || !currentStory) return;

    const duration = currentStory.storyType === 'video' ? 15000 : 5000;
    const interval = 50; // cập nhật mỗi 50ms
    const step = (interval / duration) * 100;

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNextStory();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(progressTimerRef.current);
  }, [isOpen, currentIndex, isPaused, showViewers, currentStory?.id]);

  if (!isOpen || !currentStory) return null;

  const handleNextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else if (onNextTray) {
      onNextTray();
    } else {
      onClose();
    }
  };

  const handlePrevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    } else if (onPrevTray) {
      onPrevTray();
    }
  };

  // Kích hoạt hiệu ứng hạt Reaction bay bổng đa hướng (Facebook Floating Hearts)
  const handleReact = async (reactionType) => {
    setMyReaction(reactionType);

    const emoji = REACTION_ICONS.find((r) => r.type === reactionType)?.emoji || '❤️';
    const newParticles = Array.from({ length: 8 }).map((_, i) => ({
      id: `${Date.now()}-${i}-${Math.random()}`,
      emoji,
      left: 20 + Math.random() * 60, // Phân bổ ngang ngẫu nhiên 20% - 80%
      scale: 0.85 + Math.random() * 0.7, // Kích thước biến thiên
      delay: i * 65, // Hiệu ứng trễ từng đợt
      duration: 1300 + Math.random() * 400, // 1.3s - 1.7s
      rotate: -25 + Math.random() * 50, // Góc xoay nhẹ
      driftX: -45 + Math.random() * 90, // Lượn sóng nhẹ theo chiều ngang
    }));

    setFloatingParticles((prev) => [...prev, ...newParticles]);

    // Tự động dọn dẹp hạt sau khi bay xong
    setTimeout(() => {
      setFloatingParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 2400);

    try {
      await reactToStoryApi(currentStory.id, reactionType);
    } catch (err) {
      console.warn('Lỗi thả reaction:', err.message);
    }
  };

  // Xử lý gửi tin nhắn trả lời tin (Reply to Story)
  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    if (!replyMessage.trim() || isSendingReply) return;

    if (!currentUser?.id) {
      setReplyErrorMsg('Vui lòng đăng nhập để trả lời tin');
      setTimeout(() => setReplyErrorMsg(''), 3000);
      return;
    }

    setIsSendingReply(true);
    setReplyErrorMsg('');

    try {
      const authorId = tray.author?.id;
      if (!authorId) throw new Error('Không tìm thấy thông tin tác giả tin');

      // Định dạng nội dung tin nhắn có ngữ cảnh trích dẫn tin
      let formattedContent = '';
      if (currentStory.storyType === 'text') {
        formattedContent = `[Trả lời tin: "${currentStory.textContent?.slice(0, 60) || 'Tin'}"]\n${replyMessage.trim()}`;
      } else {
        formattedContent = `[Trả lời tin]\n${replyMessage.trim()}`;
      }

      await messageService.sendMessage(
        authorId,
        formattedContent,
        currentStory.mediaUrl || null,
        currentStory.storyType === 'video' ? 'video' : (currentStory.storyType === 'image' ? 'image' : 'text')
      );

      setReplyMessage('');
      setReplySuccessMsg(`Đã gửi tin nhắn đến ${tray.author?.name || 'tác giả'}`);
      setTimeout(() => setReplySuccessMsg(''), 3000);
    } catch (err) {
      setReplyErrorMsg(err.message || 'Không thể gửi tin nhắn trả lời');
      setTimeout(() => setReplyErrorMsg(''), 3000);
    } finally {
      setIsSendingReply(false);
      setIsPaused(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tin này không?')) return;
    try {
      await deleteStoryApi(currentStory.id);
      if (onStoryDeleted) onStoryDeleted(currentStory.id);
      if (stories.length <= 1) {
        onClose();
      } else {
        handleNextStory();
      }
    } catch (err) {
      alert('Lỗi khi xóa tin: ' + err.message);
    }
  };

  const handleOpenViewers = async () => {
    setIsPaused(true);
    setShowViewers(true);
    setIsLoadingViewers(true);
    try {
      const res = await fetchStoryViewersApi(currentStory.id);
      if (res?.success) setViewersList(res.data || []);
    } catch (err) {
      console.warn('Lỗi lấy viewers:', err.message);
    } finally {
      setIsLoadingViewers(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 select-none animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Định nghĩa CSS Keyframes cho hiệu ứng hạt Reaction bay bổng */}
      <style>{`
        @keyframes storyParticleFloat {
          0% {
            transform: translate3d(0, 0, 0) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translate3d(calc(var(--drift-x) * 0.25), -60px, 0) scale(1.15);
          }
          75% {
            opacity: 0.95;
          }
          100% {
            transform: translate3d(var(--drift-x), -400px, 0) scale(1.45);
            opacity: 0;
          }
        }
      `}</style>

      {/* Nút Đóng */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition cursor-pointer"
        aria-label="Đóng tin"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Nút Điều hướng Trái / Phải */}
      <button 
        onClick={handlePrevStory}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-white/10 hover:bg-white/30 text-white backdrop-blur-md transition hidden sm:flex cursor-pointer"
        aria-label="Tin trước"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button 
        onClick={handleNextStory}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-white/10 hover:bg-white/30 text-white backdrop-blur-md transition hidden sm:flex cursor-pointer"
        aria-label="Tin kế tiếp"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Khung nội dung Tin (Tỉ lệ 9:16 dọc chuẩn Story) */}
      <div 
        className="relative w-full max-w-[420px] h-[85vh] sm:h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
        onMouseDown={() => !replyMessage && setIsPaused(true)}
        onMouseUp={() => !replyMessage && setIsPaused(false)}
        onTouchStart={() => !replyMessage && setIsPaused(true)}
        onTouchEnd={() => !replyMessage && setIsPaused(false)}
      >
        {/* 1. Các vạch tiến trình (Progress Bars) trên đầu */}
        <div className="absolute top-3 inset-x-3 z-30 flex gap-1.5">
          {stories.map((s, idx) => {
            let width = '0%';
            if (idx < currentIndex) width = '100%';
            else if (idx === currentIndex) width = `${progress}%`;

            return (
              <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
                <div 
                  className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                  style={{ width }}
                />
              </div>
            );
          })}
        </div>

        {/* 2. Header thông tin tác giả */}
        <div className="absolute top-6 inset-x-4 z-30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={tray.author?.avatar || DEFAULT_AVATAR} 
              alt={tray.author?.name}
              className="w-10 h-10 rounded-full border-2 border-white object-cover"
            />
            <div>
              <h4 className="text-white font-bold text-sm leading-tight flex items-center gap-1.5">
                <span>{tray.author?.name}</span>
                {tray.author?.isVerified && (
                  <span className="text-blue-400 text-xs">✓</span>
                )}
                {currentStory.backgroundStyle?.isAiGenerated && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/80 backdrop-blur-md text-white border border-blue-400/40">
                    Nhãn AI
                  </span>
                )}
              </h4>
              <p className="text-white/70 text-xs">
                {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthor && (
              <button 
                onClick={handleDelete}
                className="p-2 rounded-full bg-black/40 hover:bg-rose-600/80 text-white backdrop-blur-sm transition cursor-pointer"
                title="Xóa tin"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 3. Vùng hiển thị Nội dung Media hoặc Text */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {/* Tin văn bản */}
          {currentStory.storyType === 'text' && (
            <div 
              className="w-full h-full relative"
              style={currentStory.backgroundStyle || { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              <div 
                className="absolute p-6 text-center max-w-[90%]"
                style={{
                  left: `${currentStory.backgroundStyle?.textPos?.x ?? 50}%`,
                  top: `${currentStory.backgroundStyle?.textPos?.y ?? 50}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <p 
                  className="text-white font-bold text-2xl md:text-3xl break-words max-w-full drop-shadow-md leading-relaxed"
                  style={{ 
                    fontFamily: currentStory.backgroundStyle?.fontFamily || 'sans-serif',
                    textAlign: currentStory.backgroundStyle?.textAlign || 'center',
                  }}
                >
                  {currentStory.textContent}
                </p>
              </div>
            </div>
          )}

          {/* Tin Hình ảnh */}
          {currentStory.storyType === 'image' && (
            <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
              {/* Lớp nền mờ Ambient nhân bản từ ảnh để không bị khoảng trống đen */}
              <div 
                className="absolute inset-0 bg-cover bg-center blur-2xl opacity-60 scale-125 pointer-events-none transition-all duration-300"
                style={{ backgroundImage: `url(${currentStory.mediaUrl})` }}
              />

              <img 
                src={currentStory.mediaUrl} 
                alt="Story"
                className={`relative z-10 w-full h-full transition-all duration-200 ${
                  currentStory.backgroundStyle?.fitMode === 'cover' ? 'object-cover' : 'object-contain'
                } ${currentStory.isSensitive ? 'blur-xl' : ''}`}
                style={currentStory.backgroundStyle?.filter && currentStory.backgroundStyle.filter !== 'none' ? { filter: currentStory.backgroundStyle.filter } : undefined}
              />
              {currentStory.isSensitive && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-black/50 backdrop-blur-md text-white">
                  <ShieldAlert className="w-12 h-12 text-amber-400 mb-2" />
                  <p className="font-semibold text-sm">Nội dung có thể nhạy cảm</p>
                  <p className="text-xs text-white/70 mt-1">Tin này đã được AI gắn nhãn cảnh báo phù hợp tiêu chuẩn cộng đồng.</p>
                </div>
              )}
              {/* Nhãn thời gian cho video */}
              {currentStory.backgroundStyle?.hasTimeSticker && currentStory.backgroundStyle?.timeText && (
                <div 
                  className="absolute z-20 px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-white font-bold text-xs tracking-wider border border-white/20 shadow-lg flex items-center gap-1.5 pointer-events-none"
                  style={{
                    left: `${currentStory.backgroundStyle?.timePos?.x ?? 50}%`,
                    top: `${currentStory.backgroundStyle?.timePos?.y ?? 16}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <Clock className="w-3.5 h-3.5 text-blue-300" />
                  <span>{currentStory.backgroundStyle.timeText}</span>
                </div>
              )}

              {/* Văn bản overlay cho video */}
              {currentStory.backgroundStyle?.overlayText && (
                <div 
                  className="absolute z-20 text-center pointer-events-none drop-shadow-xl max-w-[88%]"
                  style={{
                    left: `${currentStory.backgroundStyle?.textPos?.x ?? 50}%`,
                    top: `${currentStory.backgroundStyle?.textPos?.y ?? 50}%`,
                    transform: 'translate(-50%, -50%)',
                    fontFamily: currentStory.backgroundStyle?.overlayFont || 'sans-serif',
                    color: currentStory.backgroundStyle?.overlayColor || '#ffffff',
                  }}
                >
                  <p className="font-bold text-xl sm:text-2xl break-words leading-snug drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                    {currentStory.backgroundStyle.overlayText}
                  </p>
                </div>
              )}

              {currentStory.textContent && !currentStory.backgroundStyle?.overlayText && (
                <div className="absolute bottom-24 inset-x-4 z-20 p-3 rounded-xl bg-black/60 backdrop-blur-md text-white text-center text-sm shadow-lg">
                  {currentStory.textContent}
                </div>
              )}
            </div>
          )}

          {/* Tin Video */}
          {currentStory.storyType === 'video' && (
            <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
              {/* Lớp nền mờ Ambient cho video khi ở chế độ vừa vặn */}
              {currentStory.backgroundStyle?.fitMode === 'contain' && (
                <div 
                  className="absolute inset-0 bg-cover bg-center blur-2xl opacity-50 scale-125 pointer-events-none"
                  style={{ backgroundImage: `url(${currentStory.mediaUrl})` }}
                />
              )}
              <video 
                ref={videoRef}
                src={currentStory.mediaUrl}
                autoPlay
                playsInline
                loop
                muted={currentStory.backgroundStyle?.isMuted || false}
                className={`relative z-10 w-full h-full transition-all duration-200 ${
                  currentStory.backgroundStyle?.fitMode === 'cover' ? 'object-cover' : 'object-contain'
                }`}
                style={currentStory.backgroundStyle?.filter && currentStory.backgroundStyle.filter !== 'none' ? { filter: currentStory.backgroundStyle.filter } : undefined}
              />
              {/* Nhãn thời gian cho video */}
              {currentStory.backgroundStyle?.hasTimeSticker && currentStory.backgroundStyle?.timeText && (
                <div 
                  className="absolute z-20 px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-white font-bold text-xs tracking-wider border border-white/20 shadow-lg flex items-center gap-1.5 pointer-events-none"
                  style={{
                    left: `${currentStory.backgroundStyle?.timePos?.x ?? 50}%`,
                    top: `${currentStory.backgroundStyle?.timePos?.y ?? 16}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <Clock className="w-3.5 h-3.5 text-blue-300" />
                  <span>{currentStory.backgroundStyle.timeText}</span>
                </div>
              )}

              {/* Văn bản overlay cho video */}
              {currentStory.backgroundStyle?.overlayText && (
                <div 
                  className="absolute z-20 text-center pointer-events-none drop-shadow-xl max-w-[88%]"
                  style={{
                    left: `${currentStory.backgroundStyle?.textPos?.x ?? 50}%`,
                    top: `${currentStory.backgroundStyle?.textPos?.y ?? 50}%`,
                    transform: 'translate(-50%, -50%)',
                    fontFamily: currentStory.backgroundStyle?.overlayFont || 'sans-serif',
                    color: currentStory.backgroundStyle?.overlayColor || '#ffffff',
                  }}
                >
                  <p className="font-bold text-xl sm:text-2xl break-words leading-snug drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                    {currentStory.backgroundStyle.overlayText}
                  </p>
                </div>
              )}

              {currentStory.textContent && !currentStory.backgroundStyle?.overlayText && (
                <div className="absolute bottom-24 inset-x-4 z-20 p-3 rounded-xl bg-black/60 backdrop-blur-md text-white text-center text-sm shadow-lg">
                  {currentStory.textContent}
                </div>
              )}
            </div>
          )}

          {/* Lớp hạt Reaction bay bổng đa chiều (Floating Particles 60fps) */}
          <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            {floatingParticles.map((p) => (
              <div
                key={p.id}
                className="absolute bottom-20 select-none will-change-transform"
                style={{
                  left: `${p.left}%`,
                  fontSize: `${28 * p.scale}px`,
                  '--drift-x': `${p.driftX}px`,
                  animation: `storyParticleFloat ${p.duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${p.delay}ms forwards`,
                }}
              >
                <span className="drop-shadow-xl inline-block" style={{ transform: `rotate(${p.rotate}deg)` }}>
                  {p.emoji}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Footer tương tác: Xem lượt xem hoặc Trả lời tin & Thả reaction */}
        <div className="absolute bottom-4 inset-x-4 z-30 space-y-2">
          {/* Thông báo gửi tin nhắn phản hồi thành công hoặc lỗi */}
          {replySuccessMsg && (
            <div className="py-1.5 px-3 rounded-xl bg-emerald-500/95 text-white text-xs font-semibold backdrop-blur-md text-center shadow-lg animate-fade-in">
              ✓ {replySuccessMsg}
            </div>
          )}
          {replyErrorMsg && (
            <div className="py-1.5 px-3 rounded-xl bg-rose-500/95 text-white text-xs font-semibold backdrop-blur-md text-center shadow-lg animate-fade-in">
              {replyErrorMsg}
            </div>
          )}

          {isAuthor ? (
            /* Dành cho Tác giả: Nút xem số lượng người đã xem */
            <button 
              onClick={handleOpenViewers}
              className="w-full py-2.5 px-4 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-between text-xs font-semibold transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span>{currentStory.viewsCount || 0} người đã xem</span>
              </span>
              <span className="text-white/70">Xem chi tiết &gt;</span>
            </button>
          ) : (
            /* Dành cho Người xem: Thanh thả Reaction & Ô gửi tin nhắn trả lời Story */
            <div className="space-y-2">
              {/* Dãy 6 biểu tượng cảm xúc nhanh */}
              <div className="flex items-center justify-between px-3 py-1.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10">
                {REACTION_ICONS.map((r) => (
                  <button
                    key={r.type}
                    onClick={() => handleReact(r.type)}
                    className={`text-2xl hover:scale-130 active:scale-95 transition-transform cursor-pointer p-1 ${
                      myReaction === r.type ? 'scale-125 filter drop-shadow-md' : 'opacity-85 hover:opacity-100'
                    }`}
                    title={r.label}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>

              {/* Ô nhập tin nhắn trả lời (Reply to Story) */}
              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <input 
                  type="text"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => !replyMessage.trim() && setIsPaused(false)}
                  placeholder={`Gửi tin nhắn cho ${tray.author?.name || 'tác giả'}...`}
                  className="flex-1 px-4 py-2.5 rounded-full bg-white/20 hover:bg-white/25 focus:bg-white/35 backdrop-blur-md text-white placeholder-white/70 text-xs border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 transition"
                />
                <button
                  type="submit"
                  disabled={!replyMessage.trim() || isSendingReply}
                  className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition shadow-md flex items-center justify-center shrink-0 cursor-pointer"
                  title="Gửi tin nhắn trả lời tin"
                >
                  {isSendingReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Modal Xem danh sách người đã xem (Chỉ tác giả) */}
        {showViewers && (
          <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col p-6 text-white animate-slide-up">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                <span>Người xem tin ({viewersList.length})</span>
              </h3>
              <button 
                onClick={() => { setShowViewers(false); setIsPaused(false); }}
                className="p-1 rounded-full hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {isLoadingViewers ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              ) : viewersList.length === 0 ? (
                <p className="text-center text-white/50 text-sm py-8">Chưa có ai xem tin này</p>
              ) : (
                viewersList.map((v) => {
                  const isTarget = targetViewerId && (
                    String(v.viewer_id) === String(targetViewerId) || 
                    String(v.user_id) === String(targetViewerId)
                  );

                  return (
                    <div 
                      key={v.view_id} 
                      ref={(el) => {
                        if (isTarget && el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-2xl transition duration-300 ${
                        isTarget 
                          ? 'bg-blue-600/35 ring-2 ring-blue-400 shadow-lg shadow-blue-500/25 border border-blue-400/50' 
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img 
                            src={v.avatar_url || DEFAULT_AVATAR} 
                            alt={v.full_name} 
                            className={`w-10 h-10 rounded-full object-cover ring-2 ${isTarget ? 'ring-blue-400 ring-offset-2 ring-offset-slate-900' : 'ring-white/20'}`}
                          />
                          {isTarget && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full ring-2 ring-slate-900 animate-ping" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight flex items-center gap-1.5">
                            <span>{v.full_name}</span>
                            {isTarget && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/50 text-blue-200 border border-blue-400/50">
                                Đã tương tác
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-white/50 mt-0.5">
                            {new Date(v.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      {v.reaction_type && (
                        <div className="flex items-center gap-1">
                          <span className={`text-2xl transition drop-shadow-md ${isTarget ? 'scale-125 animate-pulse' : 'hover:scale-125'}`}>
                            {REACTION_ICONS.find(r => r.type === v.reaction_type)?.emoji}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}

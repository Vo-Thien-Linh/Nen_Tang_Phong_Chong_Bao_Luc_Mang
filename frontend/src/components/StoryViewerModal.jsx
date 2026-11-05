import { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Eye, Trash2, Heart, 
  ThumbsUp, Smile, AlertCircle, Play, Pause, Volume2, VolumeX, ShieldAlert 
} from 'lucide-react';
import { viewStoryApi, reactToStoryApi, deleteStoryApi, fetchStoryViewersApi } from '../api/client';
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
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewersList, setViewersList] = useState([]);
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);
  const [myReaction, setMyReaction] = useState(null);
  const [reactionAnim, setReactionAnim] = useState(null);

  const videoRef = useRef(null);
  const progressTimerRef = useRef(null);

  const stories = tray?.stories || [];
  const currentStory = stories[currentIndex];
  const isAuthor = currentUser?.id && tray?.author?.id === currentUser?.id;

  // Reset khi mở tray mới
  useEffect(() => {
    if (isOpen && stories.length > 0) {
      // Tìm tin đầu tiên chưa xem
      const firstUnviewedIndex = stories.findIndex((s) => !s.isViewed);
      setCurrentIndex(firstUnviewedIndex >= 0 ? firstUnviewedIndex : 0);
      setProgress(0);
      setShowViewers(false);
    }
  }, [isOpen, tray]);

  // Ghi nhận lượt xem tin và thiết lập myReaction
  useEffect(() => {
    if (!currentStory) return;

    setMyReaction(currentStory.myReaction || null);

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

  const handleReact = async (reactionType) => {
    setMyReaction(reactionType);
    setReactionAnim(reactionType);
    setTimeout(() => setReactionAnim(null), 1000);

    try {
      await reactToStoryApi(currentStory.id, reactionType);
    } catch (err) {
      console.warn('Lỗi thả reaction:', err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa tin này không?')) return;
    try {
      await deleteStoryApi(currentStory.id);
      if (onStoryDeleted) onStoryDeleted(currentStory.id);
      if (stories.length > 1) {
        handleNextStory();
      } else {
        onClose();
      }
    } catch (err) {
      alert(err.message || 'Không thể xóa tin');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none animate-fade-in">
      {/* Nút Đóng */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Nút Điều hướng Trái / Phải */}
      <button 
        onClick={handlePrevStory}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-white/10 hover:bg-white/30 text-white backdrop-blur-md transition hidden sm:flex"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button 
        onClick={handleNextStory}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-white/10 hover:bg-white/30 text-white backdrop-blur-md transition hidden sm:flex"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Khung nội dung Tin (Tỉ lệ 9:16 dọc chuẩn Story) */}
      <div 
        className="relative w-full max-w-[420px] h-[85vh] sm:h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
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
              <h4 className="text-white font-bold text-sm leading-tight flex items-center gap-1">
                {tray.author?.name}
                {tray.author?.isVerified && (
                  <span className="text-blue-400 text-xs">✓</span>
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
                className="p-2 rounded-full bg-black/40 hover:bg-rose-600/80 text-white backdrop-blur-sm transition"
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
              className="w-full h-full flex items-center justify-center p-8 text-center"
              style={currentStory.backgroundStyle || { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              <p 
                className="text-white font-bold text-2xl md:text-3xl break-words max-w-full drop-shadow-md"
                style={{ fontFamily: currentStory.backgroundStyle?.fontFamily || 'sans-serif' }}
              >
                {currentStory.textContent}
              </p>
            </div>
          )}

          {/* Tin Hình ảnh */}
          {currentStory.storyType === 'image' && (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img 
                src={currentStory.mediaUrl} 
                alt="Story"
                className={`w-full h-full object-cover ${currentStory.isSensitive ? 'blur-xl' : ''}`}
              />
              {currentStory.isSensitive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/50 backdrop-blur-md text-white">
                  <ShieldAlert className="w-12 h-12 text-amber-400 mb-2" />
                  <p className="font-semibold text-sm">Nội dung có thể nhạy cảm</p>
                  <p className="text-xs text-white/70 mt-1">Tin này đã được AI gắn nhãn cảnh báo phù hợp tiêu chuẩn cộng đồng.</p>
                </div>
              )}
              {currentStory.textContent && (
                <div className="absolute bottom-20 inset-x-4 p-3 rounded-xl bg-black/60 backdrop-blur-md text-white text-center text-sm">
                  {currentStory.textContent}
                </div>
              )}
            </div>
          )}

          {/* Tin Video */}
          {currentStory.storyType === 'video' && (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video 
                ref={videoRef}
                src={currentStory.mediaUrl}
                autoPlay
                playsInline
                loop
                className="w-full h-full object-cover"
              />
              {currentStory.textContent && (
                <div className="absolute bottom-20 inset-x-4 p-3 rounded-xl bg-black/60 backdrop-blur-md text-white text-center text-sm">
                  {currentStory.textContent}
                </div>
              )}
            </div>
          )}

          {/* Hiệu ứng Reaction bay lên */}
          {reactionAnim && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 animate-bounce">
              <span className="text-7xl drop-shadow-2xl">
                {REACTION_ICONS.find(r => r.type === reactionAnim)?.emoji || '❤️'}
              </span>
            </div>
          )}
        </div>

        {/* 4. Footer tương tác */}
        <div className="absolute bottom-4 inset-x-4 z-30">
          {isAuthor ? (
            /* Dành cho Tác giả: Nút xem số lượng người đã xem */
            <button 
              onClick={handleOpenViewers}
              className="w-full py-2.5 px-4 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-between text-xs font-semibold transition"
            >
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span>{currentStory.viewsCount || 0} người đã xem</span>
              </span>
              <span className="text-white/70">Xem chi tiết &gt;</span>
            </button>
          ) : (
            /* Dành cho Người xem: Thanh thả Reaction nhanh */
            <div className="flex items-center justify-between p-2 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10">
              <div className="flex items-center justify-around w-full">
                {REACTION_ICONS.map((r) => (
                  <button
                    key={r.type}
                    onClick={() => handleReact(r.type)}
                    className={`text-2xl hover:scale-125 transition-transform ${
                      myReaction === r.type ? 'scale-125 filter drop-shadow' : 'opacity-80 hover:opacity-100'
                    }`}
                    title={r.label}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
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
                className="p-1 rounded-full hover:bg-white/10"
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
                viewersList.map((v) => (
                  <div key={v.view_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={v.avatar_url || DEFAULT_AVATAR} 
                        alt={v.full_name} 
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-semibold text-sm leading-tight">{v.full_name}</p>
                        <p className="text-xs text-white/50">
                          {new Date(v.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    {v.reaction_type && (
                      <span className="text-xl">
                        {REACTION_ICONS.find(r => r.type === v.reaction_type)?.emoji}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

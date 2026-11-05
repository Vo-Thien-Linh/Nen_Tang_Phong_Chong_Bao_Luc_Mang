import { useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';

export default function StoryBar({
  currentUser,
  storyTrays = [],
  onOpenCreateStory,
  onOpenStoryViewer,
  onRequireAuth,
}) {
  const scrollContainerRef = useRef(null);

  const handleScroll = (direction) => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = direction === 'left' ? -280 : 280;
    scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const handleCreateClick = () => {
    if (!currentUser?.id && onRequireAuth) {
      onRequireAuth('Vui lòng đăng nhập để tạo tin của bạn');
      return;
    }
    onOpenCreateStory();
  };

  return (
    <div className="relative w-full mb-4 group">
      {/* Nút Cuộn Trái */}
      <button
        onClick={() => handleScroll('left')}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-110 opacity-0 group-hover:opacity-100 transition duration-200"
        aria-label="Cuộn trái"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Danh sách các Thẻ Tin nằm ngang */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none scroll-smooth px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* THẺ 1: TẠO TIN (Chuẩn Facebook) */}
        <div
          onClick={handleCreateClick}
          className="relative w-28 sm:w-32 h-48 sm:h-52 rounded-2xl overflow-hidden shadow-sm hover:shadow-md cursor-pointer shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-between group/card transition transform hover:-translate-y-0.5"
        >
          {/* Nửa trên: Ảnh đại diện người dùng */}
          <div className="relative w-full h-[72%] overflow-hidden bg-slate-200 dark:bg-slate-700">
            <img
              src={currentUser?.avatar || DEFAULT_AVATAR}
              alt="Avatar"
              className="w-full h-full object-cover group-hover/card:scale-105 transition duration-300"
            />
          </div>

          {/* Nút Cộng và Chữ "Tạo tin" ở nửa dưới */}
          <div className="relative h-[28%] flex flex-col items-center justify-end pb-2 bg-white dark:bg-slate-800">
            <div className="absolute -top-4 w-8 h-8 rounded-full bg-blue-600 border-4 border-white dark:border-slate-800 text-white flex items-center justify-center shadow-md">
              <Plus className="w-4 h-4 stroke-[3]" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white mt-2">
              Tạo tin
            </span>
          </div>
        </div>

        {/* CÁC THẺ TIN CỦA BẠN BÈ VÀ BẢN THÂN */}
        {storyTrays.map((tray) => {
          const firstStory = tray.stories?.[0];
          if (!firstStory) return null;

          return (
            <div
              key={tray.author?.id}
              onClick={() => onOpenStoryViewer(tray)}
              className="relative w-28 sm:w-32 h-48 sm:h-52 rounded-2xl overflow-hidden shadow-sm hover:shadow-md cursor-pointer shrink-0 border border-slate-200 dark:border-slate-700 group/story transition transform hover:-translate-y-0.5"
            >
              {/* Ảnh / Video nền hoặc Màu Gradient */}
              {firstStory.storyType === 'text' ? (
                <div
                  className="w-full h-full p-3 flex items-center justify-center text-center group-hover/story:scale-105 transition duration-300"
                  style={firstStory.backgroundStyle || { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  <p className="text-white text-xs font-bold line-clamp-4 drop-shadow">
                    {firstStory.textContent}
                  </p>
                </div>
              ) : (
                <div className="w-full h-full bg-slate-950 overflow-hidden">
                  {firstStory.storyType === 'video' ? (
                    <video
                      src={firstStory.mediaUrl}
                      className="w-full h-full object-cover group-hover/story:scale-105 transition duration-300"
                    />
                  ) : (
                    <img
                      src={firstStory.mediaUrl}
                      alt="Story"
                      className="w-full h-full object-cover group-hover/story:scale-105 transition duration-300"
                    />
                  )}
                </div>
              )}

              {/* Lớp phủ tối mỏng để chữ luôn dễ đọc */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none" />

              {/* Avatar Tác giả ở góc trên bên trái */}
              <div className="absolute top-2.5 left-2.5 z-10">
                <div
                  className={`w-9 h-9 rounded-full p-0.5 ${
                    tray.hasUnviewedStories
                      ? 'bg-gradient-to-tr from-blue-500 to-indigo-500 shadow-sm'
                      : 'bg-slate-400/60'
                  }`}
                >
                  <img
                    src={tray.author?.avatar || DEFAULT_AVATAR}
                    alt={tray.author?.name}
                    className="w-full h-full rounded-full object-cover border-2 border-white dark:border-slate-900"
                  />
                </div>
              </div>

              {/* Tên Tác giả ở góc dưới */}
              <div className="absolute bottom-2.5 inset-x-2 z-10">
                <span className="text-xs font-semibold text-white drop-shadow-md truncate block">
                  {tray.isSelf ? 'Tin của bạn' : tray.author?.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nút Cuộn Phải */}
      <button
        onClick={() => handleScroll('right')}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-110 opacity-0 group-hover:opacity-100 transition duration-200"
        aria-label="Cuộn phải"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

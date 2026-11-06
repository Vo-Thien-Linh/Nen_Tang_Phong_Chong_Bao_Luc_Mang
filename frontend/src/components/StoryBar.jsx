import { useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
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

        {/* CÁC THẺ TIN CỦA BẠN BÈ VÀ BẢN THÂN (Ưu tiên hiển thị tin chưa xem lên đầu) */}
        {[...storyTrays]
          .sort((a, b) => {
            // 1. Tin chưa xem luôn đứng trước tin đã xem hết
            if (a.hasUnviewedStories && !b.hasUnviewedStories) return -1;
            if (!a.hasUnviewedStories && b.hasUnviewedStories) return 1;

            // 2. Nếu cùng trạng thái: tin của bản thân xếp trước
            if (a.isSelf && !b.isSelf) return -1;
            if (!a.isSelf && b.isSelf) return 1;

            // 3. Tin có cập nhật mới nhất xếp trước
            return new Date(b.latestStoryTime) - new Date(a.latestStoryTime);
          })
          .map((tray) => {
            // Ưu tiên hiển thị tin đầu tiên chưa xem của tác giả trên thẻ trang chủ
            const unviewedStory = tray.stories?.find((s) => !s.isViewed);
            const displayStory = unviewedStory || tray.stories?.[tray.stories.length - 1] || tray.stories?.[0];
            if (!displayStory) return null;

            const isDisplaySensitive = Boolean(
              displayStory &&
              !displayStory.isHardHidden &&
              (displayStory.isSensitive ||
               displayStory.aiStatus === 'sensitive' ||
               displayStory.ai_status === 'sensitive' ||
               displayStory.aiLabel === 'Toxic' ||
               displayStory.ai_label === 'Toxic' ||
               displayStory.mediaModerationStatus === 'sensitive' ||
               displayStory.media_moderation_status === 'sensitive' ||
               displayStory.mediaModerationLabel === 'nsfw' ||
               displayStory.media_moderation_label === 'nsfw')
            );

            return (
              <div
                key={tray.author?.id}
                onClick={() => onOpenStoryViewer(tray)}
                className="relative w-28 sm:w-32 h-48 sm:h-52 rounded-2xl overflow-hidden shadow-sm hover:shadow-md cursor-pointer shrink-0 border border-slate-200 dark:border-slate-700 group/story transition transform hover:-translate-y-0.5"
              >
                {/* Ảnh / Video nền hoặc Màu Gradient với Đám mây cho tin văn bản */}
                {displayStory.storyType === 'text' ? (
                  <div
                    className={`w-full h-full p-2.5 flex flex-col items-center justify-center text-center group-hover/story:scale-105 transition duration-300 relative overflow-hidden ${
                      isDisplaySensitive ? 'blur-md scale-105' : ''
                    }`}
                    style={displayStory.backgroundStyle || { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                  >
                    {/* Khung Đám mây nghệ thuật bao quanh văn bản (Chuẩn phong cách Story) */}
                    <div className="relative w-full max-w-[104px] flex items-center justify-center">
                      <svg viewBox="0 0 200 135" className="w-full h-auto text-white fill-current filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
                        <path d="M 45 110 
                                 A 30 30 0 0 1 25 58 
                                 A 38 38 0 0 1 76 32 
                                 A 44 44 0 0 1 140 38 
                                 A 34 34 0 0 1 176 78 
                                 A 30 30 0 0 1 155 110 
                                 Z" />
                      </svg>
                      {/* Chữ hiển thị nổi bật bên trong đám mây */}
                      <div className="absolute inset-0 flex items-center justify-center px-3 py-2">
                        <p 
                          className="text-slate-900 text-[11px] font-black line-clamp-3 text-center leading-tight break-words select-none"
                          style={{ fontFamily: displayStory.backgroundStyle?.fontFamily || 'sans-serif' }}
                        >
                          {displayStory.textContent}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`relative w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center ${isDisplaySensitive ? 'blur-md scale-105' : ''}`}>
                    {displayStory.backgroundStyle?.fitMode === 'contain' && (
                      <div 
                        className="absolute inset-0 bg-cover bg-center blur-md opacity-60 scale-125 pointer-events-none"
                        style={{ backgroundImage: `url(${displayStory.mediaUrl})` }}
                      />
                    )}
                    {displayStory.storyType === 'video' ? (
                      <video
                        src={displayStory.mediaUrl}
                        className={`relative z-10 w-full h-full group-hover/story:scale-105 transition duration-300 ${
                          displayStory.backgroundStyle?.fitMode === 'contain' ? 'object-contain' : 'object-cover'
                        }`}
                      />
                    ) : (
                      <img
                        src={displayStory.mediaUrl}
                        alt="Story"
                        className={`relative z-10 w-full h-full group-hover/story:scale-105 transition duration-300 ${
                          displayStory.backgroundStyle?.fitMode === 'contain' ? 'object-contain' : 'object-cover'
                        }`}
                      />
                    )}
                  </div>
                )}

                {/* Huy hiệu cảnh báo nội dung nhạy cảm nếu có */}
                {isDisplaySensitive && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-2 text-center bg-black/40 backdrop-blur-xs pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-amber-500/80 backdrop-blur-md flex items-center justify-center text-white mb-1 shadow-md">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-extrabold text-amber-200 uppercase tracking-wider drop-shadow">Nhạy cảm</span>
                  </div>
                )}

                {/* Lớp phủ tối mỏng để chữ luôn dễ đọc */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none" />

                {/* Avatar Tác giả ở góc trên bên trái: Viền xanh khi có tin mới, Viền xám khi đã xem hết */}
                <div className="absolute top-2.5 left-2.5 z-10">
                  <div
                    className={`w-9 h-9 rounded-full p-0.5 transition-all duration-300 ${
                      tray.hasUnviewedStories
                        ? 'bg-blue-600 ring-2 ring-blue-500 shadow-md'
                        : 'bg-slate-400/80 ring-1 ring-slate-400/50'
                    }`}
                    title={tray.hasUnviewedStories ? 'Có tin mới chưa xem' : 'Đã xem hết tin'}
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


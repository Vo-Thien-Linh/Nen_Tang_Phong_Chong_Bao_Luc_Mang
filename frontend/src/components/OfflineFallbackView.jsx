import React, { useState } from 'react';
import { WifiOff, RefreshCw, Home, MessageSquare, ShieldAlert, ArrowLeft } from 'lucide-react';

export default function OfflineFallbackView({
  type = 'offline', // 'offline' | '404' | 'server_error'
  onRetry,
  onGoHome,
  onGoMessages,
  customTitle,
  customMessage,
}) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryClick = async () => {
    setIsRetrying(true);
    if (onRetry) {
      await onRetry();
    } else {
      window.location.reload();
    }
    setTimeout(() => setIsRetrying(false), 800);
  };

  const getCode = () => {
    if (type === '404') return '404';
    if (type === 'server_error') return '503';
    return '503';
  };

  const getTitle = () => {
    if (customTitle) return customTitle;
    if (type === '404') return 'Không tìm thấy trang hoặc nội dung đã bị gỡ bỏ.';
    if (type === 'server_error') return 'Không thể kết nối đến máy chủ WINGS. Hệ thống đang bảo trì hoặc cập nhật.';
    return 'Mất kết nối mạng hoặc không thể liên lạc với máy chủ WINGS.';
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center justify-between p-6 sm:p-10 select-none text-white relative overflow-hidden font-sans"
      style={{
        backgroundColor: '#274337',
        backgroundImage: `
          radial-gradient(ellipse at 50% 40%, rgba(55, 95, 78, 0.85) 0%, rgba(32, 56, 45, 0.95) 60%, rgba(19, 34, 27, 1) 100%),
          repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.015) 0px, rgba(255, 255, 255, 0.015) 2px, transparent 2px, transparent 6px)
        `,
      }}
    >
      {/* Subtle vignette chalk border */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(0,0,0,0.5)] border border-white/5" />

      {/* TOP BRANDING (GitHub Style) */}
      <div className="relative z-10 flex items-center gap-2.5 pt-4 opacity-90 hover:opacity-100 transition cursor-default">
        <img 
          src="/wings-logo.png" 
          alt="WINGS Logo" 
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-white/20 shadow-md"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <span className="text-sm sm:text-base font-semibold tracking-wide text-white/95">
          WINGS <span className="font-light text-white/70">Social Network</span>
        </span>
      </div>

      {/* CENTERPIECE: HUGE CODE & ACTION LINKS (Exact GitHub Education Chalkboard Style) */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xl mx-auto my-auto py-8">
        {/* Giant Number */}
        <h1 
          className="text-7xl sm:text-8xl md:text-9xl font-bold tracking-tight text-white mb-4 sm:mb-6 drop-shadow-md"
          style={{ letterSpacing: '-0.04em' }}
        >
          {getCode()}
        </h1>

        {/* Subtitle / Prompt Question */}
        <p className="text-base sm:text-lg md:text-xl text-white/90 font-normal leading-relaxed mb-6 sm:mb-8 px-4 max-w-lg">
          {getTitle()}
          <span className="block mt-1.5 text-white/75 text-sm sm:text-base">
            Bạn có đang tìm kiếm các thao tác dưới đây?
          </span>
        </p>

        {/* Minimalist Underlined Action Links (Exact GitHub Education Look) */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-base sm:text-lg font-medium text-white px-2">
          {/* Action 1: Thử lại */}
          <button
            onClick={handleRetryClick}
            disabled={isRetrying}
            className="group inline-flex items-center gap-2 underline underline-offset-8 decoration-white/60 hover:decoration-white hover:text-white transition cursor-pointer focus:outline-none"
          >
            <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${isRetrying ? 'animate-spin' : 'group-hover:rotate-180'}`} />
            <span>{isRetrying ? 'Đang thử kết nối...' : 'Thử kết nối lại'}</span>
          </button>

          {/* Action 2: Về Bảng tin */}
          <button
            onClick={() => onGoHome ? onGoHome() : (window.location.hash = '#home')}
            className="inline-flex items-center gap-2 underline underline-offset-8 decoration-white/60 hover:decoration-white hover:text-white transition cursor-pointer focus:outline-none"
          >
            <Home className="w-4 h-4 opacity-80" />
            <span>Về Bảng tin chính</span>
          </button>

          {/* Action 3: Tin nhắn */}
          <button
            onClick={() => onGoMessages ? onGoMessages() : (window.location.hash = '#messages')}
            className="inline-flex items-center gap-2 underline underline-offset-8 decoration-white/60 hover:decoration-white hover:text-white transition cursor-pointer focus:outline-none"
          >
            <MessageSquare className="w-4 h-4 opacity-80" />
            <span>Hộp thư tin nhắn</span>
          </button>
        </div>

        {/* Status Hint */}
        <div className="mt-10 inline-flex items-center gap-2 text-xs text-white/50 bg-black/15 px-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Hệ thống bảo vệ nội dung WINGS AI luôn sẵn sàng phục vụ</span>
        </div>
      </div>

      {/* FOOTER (Exact GitHub Style) */}
      <div className="relative z-10 pb-4 text-xs text-white/50 text-center tracking-wider font-light">
        <span>@WingsSocial</span>
        <span className="mx-2">—</span>
        <span>Nền tảng phòng chống bạo lực mạng và kiểm duyệt thông minh</span>
      </div>
    </div>
  );
}


import { Home, Bell, Search, Sparkles, ShieldCheck, Users, MessageCircle, LayoutDashboard } from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  unreadCount, 
  onOpenAiLab, 
  currentUser, 
  unreadMessagesCount = 1,
  pendingModerationCount = 0
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-all shadow-xs shrink-0">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
        
        {/* Left Side: Logo & Search */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Logo & Brand */}
          <button 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition duration-200 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg sm:text-xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight whitespace-nowrap">
                NexusSocial
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-600 rounded-md border border-blue-200 whitespace-nowrap">
                AI Powered
              </span>
            </div>
          </button>

          {/* Search Bar - Fixed width, no shrinking */}
          <div className="hidden md:flex items-center shrink-0 w-48 lg:w-60 xl:w-72">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Tìm kiếm bạn bè, bài viết..."
                className="w-full pl-9 pr-3.5 py-2 bg-slate-100 hover:bg-slate-200/60 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 rounded-full border border-transparent focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition duration-200"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Navigation Tabs, Tools, Admin & User Profile */}
        <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 shrink-0">
          
          {/* Nút Tab Trang chủ */}
          <button
            onClick={() => setActiveTab('home')}
            title="Trang chủ"
            className={
              'h-10 flex items-center gap-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
              (activeTab === 'home'
                ? 'bg-blue-50 text-blue-600 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
            }
          >
            <Home className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="hidden lg:inline whitespace-nowrap">Trang chủ</span>
          </button>

          {/* Nút Tab Bạn bè */}
          <button
            onClick={() => setActiveTab('friends')}
            title="Bạn bè"
            className={
              'h-10 flex items-center gap-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
              (activeTab === 'friends'
                ? 'bg-blue-50 text-blue-600 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
            }
          >
            <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="hidden lg:inline whitespace-nowrap">Bạn bè</span>
          </button>

          {/* Nút Tab Tin nhắn */}
          <button
            onClick={() => setActiveTab('messages')}
            title="Đoạn chat & Tin nhắn bạn bè"
            className={
              'h-10 relative flex items-center gap-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
              (activeTab === 'messages'
                ? 'bg-blue-50 text-blue-600 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
            }
          >
            <div className="relative shrink-0 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadMessagesCount}
                </span>
              )}
            </div>
            <span className="hidden lg:inline whitespace-nowrap">Tin nhắn</span>
          </button>

          {/* Nút Tab Thông báo */}
          <button
            onClick={() => setActiveTab('notifications')}
            title="Thông báo"
            className={
              'h-10 relative flex items-center gap-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
              (activeTab === 'notifications'
                ? 'bg-blue-50 text-blue-600 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
            }
          >
            <div className="relative shrink-0 flex items-center justify-center">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <span className="hidden lg:inline whitespace-nowrap">Thông báo</span>
          </button>

          {/* NÚT TAB ADMIN DASHBOARD (TRUNG TÂM KIỂM DUYỆT & BÁO CÁO) */}
          <button
            onClick={() => setActiveTab('admin')}
            title="Bảng điều khiển Quản Trị Viên (Xử lý báo cáo, khiếu nại, sửa nhãn AI)"
            className={
              'h-10 flex items-center gap-2 px-3 sm:px-3.5 rounded-xl text-xs sm:text-sm font-bold transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
              (activeTab === 'admin'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-200'
                : 'bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80')
            }
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Admin Dashboard</span>
            {pendingModerationCount > 0 && (
              <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-full text-white shrink-0 ${
                activeTab === 'admin' ? 'bg-rose-500' : 'bg-rose-600'
              }`}>
                {pendingModerationCount}
              </span>
            )}
          </button>

          {/* AI Moderation Lab Popup Launcher */}
          <button
            onClick={onOpenAiLab}
            title="Thử nghiệm AI Kiểm duyệt thời gian thực"
            className="h-10 flex items-center gap-1.5 px-3 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition duration-150 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">AI Lab</span>
          </button>

          {/* Phân cách */}
          <div className="h-6 w-px bg-slate-200 mx-0.5 sm:mx-1 shrink-0" />

          {/* Nút Avatar góc trên */}
          <button
            onClick={() => setActiveTab('profile')}
            title="Đến trang cá nhân"
            className={
              'h-10 flex items-center gap-2 p-1 pr-2.5 rounded-full transition duration-150 border cursor-pointer whitespace-nowrap shrink-0 ' +
              (activeTab === 'profile'
                ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100'
                : 'hover:bg-slate-100 border-slate-200')
            }
          >
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/30 shrink-0"
            />
            <div className="hidden xl:flex flex-col text-left leading-tight shrink-0">
              <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                {currentUser.name}
              </span>
              <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider whitespace-nowrap">
                {currentUser.role || 'Admin'}
              </span>
            </div>
          </button>

        </div>

      </div>
    </header>
  );
}

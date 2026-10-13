import { useState, useRef, useEffect } from 'react';
import { 
  Home, Bell, Search, Sparkles, ShieldCheck, Users, MessageCircle, 
  LayoutDashboard, LogOut, LogIn, UserPlus, ChevronDown, User, Shield, Settings,
  Sun, Moon
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  unreadCount, 
  onOpenAiLab, 
  currentUser, 
  onOpenAuthModal,
  onLogout,
  unreadMessagesCount = 1,
  pendingModerationCount = 0,
  theme = 'light',
  onToggleTheme
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

          {/* NÚT TAB ADMIN DASHBOARD (CHỈ HIỂN THỊ HOẶC TRUY CẬP KHI CÓ QUYỀN HOẶC TEST) */}
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

          {/* Nút Chuyển đổi Giao diện Sáng / Tối */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 transition duration-150 cursor-pointer shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            )}
          </button>

          {/* Phân cách */}
          <div className="h-6 w-px bg-slate-200 mx-0.5 sm:mx-1 shrink-0" />

          {/* ======================================================== */}
          {/* USER PROFILE VÀ MENU ĐĂNG XUẤT / HOẶC NÚT ĐĂNG NHẬP KHÁCH */}
          {/* ======================================================== */}
          {currentUser ? (
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                title="Menu tài khoản"
                className={
                  'h-10 flex items-center gap-2 p-1 pr-2.5 rounded-full transition duration-150 border cursor-pointer whitespace-nowrap shrink-0 ' +
                  (showUserMenu || activeTab === 'profile' || activeTab === 'settings'
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100'
                    : 'hover:bg-slate-100 border-slate-200')
                }
              >
                <img 
                  src={currentUser.avatar || currentUser.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"} 
                  alt={currentUser.name} 
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/30 shrink-0"
                />
                <div className="hidden xl:flex flex-col text-left leading-tight shrink-0">
                  <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider whitespace-nowrap">
                    {currentUser.role || 'USER'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {/* DROPDOWN MENU TÀI KHOẢN (Chứa nút Đăng xuất theo User Story 3) */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in divide-y divide-slate-100">
                  <div className="px-4 py-3">
                    <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{currentUser.email || currentUser.phone}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-indigo-50 text-indigo-600 rounded border border-indigo-200">
                        {currentUser.role || 'USER'}
                      </span>
                      {currentUser.phone && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          📞 {currentUser.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { setActiveTab('profile'); setShowUserMenu(false); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 font-medium cursor-pointer"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Trang cá nhân của bạn</span>
                    </button>

                    <button
                      onClick={() => { setActiveTab('settings'); setShowUserMenu(false); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 font-medium cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-blue-500" />
                      <span>Cài đặt & Khiên an toàn</span>
                    </button>

                    <button
                      onClick={() => { onToggleTheme && onToggleTheme(); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between font-medium cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                        <span>Chế độ: {theme === 'dark' ? 'Tối (Dark)' : 'Sáng (Light)'}</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        {theme === 'dark' ? '☀️ Bật sáng' : '🌙 Bật tối'}
                      </span>
                    </button>

                    {currentUser.role === 'ADMIN' && (
                      <button
                        onClick={() => { setActiveTab('admin'); setShowUserMenu(false); }}
                        className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 font-medium cursor-pointer"
                      >
                        <Shield className="w-4 h-4 text-indigo-500" />
                        <span>Bảng quản trị hệ thống</span>
                      </button>
                    )}
                  </div>

                  {/* NÚT ĐĂNG XUẤT ĐẶT TRONG MENU TÀI KHOẢN THEO EXCEL ID 3 */}
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2.5 transition duration-150 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Đăng xuất khỏi hệ thống</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onOpenAuthModal('login')}
                className="h-9 px-3.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 transition duration-150 flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </button>
              <button
                onClick={() => onOpenAuthModal('register')}
                className="h-9 px-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/20 transition duration-150 flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Đăng ký</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </header>
  );
}


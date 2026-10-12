import { useState, useRef, useEffect } from 'react';
import { 
  Home, Bell, Search, Sparkles, ShieldCheck, Users, MessageCircle, 
  LayoutDashboard, LogOut, LogIn, UserPlus, ChevronDown, User, Shield
} from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';
import SearchBar from './SearchBar';

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
  onOpenProfile,
  onSearchPosts,
  clientPosts = [],
  activeFilterQuery = '',
  onClearFilter
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);
  const isAdmin = Boolean(currentUser && (currentUser.role?.toLowerCase() === 'admin' || currentUser.isAdmin || currentUser.is_admin));

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
            <img 
              src="/wings-logo.png" 
              alt="WINGS Logo" 
              className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-100 shadow-xs group-hover:scale-105 transition duration-200 shrink-0" 
            />
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="text-xl font-black text-blue-600 tracking-tight whitespace-nowrap">
                WINGS
              </span>
              <span className="hidden sm:inline text-xs font-semibold text-slate-500 whitespace-nowrap">
                - social network
              </span>
            </div>
          </button>

          {/* Search Bar */}
          <div className="hidden sm:block shrink-0 w-52 md:w-64 lg:w-80 xl:w-96">
            <SearchBar 
              onOpenProfile={onOpenProfile}
              onSearchPosts={onSearchPosts}
              clientPosts={clientPosts}
              activeFilterQuery={activeFilterQuery}
              onClearFilter={onClearFilter}
            />
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

          {/* NÚT TAB ADMIN DASHBOARD (CHỈ HIỂN THỊ KHI TÀI KHOẢN LÀ ADMIN) */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              title="Bảng điều khiển Quản Trị Viên (Xử lý báo cáo, khiếu nại, sửa nhãn AI)"
              className={
                'h-10 flex items-center gap-2 px-3 sm:px-3.5 rounded-xl text-xs sm:text-sm font-bold transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
                (activeTab === 'admin'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 ring-2 ring-blue-200'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80')
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
          )}

          {/* AI Moderation Lab Popup Launcher */}
          <button
            onClick={onOpenAiLab}
            title="Thử nghiệm AI Kiểm duyệt thời gian thực"
            className="h-10 flex items-center gap-1.5 px-3 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition duration-150 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">AI Lab</span>
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
                  'h-10 flex items-center gap-1.5 p-1 pr-2 sm:pr-2.5 rounded-full transition duration-150 border cursor-pointer whitespace-nowrap shrink-0 ' +
                  (showUserMenu || activeTab === 'profile'
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100'
                    : 'hover:bg-slate-100 border-slate-200 bg-white/80')
                }
              >
                <img 
                  src={currentUser.avatar || currentUser.avatar_url || DEFAULT_AVATAR} 
                  alt={currentUser.name} 
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/30 shrink-0"
                />
                {isAdmin && (
                  <span className="px-1.5 py-0.5 text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200/80 rounded-md uppercase tracking-wider">
                    ADMIN
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* DROPDOWN MENU TÀI KHOẢN (Chứa nút Đăng xuất theo User Story 3) */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in divide-y divide-slate-100">
                  <div className="px-4 py-3">
                    <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{currentUser.email || currentUser.phone}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-blue-50 text-blue-700 rounded border border-blue-200">
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

                    {isAdmin && (
                      <button
                        onClick={() => { setActiveTab('admin'); setShowUserMenu(false); }}
                        className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 font-medium cursor-pointer"
                      >
                        <Shield className="w-4 h-4 text-blue-600" />
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


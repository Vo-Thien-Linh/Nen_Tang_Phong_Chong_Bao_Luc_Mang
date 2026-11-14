import { useState, useRef, useEffect } from 'react';
import { 
  Home, Bell, ShieldCheck, Users, MessageCircle,
  LayoutDashboard, LogOut, LogIn, UserPlus, ChevronDown, User, Shield, Settings,
  Sun, Moon, Bookmark, Search
} from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';
import SearchBar from './SearchBar';
import { hasRole, ROLES } from '../utils/rbac';
import { useTranslation } from '../utils/i18n';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  unreadCount, 
  onOpenAiLab, 
  currentUser, 
  onOpenAuthModal,
  onLogout,
  unreadMessagesCount = 0,
  pendingModerationCount = 0,
  theme = 'light',
  onToggleTheme,
  onOpenProfile,
  onSearchPosts,
  clientPosts = [],
  activeFilterQuery = '',
  onClearFilter,
  onRefreshHome,
  isLoadingPosts = false
}) {
  const { t } = useTranslation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const menuRef = useRef(null);
  const isAdmin = hasRole(currentUser, ROLES.ADMIN);
  const isModerator = hasRole(currentUser, ROLES.MODERATOR);

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

  const handleHomeClick = () => {
    if (activeTab === 'home') {
      onRefreshHome?.();
    } else {
      setActiveTab('home');
      onRefreshHome?.();
    }
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-all shadow-xs">
        <div className="w-full px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3">
          
          {/* Left Side: Logo & Search */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Logo & Brand */}
            <button 
              onClick={handleHomeClick}
              title="WINGS - Bảng tin (Nhấn để làm mới)"
              className="flex items-center gap-2 text-left group focus:outline-none cursor-pointer shrink-0"
            >
              <img 
                src="/wings-logo.png" 
                alt="WINGS Logo" 
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-blue-100 shadow-xs group-hover:scale-105 transition duration-200 shrink-0" 
              />
              <div className="flex items-baseline gap-1 shrink-0">
                <span className="text-xl font-black text-blue-600 tracking-tight whitespace-nowrap">
                  WINGS
                </span>
                <span className="hidden 2xl:inline text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  - social network
                </span>
              </div>
            </button>

            {/* Search Bar - Thu gọn chiều rộng để hiển thị trọn vẹn các tab điều hướng ở 100% zoom */}
            <div className="hidden sm:block shrink-0 w-44 md:w-48 lg:w-56 xl:w-60">
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
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            
            {/* Cụm 5 Tab chính (Ẩn trên Mobile < md vì đã có Bottom Navigation) */}
            <div className="hidden md:flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Nút Tab Trang chủ */}
              <button
                onClick={handleHomeClick}
                title={t('nav.home')}
                className={
                  'h-10 flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
                  (activeTab === 'home'
                    ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-950/40 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')
                }
              >
                <Home className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="hidden lg:inline whitespace-nowrap">{t('nav.home')}</span>
              </button>

              {/* Nút Tab Bạn bè */}
              <button
                onClick={() => setActiveTab('friends')}
                title={t('nav.friends')}
                className={
                  'h-10 flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
                  (activeTab === 'friends'
                    ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-950/40 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')
                }
              >
                <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="hidden lg:inline whitespace-nowrap">{t('nav.friends')}</span>
              </button>

              {/* Nút Tab Nhóm */}
              <button
                onClick={() => setActiveTab('groups')}
                title={t('nav.groups')}
                className={
                  'h-10 flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
                  (activeTab === 'groups'
                    ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-950/40 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="8.5" r="2.2" />
                  <path d="M7.6 20.9V18a4.4 3.6 0 0 1 8.8 0v2.9" />
                  <path d="M2.35 9.4a3.1 2.7 0 0 1 0 5.2" />
                  <path d="M21.65 9.4a3.1 2.7 0 0 0 0 5.2" />
                </svg>
                <span className="hidden lg:inline whitespace-nowrap">{t('nav.groups')}</span>
              </button>

              {/* Nút Tab Tin nhắn */}
              <button
                onClick={() => setActiveTab('messages')}
                title={t('nav.messages')}
                className={
                  'h-10 relative flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
                  (activeTab === 'messages'
                    ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-950/40 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')
                }
              >
                <div className="relative shrink-0 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                      {unreadMessagesCount}
                    </span>
                  )}
                </div>
                <span className="hidden lg:inline whitespace-nowrap">{t('nav.messages')}</span>
              </button>

              {/* Nút Tab Thông báo */}
              <button
                onClick={() => setActiveTab('notifications')}
                title={t('nav.notifications')}
                className={
                  'h-10 relative flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
                  (activeTab === 'notifications'
                    ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-950/40 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')
                }
              >
                <div className="relative shrink-0 flex items-center justify-center">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs shadow-rose-500/40">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="hidden lg:inline whitespace-nowrap">{t('nav.notifications')}</span>
              </button>
            </div>

            {/* Nút Tìm kiếm Mobile (Chỉ hiện trên điện thoại < sm) */}
            <button
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              title="Tìm kiếm bài viết, bạn bè"
              className={
                'sm:hidden h-9 w-9 flex items-center justify-center rounded-xl transition duration-150 cursor-pointer shrink-0 ' +
                (showMobileSearch
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300')
              }
            >
              <Search className="w-4 h-4" />
            </button>

            {/* NÚT ĐẶC QUYỀN DUY NHẤT (Chỉ render trên màn hình >= md vì mobile đã có trong User Menu) */}
            {isAdmin ? (
              <button
                id="nav-privileged-btn"
                onClick={() => setActiveTab('admin')}
                title="Khu vực quản trị hệ thống"
                className={
                  'hidden md:flex h-10 items-center gap-1.5 px-2.5 lg:px-3 rounded-xl text-xs sm:text-sm font-medium transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
                  (activeTab === 'admin'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:border-slate-700')
                }
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline whitespace-nowrap">{t("nav.admin")}</span>
              </button>
            ) : isModerator ? (
              <button
                id="nav-privileged-btn"
                onClick={() => setActiveTab('moderation')}
                title="Khu vực kiểm duyệt nội dung"
                className={
                  'hidden md:flex h-10 items-center gap-1.5 px-2.5 lg:px-3 rounded-xl text-xs sm:text-sm font-medium transition duration-150 cursor-pointer whitespace-nowrap shrink-0 ' +
                  (activeTab === 'moderation'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:border-slate-700')
                }
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline whitespace-nowrap">{t("nav.moderation")}</span>
              </button>
            ) : null}

            {/* AI Moderation Lab Popup Launcher (Màn hình >= md, mobile có trong User Menu) */}
            <button
              onClick={onOpenAiLab}
              title="Thử nghiệm AI Kiểm duyệt thời gian thực"
              className="hidden md:flex h-10 items-center gap-1.5 px-2.5 lg:px-3 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition duration-150 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">AI Lab</span>
            </button>

            {/* Nút Chuyển đổi Giao diện Sáng / Tối */}
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? t("nav.switch_to_light") : t("nav.switch_to_dark")}
              className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 transition duration-150 cursor-pointer shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
              )}
            </button>

            {/* Phân cách */}
            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 sm:mx-1 shrink-0" />

          {/* ======================================================== */}
          {/* USER PROFILE VÀ MENU ĐĂNG XUẤT / HOẶC NÚT ĐĂNG NHẬP KHÁCH */}
          {/* ======================================================== */}
          {currentUser ? (
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                title={t("nav.user_menu")}
                className={
                  'h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 p-0.5 sm:p-1 pr-1 sm:pr-2.5 rounded-full transition duration-150 border cursor-pointer whitespace-nowrap shrink-0 ' +
                  (showUserMenu || activeTab === 'profile' || activeTab === 'settings'
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100 dark:bg-blue-950/40 dark:border-blue-600 dark:ring-blue-900/30'
                    : 'hover:bg-slate-100 border-slate-200 bg-white/80 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700')
                }
              >
                <img 
                  src={currentUser.avatar || currentUser.avatar_url || DEFAULT_AVATAR} 
                  alt={currentUser.name} 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-blue-500/30 shrink-0"
                />
                {isAdmin && (
                  <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-black text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800 rounded-md uppercase tracking-wider">
                    ADMIN
                  </span>
                )}
                <ChevronDown className={`hidden sm:inline-block w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* DROPDOWN MENU TÀI KHOẢN (Chứa nút Đăng xuất theo User Story 3) */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="px-4 py-3">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{currentUser.email || currentUser.phone}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                        {currentUser.role || 'USER'}
                      </span>
                      {currentUser.phone && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          📞 {currentUser.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { setActiveTab('profile'); setShowUserMenu(false); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 font-medium cursor-pointer"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{t('nav.profile')}</span>
                    </button>

                    <button
                      onClick={() => { setActiveTab('profile', null, false, 'saved'); setShowUserMenu(false); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 font-medium cursor-pointer"
                    >
                      <Bookmark className="w-4 h-4 text-blue-500" />
                      <span>Bài viết đã lưu</span>
                    </button>

                    <button
                      onClick={() => { setActiveTab('settings'); setShowUserMenu(false); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 font-medium cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-blue-500" />
                      <span>{t('nav.settings')}</span>
                    </button>

                    <button
                      onClick={() => { onOpenAiLab(); setShowUserMenu(false); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 font-medium cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>AI Moderation Lab</span>
                    </button>


                    {isAdmin && (
                      <button
                        onClick={() => { setActiveTab('admin'); setShowUserMenu(false); }}
                        className="w-full px-4 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 font-medium cursor-pointer"
                      >
                        <LayoutDashboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>{t("nav.admin_panel")}</span>
                      </button>
                    )}

                    {isModerator && !isAdmin && (
                      <button
                        onClick={() => { setActiveTab('moderation'); setShowUserMenu(false); }}
                        className="w-full px-4 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 font-medium cursor-pointer"
                      >
                        <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>{t("nav.moderation_panel")}</span>
                      </button>
                    )}
                  </div>

                  {/* NÚT ĐẶC BIỆT ĐĂNG XUẤT ĐẶT TRONG MENU TÀI KHOẢN THEO EXCEL ID 3 */}
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl flex items-center gap-2.5 transition duration-150 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                      <span>{t('nav.logout')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onOpenAuthModal('login')}
                className="h-9 px-3.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition duration-150 flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t('nav.login')}</span>
              </button>
              <button
                onClick={() => onOpenAuthModal('register')}
                className="h-9 px-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/20 transition duration-150 flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t('nav.register')}</span>
              </button>
            </div>
          )}

        </div>

      </div>

      {/* Khung Tìm kiếm bung ra trên Mobile khi bấm nút kính lúp */}
      {showMobileSearch && (
        <div className="sm:hidden w-full px-3 py-2 bg-white/98 dark:bg-slate-900/98 border-t border-slate-200/80 dark:border-slate-800 shadow-md animate-fade-in">
          <SearchBar 
            onOpenProfile={(id) => {
              setShowMobileSearch(false);
              onOpenProfile?.(id);
            }}
            onSearchPosts={(query) => {
              setShowMobileSearch(false);
              onSearchPosts?.(query);
            }}
            clientPosts={clientPosts}
            activeFilterQuery={activeFilterQuery}
            onClearFilter={onClearFilter}
          />
        </div>
      )}
    </header>
    {/* Spacer giữ khoảng trống khi header được ghim cố định fixed top-0, chống giật giao diện */}
    <div className="h-14 sm:h-16 shrink-0" aria-hidden="true" />
    </>
  );
}


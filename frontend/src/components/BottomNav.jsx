import React from 'react';
import { Home, Users, MessageCircle, Bell } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

export default function BottomNav({
  activeTab,
  setActiveTab,
  unreadCount = 0,
  unreadMessagesCount = 0,
  onRefreshHome
}) {
  const { t } = useTranslation();

  const handleTabClick = (tabKey) => {
    if (tabKey === 'home' && activeTab === 'home') {
      onRefreshHome?.();
    } else {
      setActiveTab(tabKey);
      if (tabKey === 'home') {
        onRefreshHome?.();
      }
    }
  };

  const tabs = [
    {
      key: 'home',
      label: t('nav.home') || 'Trang chủ',
      icon: Home,
      badge: 0
    },
    {
      key: 'friends',
      label: t('nav.friends') || 'Bạn bè',
      icon: Users,
      badge: 0
    },
    {
      key: 'groups',
      label: t('nav.groups') || 'Nhóm',
      icon: ({ className }) => (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="8.5" r="2.2" />
          <path d="M7.6 20.9V18a4.4 3.6 0 0 1 8.8 0v2.9" />
          <path d="M2.35 9.4a3.1 2.7 0 0 1 0 5.2" />
          <path d="M21.65 9.4a3.1 2.7 0 0 0 0 5.2" />
        </svg>
      ),
      badge: 0
    },
    {
      key: 'messages',
      label: t('nav.messages') || 'Tin nhắn',
      icon: MessageCircle,
      badge: unreadMessagesCount
    },
    {
      key: 'notifications',
      label: t('nav.notifications') || 'Thông báo',
      icon: Bell,
      badge: unreadCount
    }
  ];

  return (
    <nav
      aria-label="Thanh điều hướng dưới"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 transition-colors shadow-lg"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
    >
      <div className="flex items-center justify-around h-14 px-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabClick(tab.key)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 tracking-tight truncate max-w-[64px] ${isActive ? 'font-bold' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-4 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

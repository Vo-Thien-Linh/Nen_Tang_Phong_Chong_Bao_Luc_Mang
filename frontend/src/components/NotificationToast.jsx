import { Bell, Heart, MessageCircle, Repeat, ShieldAlert, ShieldCheck, X } from 'lucide-react';

export default function NotificationToast({ notification, onClose, onClick }) {
  if (!notification) return null;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />;
      case 'comment':
        return <MessageCircle className="w-3.5 h-3.5 fill-blue-500 text-blue-500" />;
      case 'share':
        return <Repeat className="w-3.5 h-3.5 text-emerald-500" />;
      case 'report_receipt':
        return <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />;
      case 'system':
      case 'ai_moderation':
      case 'moderation_alert':
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  const actor = notification.user || {
    name: 'Thông báo hệ thống',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
  };

  return (
    <aside
      aria-label="Thông báo mới"
      className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md w-full animate-slide-up-fade"
    >
      <div 
        onClick={onClick}
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-blue-200/80 dark:border-blue-900/50 shadow-xl shadow-blue-500/10 rounded-2xl p-4 flex items-start gap-3.5 cursor-pointer hover:shadow-2xl transition group relative overflow-hidden"
      >
        {/* Glow accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        {/* Avatar with type badge */}
        <div className="relative shrink-0">
          <img
            src={actor.avatar}
            alt={actor.name}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-blue-100 dark:ring-blue-900 shadow-xs"
          />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-slate-800 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center shadow-xs">
            {getTypeIcon(notification.type)}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Thông báo mới</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-[11px] text-slate-400">{notification.time || 'Vừa xong'}</span>
          </div>

          <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-snug line-clamp-2">
            <strong className="text-slate-900 dark:text-white font-semibold">{actor.name}</strong>{' '}
            <span className="text-slate-600 dark:text-slate-400">{notification.content}</span>
          </p>

          {notification.targetPost?.contentSnippet && (
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700/50 truncate italic">
              &ldquo;{notification.targetPost.contentSnippet}&rdquo;
            </p>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          title="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}

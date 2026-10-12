import { useState } from 'react';
import { 
  Bell, Heart, MessageCircle, UserPlus, ShieldAlert, CheckCheck, 
  Trash2 
} from 'lucide-react';

export default function NotificationsView({ notifications, onMarkAllAsRead, onMarkAsRead, onDeleteNotification }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'interaction' | 'system'

  const filteredNotifications = notifications.filter(item => {
    if (filter === 'unread') return !item.isRead;
    if (filter === 'interaction') return item.type === 'like' || item.type === 'comment';
    if (filter === 'system') return item.type === 'system';
    return true;
  });

  const getNotifIcon = (type) => {
    switch (type) {
      case 'like':
        return (
          <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
            <Heart className="w-4 h-4 fill-rose-500" />
          </div>
        );
      case 'comment':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4 fill-blue-500" />
          </div>
        );
      case 'follow':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4" />
          </div>
        );
      case 'system':
        return (
          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        
        {/* Header Thông báo */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Thông báo</h1>
              <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-600 rounded-full">
                {notifications.filter(n => !n.isRead).length} chưa đọc
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Cập nhật tương tác bài viết và cảnh báo hệ thống</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllAsRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Đánh dấu đã đọc tất cả</span>
            </button>
          </div>
        </div>

        {/* Bộ lọc tabs */}
        <div className="px-6 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'all' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'unread' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chưa đọc ({notifications.filter(n => !n.isRead).length})
          </button>
          <button
            onClick={() => setFilter('interaction')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'interaction' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tương tác
          </button>
          <button
            onClick={() => setFilter('system')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'system' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hệ thống & AI
          </button>
        </div>

        {/* Danh sách thông báo */}
        <div className="divide-y divide-slate-100">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => onMarkAsRead(item.id)}
                className={`p-4 sm:p-5 flex items-start gap-4 transition cursor-pointer hover:bg-slate-50/80 ${
                  !item.isRead ? 'bg-blue-50/30 font-medium' : ''
                }`}
              >
                {/* Icon tương ứng */}
                {getNotifIcon(item.type)}

                {/* Avatar người tạo tương tác */}
                <img 
                  src={item.user.avatar} 
                  alt={item.user.name} 
                  className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white shadow-2xs"
                />

                {/* Nội dung */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 leading-snug">
                    <strong className="text-slate-900 hover:text-blue-600">{item.user.name}</strong>{' '}
                    <span className="text-slate-600">{item.content}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{item.time}</p>
                </div>

                {/* Nút xóa & trạng thái */}
                <div className="flex items-center gap-2 shrink-0">
                  {!item.isRead && (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNotification(item.id);
                    }}
                    title="Xóa thông báo"
                    className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-slate-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-16 text-center text-slate-400">
              <Bell className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
              <p className="text-sm font-medium">Không có thông báo nào trong mục này</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

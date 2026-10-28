import { useState, useEffect } from 'react';
import { formatRelativeTime } from '../utils/timeAgo';
import { 
  Bell, Heart, MessageCircle, Repeat, ShieldAlert, ShieldCheck, CheckCheck, 
  Trash2, RefreshCw, Eye, Sparkles, Filter, ChevronRight, Inbox, Scale, Lock
} from 'lucide-react';
import { getNotificationNavigationTarget, getNotificationSnapshotPreview } from '../utils/notificationSnapshotLogic';

export default function NotificationsView({ 
  notifications = [], 
  onMarkAllAsRead, 
  onMarkAsRead, 
  onDeleteNotification,
  onClearReadNotifications,
  onRefresh,
  isLoading = false,
  onOpenProfile,
  onViewPost,
  onOpenAppealModal,
  currentUser,
  activeFilter = 'all',
  onFilterChange,
}) {
  const [internalFilter, setInternalFilter] = useState('all');
  const currentFilter = onFilterChange ? activeFilter : internalFilter;

  // Tự động re-render mỗi 30 giây để cập nhật relative time ("Vừa xong" -> "1 phút trước", "2 phút trước", v.v.)
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Tính toán thời gian tương đối động dựa trên timestamp thật của thông báo
  const formatNotificationTime = (item) => {
    if (!item) return 'Vừa xong';

    // 1. Kiểm tra timestamp ISO từ CSDL hoặc LocalStorage (createdAt / created_at)
    const rawTime = item.createdAt || item.created_at || item.createdAtIso;
    if (rawTime) {
      const parsedDate = new Date(rawTime);
      if (!isNaN(parsedDate.getTime())) {
        return formatRelativeTime(parsedDate);
      }
    }

    // 2. Nếu id chứa epoch timestamp (ví dụ notif-1729867123456)
    if (typeof item.id === 'string') {
      const match = item.id.match(/\d{11,13}/);
      if (match) {
        const tsNum = parseInt(match[0], 10);
        if (!isNaN(tsNum) && tsNum > 1600000000000) {
          return formatRelativeTime(new Date(tsNum));
        }
      }
    }

    // 3. Nếu item.time đã là relative time có sẵn từ Backend (ví dụ '11 phút trước', '2 giờ trước')
    if (item.time && item.time !== 'Vừa xong') {
      return item.time;
    }

    return 'Vừa xong';
  };

  const handleFilterClick = (filterKey) => {
    if (onFilterChange) {
      onFilterChange(filterKey);
    } else {
      setInternalFilter(filterKey);
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (currentFilter === 'unread') return !item.isRead;
    if (currentFilter === 'interaction') return ['like', 'comment', 'share', 'reaction'].includes(item.type);
    if (currentFilter === 'system') return ['system', 'ai_moderation', 'report', 'appeal', 'warning', 'report_receipt'].includes(item.type);
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getNotifIconBadge = (type) => {
    switch (type) {
      case 'like':
        return (
          <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs">
            <Heart className="w-3 h-3 fill-white" />
          </div>
        );
      case 'comment':
        return (
          <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs">
            <MessageCircle className="w-3 h-3 fill-white" />
          </div>
        );
      case 'share':
        return (
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs">
            <Repeat className="w-3 h-3" />
          </div>
        );
      case 'ai_moderation':
      case 'report_receipt':
        return (
          <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs">
            <ShieldCheck className="w-3 h-3" />
          </div>
        );
      case 'system':
        return (
          <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs">
            <ShieldAlert className="w-3 h-3" />
          </div>
        );
      default:
        return (
          <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs">
            <Bell className="w-3 h-3" />
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
      {/* Container chính với hiệu ứng bo góc và shadow mềm */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
        
        {/* Header Thông báo */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-white via-blue-50/20 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400">
                <Bell className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Thông báo
              </h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-bold bg-rose-500 text-white rounded-full animate-pulse shadow-xs shadow-rose-500/30">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Cập nhật tương tác bài viết, thông báo bạn bè và cảnh báo kiểm duyệt AI
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl transition cursor-pointer border border-blue-200/60 dark:border-blue-800/60"
                title="Đánh dấu đã đọc tất cả"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Đã đọc tất cả</span>
              </button>
            )}

            {onClearReadNotifications && (
              <button
                onClick={onClearReadNotifications}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Xóa các thông báo đã đọc"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dọn dẹp đã đọc</span>
              </button>
            )}

            {onRefresh && (
              <button
                onClick={onRefresh}
                className={`p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer ${isLoading ? 'animate-spin text-blue-600' : ''}`}
                title="Làm mới thông báo"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bộ lọc tabs hiện đại */}
        <div className="px-5 sm:px-6 py-2.5 bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs font-semibold">
          {[
            { key: 'all', label: 'Tất cả', count: notifications.length },
            { key: 'unread', label: 'Chưa đọc', count: unreadCount },
            { key: 'interaction', label: 'Tương tác', count: notifications.filter((n) => ['like', 'comment', 'share', 'reaction'].includes(n.type)).length },
            { key: 'system', label: 'Hệ thống & AI', count: notifications.filter((n) => ['system', 'ai_moderation', 'report', 'appeal', 'warning'].includes(n.type)).length },
          ].map((tab) => {
            const isActive = currentFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleFilterClick(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition duration-150 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Danh sách thông báo */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {isLoading && notifications.length === 0 ? (
            /* Skeleton Loading */
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3.5 animate-pulse">
                  <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredNotifications.length > 0 ? (
            filteredNotifications.map((item) => {
              const snapshotPreview = getNotificationSnapshotPreview(item);
              const isSystemOrModeration = 
                ['system', 'ai_moderation', 'moderation_alert', 'warning', 'report', 'appeal', 'report_receipt'].includes(item.type) ||
                item.isReceipt ||
                (item.content && (
                  item.content.includes('thẩm định lại') || 
                  item.content.includes('tạm khóa') ||
                  item.content.includes('khiếu nại') ||
                  item.content.includes('báo cáo') ||
                  item.content.includes('vi phạm') ||
                  item.content.includes('chuyển sang nhãn')
                ));

              const actor = isSystemOrModeration
                ? {
                    id: 'system',
                    name: 'Thông báo hệ thống',
                    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
                  }
                : (item.user || {
                    id: 'system',
                    name: 'Thông báo hệ thống',
                    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
                  });
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onMarkAsRead(item.id);
                    const targetPostId = getNotificationNavigationTarget(item);
                    if (targetPostId && onViewPost) {
                      onViewPost(targetPostId, {
                        type: item.type,
                        actor,
                        targetCommentId: item.targetCommentId || item.commentId,
                        notificationId: item.id
                      });
                    } else if (['follow', 'friend_request', 'friend_accept'].includes(item.type) && onOpenProfile && actor.id && actor.id !== 'system') {
                      onOpenProfile(actor);
                    }
                  }}
                  className={`group relative p-4 sm:p-5 flex items-start gap-3.5 sm:gap-4 transition-all duration-150 cursor-pointer ${
                    !item.isRead
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* Dải màu đánh dấu chưa đọc bên lề trái */}
                  {!item.isRead && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-r-full shadow-xs shadow-blue-500/50" />
                  )}

                  {/* Avatar người tương tác với Badge loại thông báo */}
                  <div className="relative shrink-0">
                    <img
                      src={actor.avatar}
                      alt={actor.name}
                      onClick={(e) => {
                        if (onOpenProfile && actor.id && actor.id !== 'system') {
                          e.stopPropagation();
                          onOpenProfile(actor);
                        }
                      }}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 shadow-xs cursor-pointer hover:opacity-90 transition"
                    />
                    <div className="absolute -bottom-1 -right-1">
                      {getNotifIconBadge(item.type)}
                    </div>
                  </div>

                  {/* Nội dung thông báo */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-snug">
                      <strong 
                        onClick={(e) => {
                          if (onOpenProfile && actor.id && actor.id !== 'system') {
                            e.stopPropagation();
                            onOpenProfile(actor);
                          }
                        }}
                        className="text-slate-900 dark:text-white font-bold hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition"
                      >
                        {actor.name}
                      </strong>{' '}
                      <span className="text-slate-600 dark:text-slate-300">{item.content}</span>
                    </div>

                    {/* Preview bài viết liên quan nếu có */}
                    {snapshotPreview.isRemoval ? (
                      <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50">
                        {snapshotPreview.content && <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-line break-words">{snapshotPreview.content}</p>}
                        {snapshotPreview.images.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {snapshotPreview.images.map((imageUrl) => (
                              <img key={imageUrl} src={imageUrl} alt="Nội dung đã bị xóa" className="h-16 w-16 rounded-lg object-cover" />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (item.targetPost || item.targetPostId) && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkAsRead(item.id);
                          const targetPostId = item.targetPost?.id || item.targetPostId;
                          if (onViewPost && targetPostId) {
                            onViewPost(targetPostId, {
                              type: item.type,
                              actor,
                              targetCommentId: item.targetCommentId || item.commentId,
                              notificationId: item.id
                            });
                          }
                        }}
                        className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3 hover:border-blue-300 dark:hover:border-blue-700 transition group/post cursor-pointer"
                      >
                        {item.targetPost?.image && (
                          <img
                            src={item.targetPost.image}
                            alt="Post snippet"
                            className="w-12 h-12 rounded-lg object-cover shrink-0 ring-1 ring-slate-200/80 dark:ring-slate-700"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 italic">
                            &ldquo;{item.targetPost?.contentSnippet || 'Xem chi tiết bài viết'}&rdquo;
                          </p>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-hover/post:underline mt-0.5">
                            Xem bài viết <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Phân định: Người đi báo cáo (Receipt) vs Người bị xử phạt vi phạm (Sanction) */}
                    {(() => {
                      const isReportReceipt = 
                        item.isReceipt || 
                        item.type === 'report_receipt' || 
                        item.content?.includes('Báo cáo của bạn') || 
                        item.content?.includes('đã được tiếp nhận');

                      const isSanctionNotice =
                        !snapshotPreview.isRemoval &&
                        !isReportReceipt && 
                        onOpenAppealModal && 
                        (
                          item.type === 'ai_moderation' || 
                          item.type === 'moderation_alert' || 
                          (item.content && (
                            item.content.includes('của bạn bị ẩn') || 
                            item.content.includes('của bạn bị cảnh báo') || 
                            item.content.includes('của bạn đã bị khóa') || 
                            item.content.includes('bị áp dụng án phạt')
                          ))
                        );

                      if (isReportReceipt) {
                        return (
                          <div className="mt-2.5 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 rounded-lg text-xs font-medium">
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                              <span>Đã tiếp nhận báo cáo • Chờ Quản trị viên xử lý</span>
                            </span>
                          </div>
                        );
                      }

                      if (isSanctionNotice) {
                        return (
                          <div className="mt-2.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkAsRead(item.id);
                                onOpenAppealModal({
                                  targetType: item.targetCommentId ? 'comment' : 'post',
                                  targetId: item.targetPost?.id || item.targetPostId || item.id,
                                  targetAuthor: currentUser || { id: currentUser?.id, name: currentUser?.name },
                                  contentExcerpt: item.targetPost?.contentSnippet || 'Nội dung bị xử phạt',
                                  imageUrl: item.targetPost?.image || null,
                                  aiStatus: {
                                    label: item.content?.includes('Bạo lực') ? 'Violence' : item.content?.includes('Hate Speech') ? 'Hate Speech' : 'Toxic',
                                    confidence: 0.95,
                                    action: 'hide'
                                  }
                                });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                            >
                              <Scale className="w-3.5 h-3.5" />
                              <span>Gửi kháng cáo</span>
                            </button>
                          </div>
                        );
                      }

                      return null;
                    })()}

                    {/* Thời gian */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {formatNotificationTime(item)}
                      </span>
                      {!item.isRead && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          · Chưa đọc
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Nút hành động xóa & chấm unread */}
                  <div className="flex items-center gap-2 shrink-0 self-center">
                    {!item.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-950" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNotification(item.id);
                      }}
                      title="Xóa thông báo này"
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition duration-150"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            /* Empty State khi không có thông báo */
            <div className="py-20 px-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-500 dark:text-blue-400 shadow-inner">
                <Inbox className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Chưa có thông báo nào
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 max-w-sm mx-auto mt-1">
                {currentFilter === 'unread'
                  ? 'Tuyệt vời! Bạn đã đọc hết tất cả thông báo hiện có.'
                  : currentFilter === 'interaction'
                  ? 'Khi có người thích, bình luận hoặc chia sẻ bài viết, thông báo sẽ hiển thị ở đây.'
                  : currentFilter === 'system'
                  ? 'Không có cảnh báo vi phạm hay thông báo hệ thống nào.'
                  : 'Mọi hoạt động tương tác mới sẽ được cập nhật tự động tại đây.'}
              </p>
              {currentFilter !== 'all' && (
                <button
                  onClick={() => handleFilterClick('all')}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 rounded-xl transition cursor-pointer"
                >
                  Xem tất cả thông báo
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

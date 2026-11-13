import { useState, useEffect } from 'react';
import { UserCheck, UserPlus, UserX, MessageCircle, Search, Clock, Users, Sparkles, Loader2 } from 'lucide-react';
import { friendService } from '../services/friendService';
import { messageService } from '../services/messageService';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { useTranslation } from '../utils/i18n';

export default function FriendsView({ onOpenChat, onOpenProfile, initialTab = 'requests' }) {
  const { t, isEn } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab || 'requests'); // 'requests' | 'all' | 'suggestions'
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingSections, setLoadingSections] = useState({ requests: true, friends: true, suggestions: true });

  // Đồng bộ khi prop initialTab thay đổi từ bên ngoài (ví dụ click từ trang chủ)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Danh sách lời mời kết bạn (Pending) - Mặc định rỗng, chỉ hiển thị lời mời thật từ DB
  const [friendRequests, setFriendRequests] = useState([]);

  // Danh sách bạn bè hiện tại (Accepted)
  const [friendsList, setFriendsList] = useState([]);

  // Gợi ý kết bạn: Khởi tạo rỗng, chỉ hiển thị người dùng thật từ Database Supabase
  const [suggestions, setSuggestions] = useState([]);

  // Tải dữ liệu thật từ Backend API song song độc lập (không chặn nhau)
  useEffect(() => {
    let isMounted = true;
    setLoadingSections({ requests: true, friends: true, suggestions: true });
    const finishLoading = (section) => {
      if (isMounted) setLoadingSections((prev) => ({ ...prev, [section]: false }));
    };

    friendService.getFriendsList().then(friends => {
      if (!isMounted) return;
      if (friends && Array.isArray(friends)) {
        setFriendsList(friends.map(f => ({
          id: f.id,
          name: f.name,
          username: f.username,
          avatar: f.avatar || DEFAULT_AVATAR,
          bio: f.bio
        })));
      }
    }).catch(err => console.warn('Lỗi tải bạn bè:', err)).finally(() => finishLoading('friends'));

    friendService.getFriendRequests().then(reqs => {
      if (!isMounted) return;
      if (reqs && Array.isArray(reqs)) {
        setFriendRequests(reqs.map(r => ({
          id: r.id,
          user: {
            id: r.user.id,
            name: r.user.full_name,
            username: r.user.username,
            avatar: r.user.avatar_url || DEFAULT_AVATAR,
            mutualFriends: (r.mutual_friends || []).map(m => ({ id: m.id, name: m.name, avatar: m.avatar || DEFAULT_AVATAR })),
            time: 'Gần đây',
            bio: r.user.bio
          }
        })));
      }
    }).catch(err => console.warn('Lỗi tải lời mời:', err)).finally(() => finishLoading('requests'));

    friendService.getFriendSuggestions().then(sugs => {
      if (!isMounted) return;
      if (sugs && Array.isArray(sugs) && sugs.length > 0) {
        setSuggestions(sugs.map(s => ({
          id: s.id,
          name: s.name,
          username: s.username,
          avatar: s.avatar || DEFAULT_AVATAR,
          bio: s.bio,
          mutualFriends: (s.mutual_friends || []).map(m => ({ id: m.id, name: m.name, avatar: m.avatar || DEFAULT_AVATAR })),
          requestSent: s.request_sent || false
        })));
      }
    }).catch(err => console.warn('Lỗi tải gợi ý:', err)).finally(() => finishLoading('suggestions'));

    return () => { isMounted = false; };
  }, []);

  // Xử lý chấp nhận lời mời
  const handleAccept = async (reqId) => {
    const target = friendRequests.find(r => r.id === reqId);
    if (target) {
      setFriendsList([target.user, ...friendsList]);
      setFriendRequests(friendRequests.filter(r => r.id !== reqId));
      try {
        await friendService.acceptFriendRequest(reqId);
        // TỰ ĐỘNG THÊM BẠN BÈ VÀO Ô CHÁT (Kích hoạt hội thoại 'accepted')
        if (target.user?.id) {
          await messageService.getOrCreateConversation(target.user.id);
        }
      } catch (err) {
        console.warn('API accept fallback:', err);
      }
    }
  };

  // Xử lý từ chối lời mời
  const handleReject = async (reqId) => {
    setFriendRequests(friendRequests.filter(r => r.id !== reqId));
    try {
      await friendService.rejectFriendRequest(reqId);
    } catch (err) {
      console.warn('API reject fallback:', err);
    }
  };

  // Xử lý hủy kết bạn
  const handleUnfriend = async (friendId) => {
    if (window.confirm(isEn ? 'Are you sure you want to unfriend?' : 'Bạn có chắc chắn muốn hủy kết bạn?')) {
      setFriendsList(friendsList.filter(f => f.id !== friendId));
      try {
        await friendService.unfriend(friendId);
      } catch (err) {
        console.warn('API unfriend fallback:', err);
      }
    }
  };

  // Gửi hoặc hủy lời mời kết bạn trong gợi ý
  const handleToggleSendRequest = async (sugId) => {
    const targetSug = suggestions.find(s => s.id === sugId);
    const willBeSent = targetSug ? !targetSug.requestSent : true;

    setSuggestions(prev => prev.map(s => 
      s.id === sugId ? { ...s, requestSent: willBeSent } : s
    ));

    try {
      if (willBeSent) {
        const res = await friendService.sendFriendRequest(sugId);
        // Nếu đối phương đã gửi lời mời trước đó và trở thành bạn bè, tự động tạo chat
        if (res?.data?.status === 'accepted') {
          await messageService.getOrCreateConversation(sugId);
        }
      } else {
        await friendService.cancelSentRequest(sugId);
      }
    } catch (err) {
      console.warn('API toggle friend request fallback:', err);
    }
  };

  // Gỡ người này khỏi danh sách gợi ý
  const handleDismissSuggestion = (sugId) => {
    setSuggestions(prev => prev.filter(s => s.id !== sugId));
  };

  // Lọc tìm kiếm
  const filteredFriends = friendsList.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="w-full max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-xs border border-slate-200/90 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              {isEn ? 'Friends & Connections' : 'Bạn bè & Kết nối'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isEn ? 'Manage friend lists, respond to requests, and find new connections' : 'Quản lý danh sách bạn bè, phản hồi lời mời và tìm kiếm kết nối mới'}
            </p>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('friends.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-850 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition"
            />
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-3 sm:px-6 gap-2 pt-2 bg-slate-50/50 dark:bg-slate-950/40 overflow-x-auto scrollbar-none touch-pan-x">
          <button
            onClick={() => setActiveTab('requests')}
            className={
              'flex items-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition cursor-pointer ' +
              (activeTab === 'requests'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')
            }
          >
            <Clock className="w-4 h-4" />
            {t('friends.requests')}
            {friendRequests.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-rose-500 text-white rounded-full font-bold">
                {friendRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={
              'flex items-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition cursor-pointer ' +
              (activeTab === 'all'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')
            }
          >
            <UserCheck className="w-4 h-4" />
            {t('friends.all_friends')} ({friendsList.length})
          </button>

          <button
            onClick={() => setActiveTab('suggestions')}
            className={
              'flex items-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition cursor-pointer ' +
              (activeTab === 'suggestions'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')
            }
          >
            <UserPlus className="w-4 h-4" />
            {t('friends.suggestions')}
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-3 sm:p-6">
          
          {/* TAB 1: LỜI MỜI KẾT BẠN */}
          {activeTab === 'requests' && (
            <div>
              {loadingSections.requests ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4.5">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-4 animate-pulse"
                    >
                      <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                        <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/2" />
                        <div className="h-7 bg-slate-100 dark:bg-slate-800/60 rounded-lg w-20 mt-3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : friendRequests.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
                    <UserCheck className="w-8 h-8" />
                  </div>
                  <h3 className="font-semibold text-slate-700 dark:text-slate-200">{t('friends.no_requests')}</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{t('friends.no_requests_desc')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4.5">
                  {friendRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-sm transition bg-white dark:bg-slate-850 flex items-start gap-4"
                    >
                      <img
                        src={req.user.avatar || DEFAULT_AVATAR}
                        alt={req.user.name}
                        onClick={() => onOpenProfile && onOpenProfile(req.user)}
                        className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-750 cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 
                            onClick={() => onOpenProfile && onOpenProfile(req.user)}
                            className="font-bold text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                          >
                            {req.user.name}
                          </h4>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{req.user.time}</span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">@{req.user.username}</p>
                        
                        {/* Hiển thị {t("friends.mutual_friends", { count: req.user.mutualFriends.length })} từ danh sách */}
                        {Array.isArray(req.user.mutualFriends) && req.user.mutualFriends.length > 0 ? (
                          <div 
                            className="flex items-center gap-1.5 mt-1.5"
                            title={`Bạn bè chung: ${req.user.mutualFriends.map(f => f.name).join(', ')}`}
                          >
                            <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                              {req.user.mutualFriends.slice(0, 3).map((mf) => (
                                <img
                                  key={mf.id}
                                  src={mf.avatar}
                                  alt={mf.name}
                                  title={mf.name}
                                  className="w-4 h-4 rounded-full object-cover ring-1 ring-white dark:ring-slate-800"
                                />
                              ))}
                            </div>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold truncate">
                              {req.user.mutualFriends.length === 1 ? (
                                <>{isEn ? 'Mutual friend: ' : 'Bạn chung: '}{req.user.mutualFriends[0].name}</>
                              ) : (
                                <>{req.user.mutualFriends.length} {t("friends.mutual_friends", { count: req.user.mutualFriends.length })} ({req.user.mutualFriends.map(f => f.name).join(', ')})</>
                              )}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{isEn ? "No mutual friends" : "Chưa có bạn chung"}</p>
                        )}

                        {req.user.bio && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{req.user.bio}</p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleAccept(req.id)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> {t("friends.accept")}
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" /> {t("friends.delete_request")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TẤT CẢ BẠN BÈ */}
          {activeTab === 'all' && (
            <div>
              {loadingSections.friends ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div
                      key={i}
                      className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center text-center animate-pulse space-y-3"
                    >
                      <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-20" />
                      <div className="h-8 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-full mt-2" />
                    </div>
                  ))}
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                  <p>{isEn ? 'No friends found matching your search.' : 'Không tìm thấy bạn bè nào khớp với từ khóa.'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4.5">
                  {filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:shadow-md transition flex flex-col items-center text-center group"
                    >
                      <img
                        src={friend.avatar}
                        alt={friend.name}
                        onClick={() => onOpenProfile && onOpenProfile(friend)}
                        className="w-20 h-20 rounded-full object-cover ring-4 ring-slate-50 dark:ring-slate-800 group-hover:scale-105 transition duration-200 cursor-pointer"
                      />
                      <h4 
                        onClick={() => onOpenProfile && onOpenProfile(friend)}
                        className="font-bold text-slate-800 dark:text-slate-100 mt-3 truncate w-full hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition"
                      >
                        {friend.name}
                      </h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500">@{friend.username}</p>
                      {friend.bio && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 px-1 min-h-[32px]">
                          {friend.bio}
                        </p>
                      )}
                      <div className="flex gap-2 mt-4 w-full">
                        <button onClick={() => onOpenChat && onOpenChat(friend)} className="flex-1 py-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer">
                          <MessageCircle className="w-3.5 h-3.5" /> {t('friends.message')}
                        </button>
                        <button
                          onClick={() => handleUnfriend(friend.id)}
                          className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400 dark:text-slate-500 rounded-xl text-xs font-semibold transition cursor-pointer"
                          title={isEn ? "Unfriend" : "Hủy kết bạn"}
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GỢI Ý KẾT BẠN */}
          {activeTab === 'suggestions' && (
            <div>
              {/* Header gợi ý thông minh */}
              <div className="mb-5 p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span>{isEn ? 'People You May Know' : 'Những người bạn có thể biết'}</span>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-md">
                        {isEn ? 'Recommendation Algorithm' : 'Thuật toán gợi ý'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isEn ? 'Automatically prioritizing people with the most mutual friends first' : 'Tự động xếp hạng ưu tiên người có nhiều bạn bè chung nhất trong danh sách lên đầu lần lượt'}
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto px-3 py-1 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl border border-blue-200/80 dark:border-blue-800 shadow-2xs">
                  {suggestions.length} {isEn ? 'recommended' : 'người được đề xuất'}
                </span>
              </div>

              {loadingSections.suggestions ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center text-center animate-pulse space-y-3"
                    >
                      <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-20" />
                      <div className="h-8 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-full mt-2" />
                    </div>
                  ))}
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                  <p>{t('friends.no_suggestions')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4.5">
                  {suggestions.map((sug) => {
                    const mutualCount = Array.isArray(sug.mutualFriends) ? sug.mutualFriends.length : (sug.mutualFriends || 0);
                    const mutualList = Array.isArray(sug.mutualFriends) ? sug.mutualFriends : [];

                    return (
                      <div
                        key={sug.id}
                        className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-850 hover:shadow-md transition duration-200 flex flex-col justify-between group"
                      >
                        <div className="flex flex-col items-center text-center">
                          <div className="relative mb-3">
                            <img
                              src={sug.avatar || DEFAULT_AVATAR}
                              alt={sug.name}
                              onClick={() => onOpenProfile && onOpenProfile(sug)}
                              className="w-20 h-20 rounded-full object-cover ring-4 ring-slate-100 dark:ring-slate-750 group-hover:scale-105 transition duration-200 shadow-2xs cursor-pointer hover:ring-2 hover:ring-blue-400"
                            />
                            {mutualCount > 0 && (
                              <span 
                                className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-xs border-2 border-white dark:border-slate-850"
                                title={`${mutualCount} bạn bè chung`}
                              >
                                {mutualCount}
                              </span>
                            )}
                          </div>

                          <h4 
                            onClick={() => onOpenProfile && onOpenProfile(sug)}
                            className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate w-full hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition"
                          >
                            {sug.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">@{sug.username}</p>
                          
                          {sug.bio && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                              {sug.bio}
                            </p>
                          )}

                          {/* KHU VỰC BẠN CHUNG: CÓ NHIỀU BẠN CHUNG THÌ HIỆN LẦN LƯỢT */}
                          <div className="w-full mt-3 p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100/90 dark:border-slate-750 min-h-[58px] flex flex-col justify-center">
                            {mutualCount > 0 ? (
                              <div>
                                <div className="flex items-center justify-center -space-x-1.5 mb-1.5 overflow-hidden">
                                  {mutualList.slice(0, 3).map((mf) => (
                                    <img
                                      key={mf.id}
                                      src={mf.avatar}
                                      alt={mf.name}
                                      title={mf.name}
                                      className="w-5 h-5 rounded-full object-cover ring-1.5 ring-white dark:ring-slate-800 shadow-2xs"
                                    />
                                  ))}
                                </div>
                                <p 
                                  className="text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-tight"
                                  title={`Bạn bè chung: ${mutualList.map(f => f.name).join(', ')}`}
                                >
                                  {mutualCount === 1 ? (
                                    <>{isEn ? 'Mutual friend: ' : 'Bạn chung: '}<span className="font-bold text-slate-800 dark:text-slate-100">{mutualList[0].name}</span></>
                                  ) : mutualCount === 2 ? (
                                    <>{isEn ? 'Mutual friends: ' : 'Bạn chung: '}<span className="font-bold text-slate-800 dark:text-slate-100">{mutualList[0].name}</span>, <span className="font-bold text-slate-800 dark:text-slate-100">{mutualList[1].name}</span></>
                                  ) : (
                                    <><span className="font-bold text-blue-600 dark:text-blue-400">{mutualCount} {isEn ? 'mutual friends' : 'bạn chung'}</span> ({mutualList[0].name}, {mutualList[1].name}...)</>
                                  )}
                                </p>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                {isEn ? "No mutual friends" : "Chưa có bạn chung"}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2 w-full">
                          <button
                            onClick={() => handleToggleSendRequest(sug.id)}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
                              sug.requestSent 
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {sug.requestSent ? (
                              <><UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> {isEn ? 'Requested' : 'Đã gửi lời mời'}</>
                            ) : (
                              <><UserPlus className="w-3.5 h-3.5" /> {t('friends.add_friend')}</>
                            )}
                          </button>

                          <button
                            onClick={() => handleDismissSuggestion(sug.id)}
                            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400 dark:text-slate-500 rounded-xl transition cursor-pointer"
                            title={isEn ? "Dismiss suggestion" : "Xóa gợi ý này"}
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </main>
  );
}

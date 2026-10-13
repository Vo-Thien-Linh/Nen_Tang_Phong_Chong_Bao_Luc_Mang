import { useState, useEffect } from 'react';
import { UserCheck, UserPlus, UserX, MessageCircle, Search, Clock, Users, Sparkles, Loader2 } from 'lucide-react';
import { friendService } from '../services/friendService';
import { messageService } from '../services/messageService';
import { DEFAULT_AVATAR } from '../constants/defaults';

export default function FriendsView({ onOpenChat, onOpenProfile }) {
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'all' | 'suggestions'
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Danh sách lời mời kết bạn (Pending) - Mặc định rỗng, chỉ hiển thị lời mời thật từ DB
  const [friendRequests, setFriendRequests] = useState([]);

  // Danh sách bạn bè hiện tại (Accepted)
  const [friendsList, setFriendsList] = useState([]);

  // Gợi ý kết bạn: Khởi tạo rỗng, chỉ hiển thị người dùng thật từ Database Supabase
  const [suggestions, setSuggestions] = useState([]);

  // Tải dữ liệu thật từ Backend API song song độc lập (không chặn nhau)
  useEffect(() => {
    let isMounted = true;

    // 1. Tải danh sách bạn bè siêu tốc (hiển thị tức thì)
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
    }).catch(err => console.warn('Lỗi tải bạn bè:', err));

    // 2. Tải lời mời kết bạn (chỉ lấy dữ liệu thật, không dùng mock)
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
    }).catch(err => console.warn('Lỗi tải lời mời:', err));

    // 3. Tải gợi ý kết bạn thông minh
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
    }).catch(err => console.warn('Lỗi tải gợi ý:', err));

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
    if (window.confirm('Bạn có chắc chắn muốn hủy kết bạn?')) {
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
    <main className="w-full max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xs border border-slate-200/90 overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              Bạn bè & Kết nối
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Quản lý danh sách bạn bè, phản hồi lời mời và tìm kiếm kết nối mới
            </p>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm bạn bè..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 focus:bg-white text-sm text-slate-800 placeholder-slate-400 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition"
            />
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-100 px-6 gap-2 pt-2 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('requests')}
            className={
              'flex items-center gap-2 py-3 px-4 border-b-2 font-semibold text-sm transition cursor-pointer ' +
              (activeTab === 'requests'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800')
            }
          >
            <Clock className="w-4 h-4" />
            Lời mời kết bạn
            {friendRequests.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-rose-500 text-white rounded-full font-bold">
                {friendRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={
              'flex items-center gap-2 py-3 px-4 border-b-2 font-semibold text-sm transition cursor-pointer ' +
              (activeTab === 'all'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800')
            }
          >
            <UserCheck className="w-4 h-4" />
            Tất cả bạn bè ({friendsList.length})
          </button>

          <button
            onClick={() => setActiveTab('suggestions')}
            className={
              'flex items-center gap-2 py-3 px-4 border-b-2 font-semibold text-sm transition cursor-pointer ' +
              (activeTab === 'suggestions'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800')
            }
          >
            <UserPlus className="w-4 h-4" />
            Gợi ý kết bạn
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-6">
          
          {/* TAB 1: LỜI MỜI KẾT BẠN */}
          {activeTab === 'requests' && (
            <div>
              {friendRequests.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <UserCheck className="w-8 h-8" />
                  </div>
                  <h3 className="font-semibold text-slate-700">Không có lời mời nào</h3>
                  <p className="text-sm text-slate-400 mt-1">Khi có người gửi lời mời kết bạn, bạn sẽ thấy ở đây.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4.5">
                  {friendRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-slate-200 hover:shadow-sm transition bg-white flex items-start gap-4"
                    >
                      <img
                        src={req.user.avatar || DEFAULT_AVATAR}
                        alt={req.user.name}
                        onClick={() => onOpenProfile && onOpenProfile(req.user)}
                        className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-100 cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 
                            onClick={() => onOpenProfile && onOpenProfile(req.user)}
                            className="font-bold text-slate-800 truncate cursor-pointer hover:text-blue-600 transition"
                          >
                            {req.user.name}
                          </h4>
                          <span className="text-[11px] text-slate-400 shrink-0">{req.user.time}</span>
                        </div>
                        <p className="text-xs text-slate-400">@{req.user.username}</p>
                        
                        {/* Hiển thị bạn chung từ danh sách */}
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
                                  className="w-4 h-4 rounded-full object-cover ring-1 ring-white"
                                />
                              ))}
                            </div>
                            <p className="text-xs text-blue-600 font-semibold truncate">
                              {req.user.mutualFriends.length === 1 ? (
                                <>Bạn chung: {req.user.mutualFriends[0].name}</>
                              ) : (
                                <>{req.user.mutualFriends.length} bạn chung ({req.user.mutualFriends.map(f => f.name).join(', ')})</>
                              )}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 mt-1">Chưa có bạn chung</p>
                        )}

                        {req.user.bio && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{req.user.bio}</p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleAccept(req.id)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Xác nhận
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" /> Xóa
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
              {filteredFriends.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p>Không tìm thấy bạn bè nào khớp với từ khóa.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4.5">
                  {filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="p-5 rounded-xl border border-slate-200 bg-white hover:shadow-md transition flex flex-col items-center text-center group"
                    >
                      <img
                        src={friend.avatar}
                        alt={friend.name}
                        onClick={() => onOpenProfile && onOpenProfile(friend)}
                        className="w-20 h-20 rounded-full object-cover ring-4 ring-slate-50 group-hover:scale-105 transition duration-200 cursor-pointer"
                      />
                      <h4 
                        onClick={() => onOpenProfile && onOpenProfile(friend)}
                        className="font-bold text-slate-800 mt-3 truncate w-full hover:text-blue-600 cursor-pointer transition"
                      >
                        {friend.name}
                      </h4>
                      <p className="text-xs text-slate-400">@{friend.username}</p>
                      {friend.bio && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 px-1 min-h-[32px]">
                          {friend.bio}
                        </p>
                      )}
                      <div className="flex gap-2 mt-4 w-full">
                        <button onClick={() => onOpenChat && onOpenChat(friend)} className="flex-1 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer">
                          <MessageCircle className="w-3.5 h-3.5" /> Nhắn tin
                        </button>
                        <button
                          onClick={() => handleUnfriend(friend.id)}
                          className="p-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-xl text-xs font-semibold transition cursor-pointer"
                          title="Hủy kết bạn"
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
              <div className="mb-5 p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Những người bạn có thể biết</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md">
                        Thuật toán gợi ý
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tự động xếp hạng ưu tiên người có nhiều bạn bè chung nhất trong danh sách lên đầu lần lượt
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto px-3 py-1 bg-white text-blue-600 text-xs font-bold rounded-xl border border-blue-200/80 shadow-2xs">
                  {suggestions.length} người được đề xuất
                </span>
              </div>

              {suggestions.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p>Hiện không có thêm gợi ý kết bạn nào mới.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4.5">
                  {suggestions.map((sug) => {
                    const mutualCount = Array.isArray(sug.mutualFriends) ? sug.mutualFriends.length : (sug.mutualFriends || 0);
                    const mutualList = Array.isArray(sug.mutualFriends) ? sug.mutualFriends : [];

                    return (
                      <div
                        key={sug.id}
                        className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:shadow-md transition duration-200 flex flex-col justify-between group"
                      >
                        <div className="flex flex-col items-center text-center">
                          <div className="relative mb-3">
                            <img
                              src={sug.avatar || DEFAULT_AVATAR}
                              alt={sug.name}
                              onClick={() => onOpenProfile && onOpenProfile(sug)}
                              className="w-20 h-20 rounded-full object-cover ring-4 ring-slate-100 group-hover:scale-105 transition duration-200 shadow-2xs cursor-pointer hover:ring-2 hover:ring-blue-400"
                            />
                            {mutualCount > 0 && (
                              <span 
                                className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-xs border-2 border-white"
                                title={`${mutualCount} bạn bè chung`}
                              >
                                {mutualCount}
                              </span>
                            )}
                          </div>

                          <h4 
                            onClick={() => onOpenProfile && onOpenProfile(sug)}
                            className="font-bold text-slate-800 text-sm truncate w-full hover:text-blue-600 cursor-pointer transition"
                          >
                            {sug.name}
                          </h4>
                          <p className="text-[11px] text-slate-400">@{sug.username}</p>
                          
                          {sug.bio && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                              {sug.bio}
                            </p>
                          )}

                          {/* KHU VỰC BẠN CHUNG: CÓ NHIỀU BẠN CHUNG THÌ HIỆN LẦN LƯỢT */}
                          <div className="w-full mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100/90 min-h-[58px] flex flex-col justify-center">
                            {mutualCount > 0 ? (
                              <div>
                                <div className="flex items-center justify-center -space-x-1.5 mb-1.5 overflow-hidden">
                                  {mutualList.slice(0, 3).map((mf) => (
                                    <img
                                      key={mf.id}
                                      src={mf.avatar}
                                      alt={mf.name}
                                      title={mf.name}
                                      className="w-5 h-5 rounded-full object-cover ring-1.5 ring-white shadow-2xs"
                                    />
                                  ))}
                                </div>
                                <p 
                                  className="text-[11px] font-medium text-slate-600 leading-tight"
                                  title={`Bạn bè chung: ${mutualList.map(f => f.name).join(', ')}`}
                                >
                                  {mutualCount === 1 ? (
                                    <>Bạn chung: <span className="font-bold text-slate-800">{mutualList[0].name}</span></>
                                  ) : mutualCount === 2 ? (
                                    <>Bạn chung: <span className="font-bold text-slate-800">{mutualList[0].name}</span>, <span className="font-bold text-slate-800">{mutualList[1].name}</span></>
                                  ) : (
                                    <><span className="font-bold text-blue-600">{mutualCount} bạn chung</span> ({mutualList[0].name}, {mutualList[1].name}...)</>
                                  )}
                                </p>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 font-medium">
                                Chưa có bạn chung
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2 w-full">
                          <button
                            onClick={() => handleToggleSendRequest(sug.id)}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
                              sug.requestSent 
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {sug.requestSent ? (
                              <><UserCheck className="w-3.5 h-3.5 text-blue-600" /> Đã gửi lời mời</>
                            ) : (
                              <><UserPlus className="w-3.5 h-3.5" /> Thêm bạn bè</>
                            )}
                          </button>

                          <button
                            onClick={() => handleDismissSuggestion(sug.id)}
                            className="p-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-xl transition cursor-pointer"
                            title="Xóa gợi ý này"
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

import { useState } from 'react';
import { 
  TrendingUp, UserPlus, Users, MessageCircle, 
  ShieldCheck, Sparkles, LayoutDashboard, User
} from 'lucide-react';
import CreatePostCard from './CreatePostCard';
import PostCard from './PostCard';
import { suggestedFriends, trendingTopics } from '../data/mockData';

export default function HomeView({ 
  currentUser, 
  posts, 
  onAddPost, 
  onToggleLike, 
  onAddComment,
  onOpenReportModal,
  onOpenAppealModal,
  onRequireLogin,
  setActiveTab,
  onOpenAiLab
}) {
  const [feedFilter, setFeedFilter] = useState('forYou'); // 'forYou' | 'following'
  const [friendsList, setFriendsList] = useState(() => {
    // Sắp xếp người có nhiều bạn bè chung nhất lên đầu lần lượt xuống dưới
    return [...suggestedFriends].sort((a, b) => {
      const aCount = Array.isArray(a.mutualFriends) ? a.mutualFriends.length : (a.mutualFriends || 0);
      const bCount = Array.isArray(b.mutualFriends) ? b.mutualFriends.length : (b.mutualFriends || 0);
      return bCount - aCount;
    });
  });

  const toggleFollowFriend = (id) => {
    setFriendsList(prev => prev.map(friend => 
      friend.id === id ? { ...friend, requestSent: !friend.requestSent } : friend
    ));
  };

  const filteredPosts = feedFilter === 'following'
    ? posts.filter(p => p.author.id !== currentUser.id)
    : posts;

  return (
    <div className="w-full max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex justify-center items-start gap-6 lg:gap-8">
        
        {/* ================= CỘT TRÁI: LỐI TẮT NHANH & PROFILE (HIỆN TRÊN MÀN HÌNH RỘNG XL) ================= */}
        <aside className="hidden xl:block w-64 2xl:w-72 space-y-4 sticky top-20 shrink-0">
          
          {/* Card Thông tin tài khoản người dùng */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3.5">
            <div 
              onClick={() => setActiveTab && setActiveTab('profile')}
              className="flex items-center gap-3 p-1 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              <img 
                src={currentUser.avatar} 
                alt={currentUser.name} 
                className="w-11 h-11 rounded-full object-cover ring-2 ring-blue-500/20 shadow-2xs"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800 truncate hover:text-blue-600 transition">
                  {currentUser.name}
                </h3>
                <span className="inline-block px-1.5 py-0.2 text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded uppercase">
                  {currentUser.role || 'Admin'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-center">
              <div className="p-2 bg-slate-50 rounded-xl">
                <p className="text-sm font-black text-slate-800">{currentUser.postsCount || posts.filter(p => p.author?.id === currentUser.id).length}</p>
                <p className="text-[10px] text-slate-400 font-medium">Bài viết</p>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl">
                <p className="text-sm font-black text-slate-800">{currentUser.friendsCount || 128}</p>
                <p className="text-[10px] text-slate-400 font-medium">Bạn bè</p>
              </div>
            </div>
          </div>

          {/* Menu Lối tắt tính năng */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs space-y-1">
            <button
              onClick={() => setActiveTab && setActiveTab('profile')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <User className="w-4 h-4 text-blue-600" />
              <span>Trang cá nhân</span>
            </button>

            <button
              onClick={() => setActiveTab && setActiveTab('friends')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Bạn bè & Kết nối</span>
            </button>

            <button
              onClick={() => setActiveTab && setActiveTab('messages')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-violet-600" />
              <span>Hộp thư Tin nhắn</span>
            </button>

            <button
              onClick={() => setActiveTab && setActiveTab('admin')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100/80 transition cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 text-indigo-600" />
              <span>Admin Dashboard</span>
            </button>

            <button
              onClick={onOpenAiLab}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-cyan-600" />
              <span>Thử nghiệm AI Lab</span>
            </button>
          </div>

          {/* Card trạng thái AI Shield PhoBERT */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-md space-y-2 border border-indigo-950">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
              <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">AI Shield Active</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Mô hình PhoBERT đang bảo vệ nền tảng, tự động gắn nhãn và chặn lọc nội dung độc hại thời gian thực.
            </p>
          </div>

        </aside>

        {/* ================= BẢNG TIN TRUNG TÂM (MỞ RỘNG RỘNG RÃI, THOÁNG ĐÃNG) ================= */}
        <main className="w-full max-w-[680px] xl:max-w-[720px] 2xl:max-w-[760px] space-y-4">
          
          {/* Ô tạo bài viết mới */}
          <CreatePostCard currentUser={currentUser} onAddPost={onAddPost} onRequireLogin={onRequireLogin} />

          {/* Tabs bộ lọc Feed */}
          <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs text-xs font-semibold">
            <div className="flex gap-2">
              <button
                onClick={() => setFeedFilter('forYou')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  feedFilter === 'forYou' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Dành cho bạn
              </button>
              <button
                onClick={() => setFeedFilter('following')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  feedFilter === 'following' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Đang theo dõi
              </button>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">
              {filteredPosts.length} bài viết
            </span>
          </div>

          {/* Danh sách bài viết Feed */}
          <div className="space-y-4">
            {filteredPosts.length > 0 ? (
              filteredPosts.map(post => (
                <PostCard 
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onToggleLike={onToggleLike}
                  onAddComment={onAddComment}
                  onOpenReportModal={onOpenReportModal}
                  onOpenAppealModal={onOpenAppealModal}
                />
              ))
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-400 text-sm">
                Chưa có bài viết nào trong mục này.
              </div>
            )}
          </div>

        </main>

        {/* ================= CỘT PHẢI (GỢI Ý KẾT BẠN, XU HƯỚNG, ONLINE) ================= */}
        <aside className="hidden lg:block w-80 xl:w-88 space-y-5 sticky top-20 shrink-0">
          
          {/* Gợi ý kết bạn */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-blue-500" />
                  <span>Gợi ý kết bạn</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Ưu tiên người có nhiều bạn chung</p>
              </div>
              <button
                onClick={() => setActiveTab && setActiveTab('friends')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                Xem tất cả
              </button>
            </div>

            <div className="space-y-3.5">
              {friendsList.map(friend => {
                const mutualCount = Array.isArray(friend.mutualFriends) ? friend.mutualFriends.length : (friend.mutualFriends || 0);
                const mutualList = Array.isArray(friend.mutualFriends) ? friend.mutualFriends : [];

                return (
                  <div key={friend.id} className="flex items-center justify-between gap-2.5 group">
                    <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                      <img 
                        src={friend.avatar} 
                        alt={friend.name} 
                        className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-slate-200 shadow-2xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p 
                          onClick={() => setActiveTab && setActiveTab('friends')}
                          className="text-xs font-bold text-slate-800 truncate hover:text-blue-600 cursor-pointer"
                        >
                          {friend.name}
                        </p>
                        
                        {/* Hiển thị bạn chung (Bạn bè trong danh sách) có nhiều bạn chung hiện lần lượt */}
                        {mutualCount > 0 ? (
                          <div 
                            className="flex items-center gap-1.5 mt-0.5"
                            title={`Bạn bè chung trong danh sách: ${mutualList.map(f => f.name).join(', ')}`}
                          >
                            {/* Avatar thu nhỏ xếp chồng của bạn chung */}
                            <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                              {mutualList.slice(0, 3).map((mf) => (
                                <img
                                  key={mf.id}
                                  src={mf.avatar}
                                  alt={mf.name}
                                  title={mf.name}
                                  className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-white"
                                />
                              ))}
                            </div>

                            {/* Tên hiển thị bạn chung lần lượt */}
                            <p className="text-[10px] text-slate-500 truncate leading-tight">
                              {mutualCount === 1 ? (
                                <>Bạn chung: <span className="font-semibold text-slate-700">{mutualList[0].name}</span></>
                              ) : mutualCount === 2 ? (
                                <>Bạn chung: <span className="font-semibold text-slate-700">{mutualList[0].name}</span>, <span className="font-semibold text-slate-700">{mutualList[1].name}</span></>
                              ) : (
                                <><span className="font-bold text-blue-600">{mutualCount} bạn chung</span> ({mutualList[0].name}, {mutualList[1].name}...)</>
                              )}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            Gợi ý dành cho bạn
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleFollowFriend(friend.id)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 transition cursor-pointer ${
                        friend.requestSent 
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs hover:shadow-xs'
                      }`}
                    >
                      {friend.requestSent ? 'Đã gửi' : 'Kết bạn'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chủ đề thịnh hành */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-rose-500" />
              <span>Chủ đề thịnh hành</span>
            </h3>

            <div className="space-y-3">
              {trendingTopics.map((topic, index) => (
                <div key={index} className="group cursor-pointer">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{topic.category}</span>
                    <span className="text-[10px]">Thịnh hành</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition">
                    {topic.tag}
                  </p>
                  <p className="text-[10px] text-slate-400">{topic.posts}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer thông tin bài tập lớn / dự án */}
          <div className="px-2 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-500">Mạng xã hội BTL Project 1</p>
            <p>© 2026 NexusSocial • React 19 & Tailwind CSS</p>
          </div>

        </aside>

      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Check, User, Sparkles, MessageCircle } from 'lucide-react';
import { REACTIONS } from '../utils/reactionLogic';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { suggestedFriends } from '../data/mockData';

// Danh sách người dùng phong phú cho dữ liệu mô phỏng fallback
const MOCK_REACTORS_POOL = [
  { id: 'usr-1', name: 'Lê Thu Trang', username: 'thutrang.le', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80', mutual: 4 },
  { id: 'usr-2', name: 'Hoàng Tuấn Kiệt', username: 'kiethoang.dev', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80', mutual: 3 },
  { id: 'usr-3', name: 'Phạm Hải Yến', username: 'haiyen.pham', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80', mutual: 5 },
  { id: 'usr-4', name: 'Đỗ Phương Thảo', username: 'thaodo.99', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80', mutual: 2 },
  { id: 'usr-5', name: 'Hoàng Minh Đức', username: 'duc.hoang', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80', mutual: 1 },
  { id: 'usr-6', name: 'Đặng Thảo Vy', username: 'vyvy.dang', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80', mutual: 6 },
  { id: 'usr-7', name: 'Nguyễn Thanh Tùng', username: 'tung.nguyen', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80', mutual: 0 },
  { id: 'usr-8', name: 'Trần Bảo Ngọc', username: 'ngocbao_tran', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80', mutual: 2 },
];

export default function PostReactionsModal({
  isOpen,
  onClose,
  postId,
  post,
  currentUser,
  onOpenProfile,
  onRequireAuth,
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [reactors, setReactors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [friendStatuses, setFriendStatuses] = useState({});

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    fetch(`${API_URL}/api/posts/${postId}/reactions`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setReactors(data.data);
        } else {
          // Tạo danh sách mô phỏng tự nhiên dựa trên reactionCounts của bài viết
          const fallbackReactors = buildFallbackReactors(post, currentUser);
          setReactors(fallbackReactors);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const fallbackReactors = buildFallbackReactors(post, currentUser);
        setReactors(fallbackReactors);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, postId, post?.id, post?.myReaction, currentUser?.id]);

  // Phân nhóm reactors theo cảm xúc
  const reactorsByTab = useMemo(() => {
    if (activeTab === 'all') return reactors;
    return reactors.filter(r => r.reactionType === activeTab);
  }, [reactors, activeTab]);

  // Đếm số lượng từng loại cảm xúc
  const reactionCountsMap = useMemo(() => {
    const counts = { all: reactors.length };
    reactors.forEach(r => {
      counts[r.reactionType] = (counts[r.reactionType] || 0) + 1;
    });
    return counts;
  }, [reactors]);

  // Toggle kết bạn trực tiếp trên modal
  const handleToggleAddFriend = (userId) => {
    if (!currentUser && onRequireAuth) {
      onRequireAuth('Vui lòng đăng nhập để gửi lời mời kết bạn');
      return;
    }
    setFriendStatuses(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col max-h-[82vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Người đã bày tỏ cảm xúc
            </span>
            <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-full">
              {reactors.length}
            </span>
          </div>
          <button
            onClick={onClose}
            title="Đóng cửa sổ"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reaction Filter Tabs */}
        <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
            }`}
          >
            <span>Tất cả</span>
            <span>{reactors.length}</span>
          </button>

          {REACTIONS.map((r) => {
            const count = reactionCountsMap[r.id] || 0;
            if (count === 0 && !post?.reactionCounts?.[r.id]) return null;
            return (
              <button
                key={r.id}
                onClick={() => setActiveTab(r.id)}
                className={`px-2.5 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === r.id
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
                }`}
              >
                <span className="text-sm leading-none">{r.emoji}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Danh sách người tương tác */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-slate-800/60">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3.5 p-2 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-36" />
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded w-24" />
                  </div>
                  <div className="w-20 h-7 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
                </div>
              ))}
            </div>
          ) : reactorsByTab.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-xs">Chưa có người nào bày tỏ cảm xúc này.</p>
            </div>
          ) : (
            reactorsByTab.map((reactor) => {
              const reactionObj = REACTIONS.find(r => r.id === reactor.reactionType) || REACTIONS[0];
              const isMe = currentUser?.id && String(reactor.userId) === String(currentUser.id);
              const isAdded = friendStatuses[reactor.userId];

              return (
                <div
                  key={`${reactor.userId}-${reactor.reactionType}`}
                  className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 rounded-2xl transition duration-150"
                >
                  {/* Avatar và Huy hiệu Cảm xúc ở góc */}
                  <div 
                    onClick={() => {
                      if (onOpenProfile) onOpenProfile({ id: reactor.userId, name: reactor.name, avatar: reactor.avatar });
                      onClose();
                    }}
                    className="flex items-center gap-3.5 min-w-0 cursor-pointer group"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={reactor.avatar || DEFAULT_AVATAR}
                        alt={reactor.name}
                        onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 group-hover:ring-blue-400 transition"
                      />
                      {/* Huy hiệu emote góc avatar */}
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xs shadow-xs ring-1 ring-white dark:ring-slate-800">
                        {reactionObj.emoji}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition truncate">
                          {reactor.name}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded">
                            Bạn
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                        {reactor.username ? `@${reactor.username}` : (reactor.mutual ? `${reactor.mutual} bạn chung` : 'Thành viên WINGS')}
                      </p>
                    </div>
                  </div>

                  {/* Nút thao tác nhanh */}
                  {!isMe && (
                    <div className="shrink-0">
                      <button
                        onClick={() => handleToggleAddFriend(reactor.userId)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs ${
                          isAdded
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            : 'bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Đã gửi</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Kết bạn</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Hàm khởi tạo danh sách người dùng tương tác tự nhiên dựa trên thông tin bài viết
function buildFallbackReactors(post, currentUser) {
  const result = [];
  const assignedIds = new Set();

  // 1. Nếu người dùng hiện tại đã thả cảm xúc vào bài
  if (currentUser?.id && (post?.myReaction || post?.isLiked)) {
    const userReaction = post.myReaction || 'like';
    result.push({
      userId: currentUser.id,
      name: currentUser.name || 'Bạn',
      username: currentUser.username || 'current_user',
      avatar: currentUser.avatar || DEFAULT_AVATAR,
      reactionType: userReaction,
      createdAt: new Date().toISOString()
    });
    assignedIds.add(String(currentUser.id));
  }

  // 2. Lấy tác giả các bình luận trong bài viết (những người hay tương tác bài này)
  if (Array.isArray(post?.comments)) {
    post.comments.forEach((cmt, idx) => {
      if (cmt.author?.id && !assignedIds.has(String(cmt.author.id))) {
        const types = ['love', 'like', 'haha', 'wow'];
        const rType = types[idx % types.length];
        result.push({
          userId: cmt.author.id,
          name: cmt.author.name,
          username: cmt.author.username || `user_${idx + 1}`,
          avatar: cmt.author.avatar || DEFAULT_AVATAR,
          reactionType: rType,
          createdAt: new Date().toISOString()
        });
        assignedIds.add(String(cmt.author.id));
      }
    });
  }

  // 3. Bổ sung từ danh sách người dùng mẫu phong phú
  const reactionPool = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
  let poolIdx = 0;

  for (const poolUser of MOCK_REACTORS_POOL) {
    if (!assignedIds.has(String(poolUser.id)) && result.length < 12) {
      const reactionType = reactionPool[poolIdx % reactionPool.length];
      poolIdx++;
      result.push({
        userId: poolUser.id,
        name: poolUser.name,
        username: poolUser.username,
        avatar: poolUser.avatar,
        mutual: poolUser.mutual,
        reactionType,
        createdAt: new Date().toISOString()
      });
      assignedIds.add(String(poolUser.id));
    }
  }

  return result;
}

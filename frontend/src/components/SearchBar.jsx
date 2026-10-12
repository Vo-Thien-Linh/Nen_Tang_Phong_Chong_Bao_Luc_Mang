import { useState, useEffect, useRef } from 'react';
import { 
  Search, X, Clock, TrendingUp, User, FileText, 
  Loader2, ArrowRight, CornerDownLeft, Sparkles, Check
} from 'lucide-react';
import { searchService } from '../services/searchService';
import { DEFAULT_AVATAR } from '../constants/defaults';

const RECENT_SEARCHES_KEY = 'wings_recent_searches';
const TRENDING_TOPICS = [
  '#WINGS',
  '#AIModeration',
  '#BTLProject',
  '#SinhVienKhoaHoc',
  '#React19'
];

export default function SearchBar({
  onOpenProfile,
  onSearchPosts,
  clientPosts = [],
  activeFilterQuery = '',
  onClearFilter
}) {
  const [inputValue, setInputValue] = useState(activeFilterQuery || '');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState({ users: [], posts: [] });
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : ['Phòng chống bạo lực mạng', 'Lê Thu Trang', '#WINGS'];
    } catch {
      return ['Lê Thu Trang', '#WINGS'];
    }
  });

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Đồng bộ khi activeFilterQuery bên ngoài thay đổi
  useEffect(() => {
    if (activeFilterQuery !== undefined) {
      setInputValue(activeFilterQuery);
    }
  }, [activeFilterQuery]);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search khi gõ từ khóa
  useEffect(() => {
    const q = inputValue.trim();
    if (!q) {
      setResults({ users: [], posts: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchService.search(q, 'all', 6);
        
        // Tìm kiếm bổ sung trong clientPosts (nếu bài viết chưa có trên DB)
        const localMatchedPosts = clientPosts
          .filter(p => {
            if (!p || p.isHidden) return false;
            const content = (p.content || '').toLowerCase();
            const author = (p.author?.name || '').toLowerCase();
            return content.includes(q.toLowerCase()) || author.includes(q.toLowerCase());
          })
          .map(p => ({
            id: p.id,
            content: p.content,
            imageUrl: p.imageUrl,
            createdAt: p.createdAt || p.time,
            likesCount: p.likesCount || (p.likes || []).length || 0,
            commentsCount: p.commentsCount || (p.comments || []).length || 0,
            author: {
              id: p.author?.id,
              name: p.author?.name || 'Thành viên WINGS',
              username: p.author?.username || 'user',
              avatar: p.author?.avatar || DEFAULT_AVATAR
            }
          }));

        // Gộp bài viết từ server và local (tránh trùng id)
        const mergedPosts = [...(data.posts || [])];
        for (const lp of localMatchedPosts) {
          if (!mergedPosts.some(mp => String(mp.id) === String(lp.id))) {
            mergedPosts.push(lp);
          }
        }

        setResults({
          users: data.users || [],
          posts: mergedPosts.slice(0, 5)
        });
      } catch (err) {
        console.warn('Lỗi tìm kiếm:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inputValue, clientPosts]);

  // Lưu lịch sử tìm kiếm vào localStorage
  const saveRecentSearch = (term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(t => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });
  };

  // Xóa 1 mục khỏi lịch sử
  const removeRecentSearch = (e, term) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(t => t !== term);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn(err);
      }
      return updated;
    });
  };

  // Xóa toàn bộ lịch sử
  const clearAllRecent = (e) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (err) {
      console.warn(err);
    }
  };

  // Khi submit tìm kiếm (Enter hoặc nút Xem tất cả)
  const handleSubmit = (e) => {
    e?.preventDefault();
    const term = inputValue.trim();
    if (!term) return;
    saveRecentSearch(term);
    setIsOpen(false);
    onSearchPosts && onSearchPosts(term);
  };

  // Chọn 1 người dùng từ kết quả
  const handleSelectUser = (user) => {
    saveRecentSearch(user.name);
    setIsOpen(false);
    onOpenProfile && onOpenProfile(user);
  };

  // Chọn 1 bài viết từ kết quả
  const handleSelectPost = (post) => {
    saveRecentSearch(post.content.slice(0, 30));
    setIsOpen(false);
    onSearchPosts && onSearchPosts(post.content.slice(0, 20));
  };

  // Chọn một mục lịch sử hoặc hashtag
  const handleSelectTerm = (term) => {
    setInputValue(term);
    saveRecentSearch(term);
    onSearchPosts && onSearchPosts(term);
    setIsOpen(false);
  };

  const handleClearInput = () => {
    setInputValue('');
    onClearFilter && onClearFilter();
    inputRef.current?.focus();
  };

  const hasResults = results.users.length > 0 || results.posts.length > 0;
  const isTyping = inputValue.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
      {/* Ô nhập tìm kiếm */}
      <form onSubmit={handleSubmit} className="relative w-full flex items-center">
        <Search className={`absolute left-3.5 w-4 h-4 transition-colors pointer-events-none ${
          isOpen ? 'text-blue-600' : 'text-slate-400'
        }`} />

        <input 
          ref={inputRef}
          type="text" 
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Tìm kiếm bạn bè, bài viết..."
          className="w-full pl-9 pr-9 py-2 bg-slate-100 hover:bg-slate-200/60 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 rounded-full border border-transparent focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition duration-200"
        />

        {isLoading ? (
          <Loader2 className="absolute right-3.5 w-4 h-4 text-blue-500 animate-spin" />
        ) : inputValue ? (
          <button
            type="button"
            onClick={handleClearInput}
            className="absolute right-3 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition cursor-pointer"
            title="Xóa nội dung"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </form>

      {/* ================= DROPDOWN KẾT QUẢ TÌM KIẾM ================= */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-full min-w-[300px] sm:min-w-[360px] md:min-w-[400px] bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden divide-y divide-slate-100 animate-fadeIn">
          
          {/* TRƯỜNG HỢP 1: ĐANG GÕ VÀ CÓ KẾT QUẢ TÌM KIẾM */}
          {isTyping ? (
            <div className="max-h-[75vh] overflow-y-auto overscroll-contain">
              
              {/* Nhóm 1: Người dùng & Bạn bè */}
              {results.users.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      Mọi người ({results.users.length})
                    </span>
                  </div>

                  <div className="space-y-1">
                    {results.users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-blue-50/70 transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img 
                            src={user.avatar || DEFAULT_AVATAR} 
                            alt={user.name} 
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100 group-hover:ring-blue-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition">
                              {user.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate">
                              @{user.username} {user.bio ? `• ${user.bio}` : ''}
                            </p>
                          </div>
                        </div>

                        {user.is_friend && (
                          <span className="px-2 py-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-md border border-blue-200 shrink-0 ml-2">
                            Bạn bè
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nhóm 2: Bài viết phù hợp */}
              {results.posts.length > 0 && (
                <div className="p-3 border-t border-slate-100">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      Bài viết ({results.posts.length})
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {results.posts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => handleSelectPost(post)}
                        className="p-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer group border border-transparent hover:border-slate-200"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <img 
                            src={post.author?.avatar || DEFAULT_AVATAR} 
                            alt="" 
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span className="text-xs font-bold text-slate-700 truncate">
                            {post.author?.name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed group-hover:text-blue-700 transition">
                          {post.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Không tìm thấy kết quả nào */}
              {!isLoading && !hasResults && (
                <div className="p-6 text-center space-y-2 text-slate-500">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    Không tìm thấy kết quả cho "{inputValue}"
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Thử tìm với họ tên khác hoặc từ khóa ngắn gọn hơn.
                  </p>
                </div>
              )}

              {/* Nút xem tất cả / lọc trên bảng tin */}
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full p-3 bg-slate-50 hover:bg-blue-50 text-blue-600 text-xs font-bold transition flex items-center justify-center gap-2 border-t border-slate-100 cursor-pointer"
              >
                <span>Xem tất cả kết quả cho "{inputValue}"</span>
                <CornerDownLeft className="w-3.5 h-3.5 text-blue-500" />
              </button>
            </div>
          ) : (
            
            /* TRƯỜNG HỢP 2: CHƯA GÕ (HIỂN THỊ LỊCH SỬ TÌM KIẾM & CHỦ ĐỀ THỊNH HÀNH) */
            <div className="p-3 space-y-4">
              
              {/* Lịch sử tìm kiếm gần đây */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2 mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Tìm kiếm gần đây
                    </span>
                    <button
                      type="button"
                      onClick={clearAllRecent}
                      className="text-[11px] text-slate-400 hover:text-blue-600 font-medium transition cursor-pointer"
                    >
                      Xóa tất cả
                    </button>
                  </div>

                  <div className="space-y-0.5">
                    {recentSearches.map((term, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectTerm(term)}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-50 text-xs text-slate-700 transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                          <span className="truncate group-hover:text-blue-600 font-medium">{term}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(e, term)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-200/60 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          title="Xóa mục này"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chủ đề thịnh hành / Gợi ý */}
              <div>
                <div className="px-2 mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                    Chủ đề thịnh hành
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 px-1">
                  {TRENDING_TOPICS.map((topic, tIdx) => (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={() => handleSelectTerm(topic)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-full text-xs font-semibold border border-transparent hover:border-blue-200 transition cursor-pointer"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
}

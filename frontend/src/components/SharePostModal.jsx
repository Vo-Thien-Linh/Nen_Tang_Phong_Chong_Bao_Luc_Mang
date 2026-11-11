import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Share2, Loader2, ImageOff, Link, Copy, Check, MessageCircle, 
  Send, Search, Users, ExternalLink, Sparkles, Clock, Layers
} from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { friendService } from '../services/friendService';
import { messageService } from '../services/messageService';
import { createStoryApi } from '../api/client';

// Danh sách phông nền cho Chia sẻ lên Tin (Story)
const STORY_GRADIENT_OPTIONS = [
  { id: 'insta-pink', label: 'Tím hồng', bg: 'linear-gradient(135deg, #8a2387 0%, #e94057 50%, #f27121 100%)' },
  { id: 'fb-blue', label: 'Xanh dương', bg: 'linear-gradient(135deg, #0064e0 0%, #00b4d8 100%)' },
  { id: 'sunset', label: 'Hoàng hôn', bg: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)' },
  { id: 'dark-slate', label: 'Đen sang trọng', bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
];

/**
 * SharePostModal — Modal chia sẻ bài viết đa phương thức
 * Hỗ trợ 4 chế độ:
 *   1. 'feed'    — Đăng chia sẻ lên Bảng tin / Trang cá nhân
 *   2. 'story'   — Chia sẻ bài viết lên Tin (Story 24h) của bạn
 *   3. 'message' — Gửi bài viết qua Tin nhắn trực tiếp cho bạn bè
 *   4. 'link'    — Sao chép liên kết bài viết vào Clipboard
 */
export default function SharePostModal({ post, currentUser, onConfirm, onClose }) {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'story' | 'message' | 'link'
  
  // Tab 1: Chia sẻ lên Feed
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  // Tab 2: Chia sẻ lên Story
  const [storyNote, setStoryNote] = useState('');
  const [selectedStoryGradient, setSelectedStoryGradient] = useState(STORY_GRADIENT_OPTIONS[0]);
  const [isSharingToStory, setIsSharingToStory] = useState(false);

  // Tab 3: Gửi tin nhắn cho bạn bè
  const [friends, setFriendsList] = useState([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [messageNote, setMessageNote] = useState('');
  const [sendingStatus, setSendingStatus] = useState({}); // { [friendId]: 'sending' | 'sent' | 'error' }

  // Tab 4: Sao chép liên kết
  const [isCopied, setIsCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Tạo liên kết bài viết chuẩn deep-link
  const postUrl = `${window.location.origin}${window.location.pathname}#post-${post?.id || ''}`;

  // Focus textarea khi mở tab feed
  useEffect(() => {
    if (activeTab === 'feed') {
      textareaRef.current?.focus();
    }
  }, [activeTab]);

  // Đóng modal khi bấm Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting && !isSharingToStory) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSubmitting, isSharingToStory]);

  // Tải danh sách bạn bè khi chuyển sang tab 'message'
  useEffect(() => {
    if (activeTab === 'message' && friends.length === 0) {
      setIsLoadingFriends(true);
      friendService.getFriendsList()
        .then((data) => {
          if (Array.isArray(data)) {
            setFriendsList(data);
          } else if (data?.friends && Array.isArray(data.friends)) {
            setFriendsList(data.friends);
          }
        })
        .catch((err) => {
          console.warn('Lỗi tải danh sách bạn bè:', err.message);
        })
        .finally(() => {
          setIsLoadingFriends(false);
        });
    }
  }, [activeTab, friends.length]);

  // Xử lý gửi chia sẻ lên Feed
  const handleSubmitFeed = async () => {
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await onConfirm(content.trim());
      onClose();
    } catch (err) {
      if (err.name === 'TypeError' && err.message?.includes('Failed to fetch')) {
        setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại dịch vụ Backend.');
      } else {
        setError(err.message || 'Chia sẻ thất bại, vui lòng thử lại');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý chia sẻ bài viết lên Story
  const handleShareToStory = async () => {
    if (isSharingToStory) return;
    setError('');
    setIsSharingToStory(true);
    try {
      const authorName = post?.author?.name || 'thành viên';
      const snippet = (post?.content || '').slice(0, 180);
      const textContent = storyNote.trim() 
        ? `${storyNote.trim()}\n\n[Trích dẫn từ bài viết của ${authorName}]`
        : `Chia sẻ bài viết từ ${authorName}: "${snippet}${snippet.length >= 180 ? '...' : ''}"`;

      await createStoryApi({
        storyType: post?.imageUrl ? 'image' : 'text',
        mediaUrl: post?.imageUrl || null,
        textContent,
        backgroundStyle: {
          background: selectedStoryGradient.bg,
          isSharedPost: true,
          originalPostId: post?.id,
          originalAuthor: authorName,
          originalAvatar: post?.author?.avatar || post?.author?.avatar_url || DEFAULT_AVATAR,
          originalContent: post?.content || '',
        },
        privacy: 'public',
      });

      showToast('Đã chia sẻ bài viết lên Tin của bạn!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Không thể chia sẻ bài viết lên tin');
    } finally {
      setIsSharingToStory(false);
    }
  };

  // Xử lý Ctrl+Enter khi ở tab feed
  const handleKeyDown = (e) => {
    if (activeTab === 'feed' && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmitFeed();
    }
  };

  // Xử lý sao chép liên kết
  const handleCopyLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(postUrl);
      } else {
        const el = document.createElement('textarea');
        el.value = postUrl;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setIsCopied(true);
      showToast('Đã sao chép liên kết bài viết vào bộ nhớ tạm');
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      setError('Không thể sao chép liên kết tự động. Vui lòng copy thủ công.');
    }
  };

  // Xử lý gửi tin nhắn bài viết cho bạn bè
  const handleSendMessageToFriend = async (friend) => {
    const friendId = friend.id;
    if (sendingStatus[friendId] === 'sending' || sendingStatus[friendId] === 'sent') return;

    setSendingStatus(prev => ({ ...prev, [friendId]: 'sending' }));
    try {
      const shareContent = messageNote.trim() 
        ? `${messageNote.trim()}\n\n🔗 ${postUrl}`
        : `Mình chia sẻ bài viết này với bạn:\n\n"${(post?.content || '').slice(0, 100)}${(post?.content || '').length > 100 ? '...' : ''}"\n\n🔗 ${postUrl}`;

      await messageService.sendMessage(friendId, shareContent);
      setSendingStatus(prev => ({ ...prev, [friendId]: 'sent' }));
      showToast(`Đã gửi bài viết tới ${friend.name || friend.username}`);
    } catch (err) {
      setSendingStatus(prev => ({ ...prev, [friendId]: 'error' }));
      showToast(err.message || 'Gửi tin nhắn thất bại, vui lòng thử lại', true);
    }
  };

  const showToast = (msg, isErr = false) => {
    setToastMessage({ text: msg, isError: isErr });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Lọc bạn bè theo từ khóa tìm kiếm
  const filteredFriends = friends.filter(f => {
    if (!friendSearch.trim()) return true;
    const q = friendSearch.toLowerCase();
    return (f.name && f.name.toLowerCase().includes(q)) || 
           (f.username && f.username.toLowerCase().includes(q));
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting && !isSharingToStory) onClose(); }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[92vh] border border-slate-200/80 dark:border-slate-800"
        style={{ animation: 'fadeInScale 0.18s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Chia sẻ bài viết</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Chọn cách thức bạn muốn lan tỏa bài viết này</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thanh chuyển chế độ chia sẻ (4 Tabs hiện đại) */}
        <div className="grid grid-cols-4 p-1.5 mx-4 sm:mx-5 mt-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 gap-1">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 rounded-xl transition cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-bold'
                : 'hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Bảng tin</span>
          </button>

          <button
            onClick={() => setActiveTab('story')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 rounded-xl transition cursor-pointer ${
              activeTab === 'story'
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm font-bold'
                : 'hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-purple-500" />
            <span className="truncate">Lên Tin</span>
          </button>

          <button
            onClick={() => setActiveTab('message')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 rounded-xl transition cursor-pointer ${
              activeTab === 'message'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-bold'
                : 'hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Tin nhắn</span>
          </button>

          <button
            onClick={() => setActiveTab('link')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 rounded-xl transition cursor-pointer ${
              activeTab === 'link'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-bold'
                : 'hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Link className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Sao chép</span>
          </button>
        </div>

        {/* Thông báo Toast nhanh trong modal */}
        {toastMessage && (
          <div className={`mx-5 mt-3 px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 animate-fade-in ${
            toastMessage.isError 
              ? 'bg-rose-50 text-rose-700 border border-rose-200' 
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {toastMessage.isError ? <X className="w-3.5 h-3.5 shrink-0" /> : <Check className="w-3.5 h-3.5 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Nội dung theo từng Tab */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: CHIA SẺ LÊN BẢNG TIN */}
          {activeTab === 'feed' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-start gap-3">
                <img
                  src={currentUser?.avatar || currentUser?.avatar_url || DEFAULT_AVATAR}
                  alt={currentUser?.name || 'User'}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {currentUser?.name || currentUser?.full_name || 'Người dùng'}
                  </p>
                  <p className="text-xs text-slate-400">Chia sẻ công khai lên Bảng tin của bạn</p>
                </div>
              </div>

              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Hãy viết gì đó về bài viết này..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none"
                />
                <span className="absolute bottom-2.5 right-3 text-[11px] text-slate-400">
                  {content.length}/500
                </span>
              </div>

              {/* Xem trước Thẻ bài viết gốc được nhúng */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850 overflow-hidden shadow-xs">
                <div className="p-3.5 flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800/80">
                  <img
                    src={post?.author?.avatar || post?.author?.avatar_url || DEFAULT_AVATAR}
                    alt={post?.author?.name || 'Tác giả'}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {post?.author?.name || 'Người dùng'}
                    </p>
                    <p className="text-[11px] text-slate-400">Bài viết gốc</p>
                  </div>
                </div>

                {post?.content && (
                  <p className="px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                    {post.content}
                  </p>
                )}

                {post?.imageUrl && (
                  <div className="relative w-full max-h-52 bg-slate-900 overflow-hidden">
                    <img
                      src={post.imageUrl}
                      alt="Ảnh bài viết"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium animate-fade-in flex items-center gap-2">
                  <X className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CHIA SẺ LÊN TIN (STORY 24H) */}
          {activeTab === 'story' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Xem trước Tin của bạn (24h)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Bài viết sẽ hiển thị trên thanh Story của bạn và bạn bè
                  </p>
                </div>
                {/* Chọn phông nền */}
                <div className="flex items-center gap-1.5">
                  {STORY_GRADIENT_OPTIONS.map((grad) => (
                    <button
                      key={grad.id}
                      onClick={() => setSelectedStoryGradient(grad)}
                      style={{ background: grad.bg }}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                        selectedStoryGradient.id === grad.id ? 'scale-125 ring-2 ring-blue-500' : 'hover:scale-110 opacity-80'
                      }`}
                      title={grad.label}
                    />
                  ))}
                </div>
              </div>

              {/* Khung mô phỏng Story dọc */}
              <div 
                style={{ background: selectedStoryGradient.bg }}
                className="w-full max-w-[280px] mx-auto h-[380px] rounded-3xl p-4 shadow-xl flex flex-col justify-between text-white relative overflow-hidden transition-all duration-300"
              >
                {/* Header Story */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    <img
                      src={currentUser?.avatar || currentUser?.avatar_url || DEFAULT_AVATAR}
                      alt="User"
                      className="w-7 h-7 rounded-full object-cover border-2 border-white/80"
                    />
                    <span className="text-xs font-bold drop-shadow-sm">Tin của bạn</span>
                  </div>
                  <span className="text-[10px] bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-full font-medium">
                    24 giờ
                  </span>
                </div>

                {/* Thẻ bài viết trích dẫn mờ kính sang trọng (Instagram Card) */}
                <div className="my-auto bg-black/45 backdrop-blur-md rounded-2xl p-3 border border-white/20 text-white space-y-2 shadow-lg">
                  <div className="flex items-center gap-2">
                    <img
                      src={post?.author?.avatar || post?.author?.avatar_url || DEFAULT_AVATAR}
                      alt="Author"
                      className="w-6 h-6 rounded-full object-cover border border-white/40"
                    />
                    <span className="text-xs font-bold truncate">
                      {post?.author?.name || 'Người dùng'}
                    </span>
                  </div>

                  {post?.content && (
                    <p className="text-xs text-white/90 line-clamp-3 leading-relaxed drop-shadow-xs">
                      {post.content}
                    </p>
                  )}

                  {post?.imageUrl && (
                    <div className="w-full h-28 rounded-xl overflow-hidden bg-black/30">
                      <img
                        src={post.imageUrl}
                        alt="Post media"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Ghi chú thêm vào Story nếu có */}
                {storyNote.trim() && (
                  <div className="text-center z-10">
                    <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-medium text-white shadow-xs">
                      💬 {storyNote}
                    </span>
                  </div>
                )}
              </div>

              {/* Ô nhập ghi chú ngắn */}
              <div className="space-y-1">
                <input
                  type="text"
                  value={storyNote}
                  onChange={(e) => setStoryNote(e.target.value)}
                  placeholder="Thêm cảm nghĩ vào tin (tùy chọn)..."
                  maxLength={100}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium animate-fade-in flex items-center gap-2">
                  <X className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GỬI QUA TIN NHẮN TRỰC TIẾP */}
          {activeTab === 'message' && (
            <div className="space-y-3 animate-fade-in">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Tìm kiếm bạn bè..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
                />
              </div>

              <input
                type="text"
                value={messageNote}
                onChange={(e) => setMessageNote(e.target.value)}
                placeholder="Lời nhắn kèm bài viết (tùy chọn)..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              />

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {isLoadingFriends ? (
                  <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-xs">Đang tải danh sách bạn bè...</span>
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    {friendSearch ? 'Không tìm thấy bạn bè phù hợp' : 'Bạn chưa có bạn bè nào trong danh sách'}
                  </div>
                ) : (
                  filteredFriends.map((f) => {
                    const status = sendingStatus[f.id];
                    return (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={f.avatar || f.avatar_url || DEFAULT_AVATAR}
                            alt={f.name || 'Friend'}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {f.name || f.username}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">@{f.username || 'user'}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={status === 'sending' || status === 'sent'}
                          onClick={() => handleSendMessageToFriend(f)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                            status === 'sent'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 font-bold'
                              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                          }`}
                        >
                          {status === 'sending' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : status === 'sent' ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Đã gửi</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" />
                              <span>Gửi</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SAO CHÉP LIÊN KẾT */}
          {activeTab === 'link' && (
            <div className="space-y-3 animate-fade-in py-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sao chép liên kết trực tiếp để gửi qua Messenger, Zalo, Telegram hoặc bất kỳ đâu.
              </p>
              <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <input
                  type="text"
                  readOnly
                  value={postUrl}
                  className="flex-1 bg-transparent px-2 text-xs text-slate-700 dark:text-slate-300 outline-none select-all font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    isCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/60">
          {activeTab === 'feed' ? (
            <>
              <p className="text-[11px] text-slate-400">
                Nhấn <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 dark:text-slate-400 font-mono text-[10px]">Ctrl+Enter</kbd> để đăng
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  id="share-post-confirm-btn"
                  type="button"
                  onClick={handleSubmitFeed}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang chia sẻ...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>Đăng chia sẻ</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : activeTab === 'story' ? (
            <>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                <span>Tin sẽ tồn tại trong vòng 24 giờ</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSharingToStory}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleShareToStory}
                  disabled={isSharingToStory}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-95 active:scale-95 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSharingToStory ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tạo tin...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Chia sẻ lên Tin</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : activeTab === 'message' ? (
            <>
              <span className="text-[11px] text-slate-400">
                Bài viết sẽ được gửi trực tiếp vào hộp thoại chat
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Xong
              </button>
            </>
          ) : (
            <>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Liên kết mở trực tiếp đến bài viết</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Đóng
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}

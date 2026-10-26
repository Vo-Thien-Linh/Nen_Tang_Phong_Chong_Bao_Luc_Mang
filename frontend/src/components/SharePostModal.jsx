import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Share2, Loader2, ImageOff, Link, Copy, Check, MessageCircle, 
  Send, Search, Users, ExternalLink, Sparkles 
} from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { friendService } from '../services/friendService';
import { messageService } from '../services/messageService';

/**
 * SharePostModal — Modal chia sẻ bài viết đa phương thức
 * Hỗ trợ 3 chế độ:
 *   1. 'feed'    — Đăng chia sẻ lên Bảng tin / Trang cá nhân
 *   2. 'message' — Gửi bài viết qua Tin nhắn trực tiếp cho bạn bè
 *   3. 'link'    — Sao chép liên kết bài viết vào Clipboard
 *
 * Props:
 *   post         — Bài viết gốc cần chia sẻ
 *   currentUser  — Người dùng đang đăng nhập
 *   onConfirm    — async (content: string) => void  — callback gọi API chia sẻ lên feed
 *   onClose      — () => void
 */
export default function SharePostModal({ post, currentUser, onConfirm, onClose }) {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'message' | 'link'
  
  // Tab 1: Chia sẻ lên Feed
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  // Tab 2: Gửi tin nhắn cho bạn bè
  const [friends, setFriendsList] = useState([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [messageNote, setMessageNote] = useState('');
  const [sendingStatus, setSendingStatus] = useState({}); // { [friendId]: 'sending' | 'sent' | 'error' }

  // Tab 3: Sao chép liên kết
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
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
      setError(err.message || 'Chia sẻ thất bại, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
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
        // Fallback cho trình duyệt cũ
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[90vh]"
        style={{ animation: 'fadeInScale 0.18s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Chia sẻ bài viết</h2>
              <p className="text-xs text-slate-500">Chọn cách thức bạn muốn lan tỏa bài viết này</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thanh chuyển chế độ chia sẻ (Tabs) */}
        <div className="grid grid-cols-3 p-1.5 mx-5 mt-3.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600 gap-1">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg transition cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-white text-blue-600 shadow-sm font-bold'
                : 'hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Lên Bảng tin</span>
          </button>

          <button
            onClick={() => setActiveTab('message')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg transition cursor-pointer ${
              activeTab === 'message'
                ? 'bg-white text-blue-600 shadow-sm font-bold'
                : 'hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Gửi tin nhắn</span>
          </button>

          <button
            onClick={() => setActiveTab('link')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg transition cursor-pointer ${
              activeTab === 'link'
                ? 'bg-white text-blue-600 shadow-sm font-bold'
                : 'hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Sao chép link</span>
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
              {/* Người chia sẻ + Textarea */}
              <div className="flex items-start gap-3">
                <img
                  src={currentUser?.avatar || DEFAULT_AVATAR}
                  alt={currentUser?.name || 'Bạn'}
                  className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 mb-1">
                    {currentUser?.name || 'Bạn'}
                  </p>
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Hãy nói gì đó về bài viết này... (tùy chọn)"
                    rows={3}
                    maxLength={500}
                    className="w-full resize-none border border-slate-200 rounded-xl p-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 leading-relaxed transition"
                  />
                  <div className="flex justify-between items-center mt-1">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium transition cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{isCopied ? 'Đã sao chép link' : 'Sao chép link nhanh'}</span>
                    </button>
                    <p className="text-[11px] text-slate-400">{content.length}/500</p>
                  </div>
                </div>
              </div>

              {/* Preview bài gốc */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/80">
                <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
                  <img
                    src={post?.author?.avatar || DEFAULT_AVATAR}
                    alt={post?.author?.name || 'Tác giả'}
                    className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 leading-tight">
                      {post?.author?.name || 'Người dùng'}
                    </p>
                    <p className="text-[11px] text-slate-400">{post?.createdAt || ''}</p>
                  </div>
                </div>

                <div className="px-3.5 pb-3 space-y-2">
                  {post?.content && (
                    <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">
                      {post.content}
                    </p>
                  )}
                  {post?.image && (
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                      <img
                        src={post.image}
                        alt="Ảnh bài viết"
                        className="w-full max-h-36 object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  )}
                  {!post?.content && !post?.image && (
                    <div className="flex items-center gap-2 text-slate-400 py-1">
                      <ImageOff className="w-4 h-4" />
                      <span className="text-xs">Không có nội dung</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GỬI QUA TIN NHẮN BẠN BÈ */}
          {activeTab === 'message' && (
            <div className="space-y-3.5 animate-fade-in">
              {/* Lời nhắn gửi kèm */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Lời nhắn gửi kèm (tùy chọn):
                </label>
                <input
                  type="text"
                  value={messageNote}
                  onChange={(e) => setMessageNote(e.target.value)}
                  placeholder="Xem bài viết này nhé bạn..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Ô tìm kiếm bạn bè */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Tìm bạn bè theo tên hoặc username..."
                  className="w-full pl-8.5 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Danh sách bạn bè */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white">
                {isLoadingFriends ? (
                  <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="text-xs">Đang tải danh sách bạn bè...</span>
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <div className="py-8 px-4 text-center text-slate-400 space-y-1.5">
                    <Users className="w-7 h-7 mx-auto text-slate-300" />
                    <p className="text-xs font-medium text-slate-600">
                      {friendSearch ? 'Không tìm thấy bạn bè phù hợp' : 'Chưa có bạn bè trong danh sách'}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Bạn có thể dùng tính năng Sao chép liên kết để gửi bài viết qua bất kỳ ứng dụng nào khác.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('link')}
                      className="mt-2 text-xs text-blue-600 font-semibold hover:underline inline-block cursor-pointer"
                    >
                      Chuyển sang Sao chép link →
                    </button>
                  </div>
                ) : (
                  filteredFriends.map((friend) => {
                    const status = sendingStatus[friend.id];
                    return (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50/80 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={friend.avatar || DEFAULT_AVATAR}
                            alt={friend.name || friend.username}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {friend.name || friend.username}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              @{friend.username || 'nguoidung'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSendMessageToFriend(friend)}
                          disabled={status === 'sending' || status === 'sent'}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                            status === 'sent'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                              : status === 'sending'
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs active:scale-95'
                          }`}
                        >
                          {status === 'sending' ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Đang gửi...</span>
                            </>
                          ) : status === 'sent' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
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

          {/* TAB 3: SAO CHÉP LIÊN KẾT */}
          {activeTab === 'link' && (
            <div className="space-y-4 animate-fade-in py-1">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-2">
                  <Link className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Liên kết bài viết</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Sao chép liên kết trực tiếp để gửi qua Messenger, Zalo, Telegram hoặc bất kỳ đâu.
                </p>
              </div>

              {/* Hộp chứa link & nút copy */}
              <div className="flex items-center gap-2 p-1.5 border border-slate-200 rounded-xl bg-slate-50/70 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition">
                <input
                  type="text"
                  readOnly
                  value={postUrl}
                  onClick={(e) => e.target.select()}
                  className="flex-1 bg-transparent px-2.5 text-xs text-slate-700 font-mono outline-none truncate select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                    isCopied
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs active:scale-95'
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

              {/* Tóm tắt bài viết được chia sẻ */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Tác giả: {post?.author?.name || 'Người dùng'}</span>
                  <a
                    href={postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 font-medium text-[11px]"
                  >
                    <span>Xem bài viết</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {post?.content && (
                  <p className="text-slate-500 line-clamp-2 text-[11px] italic">
                    "{post.content}"
                  </p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer (Hiển thị phù hợp theo từng tab) */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          {activeTab === 'feed' ? (
            <>
              <p className="text-[11px] text-slate-400">
                Nhấn <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500 font-mono text-[10px]">Ctrl+Enter</kbd> để đăng
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200/60 transition cursor-pointer disabled:opacity-50"
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
          ) : activeTab === 'message' ? (
            <>
              <span className="text-[11px] text-slate-400">
                Bài viết sẽ được gửi trực tiếp vào hộp thoại chat
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
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
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
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

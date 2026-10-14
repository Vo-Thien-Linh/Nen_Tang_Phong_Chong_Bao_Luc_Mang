import { useEffect, useState, useRef } from 'react';
import { 
  X, ExternalLink, ShieldCheck, CheckCircle2, Share2, 
  MessageCircle, ThumbsUp, Send, Loader2, Bookmark
} from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { formatRelativeTime } from '../utils/timeAgo';
import { createComment, updatePostReaction, sharePost, fetchPostById } from '../api/client';
import { 
  REACTIONS, 
  normalizeReactionCounts, 
  getTotalReactionCount, 
  getSummaryReactions, 
  applyReactionState 
} from '../utils/reactionLogic';

export default function OriginalPostModal({ 
  post, 
  isOpen, 
  onClose, 
  currentUser,
  onOpenProfile,
  onOpenLightbox,
  onRequireAuth,
  allPosts = [],
  onUpdatePost
}) {
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [currentReaction, setCurrentReaction] = useState(null);
  const [reactionCounts, setReactionCounts] = useState({});
  const [reactionCount, setReactionCount] = useState(0);
  const [localSharesCount, setLocalSharesCount] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const commentInputRef = useRef(null);

  // Khởi tạo và đồng bộ state khi mở modal với bài viết
  useEffect(() => {
    if (post && isOpen) {
      // 1. Đồng bộ ngay với bài viết có sẵn trên Feed (nếu có)
      const feedMatch = allPosts?.find(p => String(p.id) === String(post.id));
      const source = feedMatch || post;

      const initialComments = source.comments || [];
      setComments(initialComments);
      const initialCounts = normalizeReactionCounts(source.reactionCounts || source.counts);
      setReactionCounts(initialCounts);
      const totalR = getTotalReactionCount(initialCounts) || source.likesCount || source.likes_count || 0;
      setReactionCount(totalR);
      setCurrentReaction(source.myReaction || (source.isLiked ? 'like' : null));
      setLocalSharesCount(source.sharesCount || source.shares_count || 0);

      // 2. Tự động fetch dữ liệu mới nhất từ Server để đồng bộ bình luận và tương tác
      if (post.id) {
        fetchPostById({ postId: post.id, userId: currentUser?.id })
          .then((res) => {
            const apiData = res?.data;
            if (apiData) {
              if (Array.isArray(apiData.comments)) {
                setComments(apiData.comments);
              }
              if (apiData.reactionCounts) {
                const updatedCounts = normalizeReactionCounts(apiData.reactionCounts);
                setReactionCounts(updatedCounts);
                const totalReactions = getTotalReactionCount(updatedCounts) || apiData.likesCount || 0;
                setReactionCount(totalReactions);
              } else if (apiData.likesCount !== undefined) {
                setReactionCount(apiData.likesCount);
              }
              if (apiData.sharesCount !== undefined) {
                setLocalSharesCount(apiData.sharesCount);
              }
              if (apiData.myReaction !== undefined) {
                setCurrentReaction(apiData.myReaction);
              }
            }
          })
          .catch((err) => {
            console.warn("Lỗi fetch chi tiết bài gốc:", err.message);
          });
      }
    }
  }, [post, isOpen, allPosts, currentUser?.id]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !post) return null;

  const authorName = post.author?.name || 'Người dùng';
  const authorAvatar = post.author?.avatar || DEFAULT_AVATAR;
  const timeDisplay = formatRelativeTime(post.createdAt || post.created_at);
  const postImage = post.image || post.imageUrl || post.image_url;
  const activeReactionObj = REACTIONS.find(r => r.id === currentReaction);
  const summaryReactions = getSummaryReactions({ counts: reactionCounts, myReaction: currentReaction });

  // Xử lý Thả cảm xúc
  const handleSelectReaction = async (reactionId) => {
    if (!currentUser) {
      onRequireAuth ? onRequireAuth("Vui lòng đăng nhập để tương tác bài viết") : alert("Vui lòng đăng nhập");
      return;
    }
    const nextReaction = currentReaction === reactionId ? null : reactionId;
    const updated = applyReactionState({
      counts: reactionCounts,
      myReaction: currentReaction,
      nextReaction
    });

    setCurrentReaction(nextReaction);
    setReactionCounts(updated.counts);
    setReactionCount(getTotalReactionCount(updated.counts));
    setShowReactionPicker(false);

    try {
      await updatePostReaction({
        userId: currentUser.id,
        postId: post.id,
        reaction: nextReaction
      });
      if (onUpdatePost) {
        onUpdatePost(post.id, {
          reactionCounts: updated.counts,
          myReaction: nextReaction,
          totalReactions: getTotalReactionCount(updated.counts),
          likesCount: getTotalReactionCount(updated.counts)
        });
      }
    } catch (err) {
      console.error("Lỗi cập nhật cảm xúc bài gốc:", err);
    }
  };

  // Xử lý Gửi bình luận
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed || isSubmittingComment) return;

    if (!currentUser) {
      onRequireAuth ? onRequireAuth("Vui lòng đăng nhập để bình luận") : alert("Vui lòng đăng nhập");
      return;
    }

    setIsSubmittingComment(true);
    try {
      const res = await createComment({
        userId: currentUser.id,
        postId: post.id,
        content: trimmed
      });

      const newComment = res.data || {
        id: `temp-${Date.now()}`,
        author: {
          id: currentUser.id,
          name: currentUser.name || 'Bạn',
          avatar: currentUser.avatar || DEFAULT_AVATAR
        },
        content: trimmed,
        time: 'Vừa xong'
      };

      const updatedList = [...comments, newComment];
      setComments(updatedList);
      setCommentText('');
      if (onUpdatePost) {
        onUpdatePost(post.id, {
          comments: updatedList,
          commentsCount: updatedList.length
        });
      }
    } catch (err) {
      console.error("Lỗi gửi bình luận:", err);
      alert(err.message || "Gửi bình luận thất bại");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Chia sẻ nhanh liên kết
  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.origin);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] relative"
        style={{ animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Toast sao chép */}
        {isCopied && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg font-medium animate-fade-in">
            ✓ Đã sao chép liên kết vào bộ nhớ tạm!
          </div>
        )}

        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Chi tiết bài viết gốc</h3>
              <p className="text-[11px] text-slate-400">Đầy đủ nội dung, cảm xúc & thảo luận</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thân bài viết cuộn độc lập */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          
          {/* Phần 1: Tác giả + Nội dung + Hình ảnh */}
          <div className="p-5 space-y-3.5">
            {/* Tác giả */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={authorAvatar}
                  alt={authorName}
                  onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                  onClick={() => {
                    if (onOpenProfile && post.author) {
                      onClose();
                      onOpenProfile(post.author);
                    }
                  }}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100 cursor-pointer hover:opacity-90 transition shrink-0"
                />
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 
                      onClick={() => {
                        if (onOpenProfile && post.author) {
                          onClose();
                          onOpenProfile(post.author);
                        }
                      }}
                      className="text-sm font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition"
                    >
                      {authorName}
                    </h4>
                    {post.author?.isVerified && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                    {(post.ai_label || post.aiLabel) && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{post.ai_label || post.aiLabel}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{timeDisplay}</span>
                    <span>•</span>
                    <span>Công khai</span>
                  </div>
                </div>
              </div>

              {/* Nút xem trang cá nhân tác giả */}
              {post.author && onOpenProfile && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenProfile(post.author);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition cursor-pointer"
                >
                  <span>Hồ sơ</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Nội dung chữ */}
            {post.content && (
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-words pt-1">
                {post.content}
              </p>
            )}

            {/* Ảnh đính kèm */}
            {postImage && (
              <div 
                onClick={() => {
                  if (onOpenLightbox) {
                    onOpenLightbox(postImage);
                  }
                }}
                className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer group relative"
              >
                <img
                  src={postImage}
                  alt="Ảnh bài viết gốc"
                  className="w-full max-h-[380px] object-cover group-hover:scale-[1.01] transition duration-200"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-slate-900/80 text-white text-xs px-3 py-1.5 rounded-full font-medium transition backdrop-blur-xs">
                    Nhấn để phóng to
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Phần 2: Thống kê tương tác */}
          <div className="px-5 py-2.5 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <div className="flex items-center gap-1.5">
              {reactionCount > 0 ? (
                <>
                  <div className="flex items-center -space-x-1">
                    {summaryReactions.length > 0 ? (
                      summaryReactions.slice(0, 3).map(r => (
                        <span key={r.id} className="text-sm leading-none">{r.emoji}</span>
                      ))
                    ) : (
                      <span className="text-sm leading-none">👍</span>
                    )}
                  </div>
                  <span className="font-medium text-slate-600 ml-1">{reactionCount} lượt tương tác</span>
                </>
              ) : (
                <span>0 cảm xúc</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span>{comments.length > 0 ? comments.length : (post.commentsCount || post.comments_count || 0)} bình luận</span>
              <span>{localSharesCount || post.sharesCount || post.shares_count || 0} chia sẻ</span>
            </div>
          </div>

          {/* Phần 3: Các nút hành động tương tác */}
          <div className="px-3 py-1.5 flex items-center justify-between text-xs font-semibold text-slate-600 relative">
            
            {/* Nút Thích + Picker */}
            <div 
              className="flex-1 relative"
              onMouseEnter={() => setShowReactionPicker(true)}
              onMouseLeave={() => setShowReactionPicker(false)}
            >
              {showReactionPicker && (
                <div className="absolute -top-12 left-2 z-40 bg-white rounded-full px-2.5 py-1.5 shadow-xl border border-slate-200 flex items-center gap-2 animate-fade-in">
                  {REACTIONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleSelectReaction(r.id)}
                      title={r.label}
                      className="text-2xl hover:scale-135 transition-transform duration-150 p-1 cursor-pointer"
                    >
                      {r.emoji}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleSelectReaction(currentReaction || 'like')}
                className={`w-full py-2 flex items-center justify-center gap-2 rounded-xl transition cursor-pointer hover:bg-slate-50 ${
                  activeReactionObj ? `${activeReactionObj.color} font-extrabold` : 'text-slate-600'
                }`}
              >
                {activeReactionObj ? (
                  <>
                    <span className="text-base leading-none">{activeReactionObj.emoji}</span>
                    <span>{activeReactionObj.label}</span>
                  </>
                ) : (
                  <>
                    <ThumbsUp className="w-4 h-4 text-slate-500" />
                    <span>Thích</span>
                  </>
                )}
              </button>
            </div>

            {/* Nút Bình luận */}
            <button
              type="button"
              onClick={() => commentInputRef.current?.focus()}
              className="flex-1 py-2 flex items-center justify-center gap-2 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-slate-500" />
              <span>Bình luận</span>
            </button>

            {/* Nút Chia sẻ */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 py-2 flex items-center justify-center gap-2 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-slate-500" />
              <span>Sao chép link</span>
            </button>
          </div>

          {/* Phần 4: Danh sách bình luận & Form nhập */}
          <div className="p-5 bg-slate-50/60 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 tracking-wide uppercase">
              Bình luận ({comments.length})
            </h4>

            {/* Form nhập bình luận mới */}
            <form onSubmit={handleCommentSubmit} className="flex gap-2.5 items-start">
              <img
                src={currentUser?.avatar || DEFAULT_AVATAR}
                alt={currentUser?.name || 'Bạn'}
                onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200 mt-0.5"
              />
              <div className="flex-1 relative">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={currentUser ? "Viết bình luận công khai..." : "Đăng nhập để bình luận..."}
                  className="w-full pl-3.5 pr-10 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || isSubmittingComment}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:text-blue-700 disabled:opacity-30 disabled:hover:text-blue-600 cursor-pointer"
                  title="Gửi bình luận"
                >
                  {isSubmittingComment ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </form>

            {/* Danh sách bình luận */}
            <div className="space-y-3 pt-1">
              {comments && comments.length > 0 ? (
                comments.map((cmt, idx) => (
                  <div key={cmt.id || idx} className="flex gap-2.5 items-start text-xs animate-fade-in">
                    <img
                      src={cmt.author?.avatar || DEFAULT_AVATAR}
                      alt={cmt.author?.name || 'Người dùng'}
                      onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                      onClick={() => {
                        if (onOpenProfile && cmt.author) {
                          onClose();
                          onOpenProfile(cmt.author);
                        }
                      }}
                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 ring-1 ring-slate-200 cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
                    />
                    <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <span 
                          onClick={() => {
                            if (onOpenProfile && cmt.author) {
                              onClose();
                              onOpenProfile(cmt.author);
                            }
                          }}
                          className="font-bold text-slate-800 hover:text-blue-600 cursor-pointer transition"
                        >
                          {cmt.author?.name || 'Người dùng'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatRelativeTime(cmt.time || cmt.createdAt || cmt.created_at)}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line break-words">
                        {cmt.content}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400">
                  <MessageCircle className="w-8 h-8 mx-auto text-slate-300 mb-1.5" />
                  <p className="text-xs">Chưa có bình luận nào.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Hãy là người đầu tiên thảo luận về bài viết này!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

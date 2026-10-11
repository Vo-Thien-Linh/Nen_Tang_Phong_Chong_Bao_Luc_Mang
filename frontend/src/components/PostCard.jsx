import { useState } from 'react';
import { 
  MessageCircle, Share2, Bookmark, MoreHorizontal, ShieldCheck, 
  CheckCircle2, Send, ThumbsUp, Flag, Scale, ShieldAlert, AlertCircle 
} from 'lucide-react';
import { updatePostReaction } from '../api/client';
import {
  applyReactionCounts,
  applyReactionState,
  getGivenReactionCounts,
  getSummaryReactions,
  normalizeReactionCounts,
  rollbackReactionState,
  REACTIONS,
} from '../utils/reactionLogic';

export default function PostCard({ 
  post, 
  currentUser, 
  onToggleLike, 
  onAddComment,
  onOpenReportModal,
  onOpenAppealModal,
  onRequireLogin
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [currentReaction, setCurrentReaction] = useState(post.myReaction || (post.isLiked ? 'like' : null));
  const [reactionCount, setReactionCount] = useState(post.totalReactions ?? post.likesCount ?? 0);
  const [reactionCounts, setReactionCounts] = useState(() => normalizeReactionCounts(post.reactionCounts || post.counts));
  const [reactionError, setReactionError] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showReactionSummary, setShowReactionSummary] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);

  const handleSelectReaction = async (reactionId = 'like') => {
    setShowReactionPicker(false);
    setReactionError('');

    if (!currentUser?.id) {
      if (onRequireLogin) {
        onRequireLogin();
      }
      return;
    }

    const nextState = applyReactionState({
      currentReaction,
      totalCount: reactionCount,
      selectedReaction: reactionId,
    });

    if (Number.isNaN(Number(post.id))) {
      setCurrentReaction(nextState.myReaction);
      setReactionCount(nextState.totalCount);
      setReactionCounts(applyReactionCounts({
        counts: reactionCounts,
        previousReaction: currentReaction,
        nextReaction: nextState.myReaction,
      }));
      onToggleLike(post.id);
      return;
    }

    const previousReaction = currentReaction;
    const previousCount = reactionCount;
    const previousCounts = reactionCounts;
    const nextCounts = applyReactionCounts({
      counts: reactionCounts,
      previousReaction,
      nextReaction: nextState.myReaction,
    });

    setCurrentReaction(nextState.myReaction);
    setReactionCount(nextState.totalCount);
    setReactionCounts(nextCounts);

    try {
      const result = await updatePostReaction({
        userId: currentUser.id,
        postId: post.id,
        type: reactionId,
      });
      setCurrentReaction(result.data.myReaction);
      setReactionCount(result.data.totalReactions ?? result.data.totalCount);
      setReactionCounts(normalizeReactionCounts(result.data.reactionCounts || result.data.counts));
    } catch (error) {
      const rollbackState = rollbackReactionState({ previousReaction, previousCount, error });
      setCurrentReaction(rollbackState.myReaction);
      setReactionCount(rollbackState.totalCount);
      setReactionCounts(previousCounts);
      setReactionError(rollbackState.errorMessage);
    }
  };

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    onAddComment(post.id, {
      id: `cmt-${Date.now()}`,
      author: {
        name: currentUser.name,
        avatar: currentUser.avatar
      },
      content: commentText.trim(),
      time: "Vừa xong",
      likes: 0
    });

    setCommentText('');
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const getAiBadgeColor = (label) => {
    switch (label) {
      case 'Normal':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Toxic':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Violence':
      case 'Hate Speech':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const activeReactionObj = REACTIONS.find(r => r.id === currentReaction);
  const summaryReactions = getSummaryReactions(reactionCounts);
  const reactionDetails = getGivenReactionCounts(reactionCounts);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs mb-5 overflow-hidden transition-all hover:border-slate-300/80">
      
      {/* Toast thông báo đã sao chép link */}
      {copiedToast && (
        <div className="bg-slate-900 text-white text-xs py-1.5 px-3 text-center transition-all animate-fade-in font-medium">
          Đã sao chép liên kết bài viết vào bộ nhớ tạm!
        </div>
      )}

      {/* Header bài viết */}
      <div className="p-4 sm:p-5 flex items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <img 
            src={post.author.avatar} 
            alt={post.author.name} 
            className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900 hover:text-blue-600 cursor-pointer">
                {post.author.name}
              </h3>
              {post.author.isVerified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>@{post.author.username}</span>
              <span>•</span>
              <span>{post.createdAt}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nhãn AI Moderation */}
          {post.aiStatus && (
            <span 
              title={`Hệ thống AI phân loại: ${post.aiStatus.label} (${(post.aiStatus.confidence * 100).toFixed(0)}%)`}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${getAiBadgeColor(post.aiStatus.label)}`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>{post.aiStatus.label}</span>
            </span>
          )}

          <div className="relative">
            <button 
              onClick={() => setShowPostMenu(!showPostMenu)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              title="Tùy chọn bài viết"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showPostMenu && (
              <div className="absolute right-0 top-8 z-30 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 animate-fade-in text-xs">
                <button
                  onClick={() => {
                    setShowPostMenu(false);
                    if (onOpenReportModal) {
                      onOpenReportModal({
                        targetType: 'post',
                        targetId: post.id,
                        targetAuthor: post.author,
                        contentExcerpt: post.content,
                        aiStatus: post.aiStatus
                      });
                    }
                  }}
                  className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold transition cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Báo cáo bài viết này</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banner AI Warning & Nút Khiếu Nại (Appeal False Positive) */}
      {post.aiStatus && post.aiStatus.label !== 'Normal' && (
        <div className="mx-4 sm:mx-5 mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Bài viết bị AI phân loại là <strong className="font-bold">{post.aiStatus.label}</strong> ({((post.aiStatus.confidence || 0.9) * 100).toFixed(0)}%).
              {post.appeal?.status === 'pending' && " Đang chờ Admin duyệt khiếu nại."}
              {post.appeal?.status === 'approved' && " Đã minh oan: AI phán đoán sai ngữ cảnh!"}
            </span>
          </div>

          {post.appeal?.status === 'pending' ? (
            <span className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 font-bold text-[11px] shrink-0">
              Đang khiếu nại...
            </span>
          ) : post.appeal?.status === 'approved' ? (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[11px] shrink-0">
              Đã minh oan
            </span>
          ) : (
            <button
              onClick={() => onOpenAppealModal && onOpenAppealModal(post)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Khiếu nại AI gắn nhãn sai</span>
            </button>
          )}
        </div>
      )}

      {/* Nội dung bài viết */}
      <div className="px-4 sm:px-5 pb-3">
        {post.moderationStatus && post.moderationStatus !== 'approved' && post.author?.id === currentUser?.id && (
          <span className="mb-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            Trạng thái: {post.moderationStatus}
          </span>
        )}
        <p className="text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-line break-words">
          {post.content}
        </p>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {post.tags.map((tag, idx) => (
              <span key={idx} className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Ảnh bài viết (nếu có) */}
      {post.image && (
        <div className="w-full overflow-hidden bg-slate-900/5 border-y border-slate-100 flex items-center justify-center">
          <img 
            src={post.image} 
            alt="Post media" 
            className="w-full h-auto max-h-[520px] object-cover block"
            loading="lazy"
          />
        </div>
      )}

      {/* Thống kê tương tác cảm xúc */}
      <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs text-slate-400 border-b border-slate-100">
        <div
          className="relative flex items-center gap-1.5"
          onMouseEnter={() => setShowReactionSummary(true)}
          onMouseLeave={() => setShowReactionSummary(false)}
        >
          {summaryReactions.length > 0 && (
            <div className="flex items-center -space-x-1">
              {summaryReactions.map((reaction) => (
                <span
                  key={reaction.id}
                  className="w-4 h-4 rounded-full bg-white flex items-center justify-center text-[10px] shadow-2xs ring-1 ring-white"
                  title={reaction.label}
                >
                  {reaction.emoji}
                </span>
              ))}
            </div>
          )}
          <span className="font-medium text-slate-600 pl-1">
            {reactionCount} cảm xúc
          </span>
          {showReactionSummary && reactionDetails.length > 0 && (
            <div className="absolute left-0 top-6 z-30 min-w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {reactionDetails.map((reaction) => (
                <div key={reaction.id} className="flex items-center justify-between gap-4 px-2 py-1 text-xs text-slate-700">
                  <span className="flex items-center gap-2">
                    <span>{reaction.emoji}</span>
                    <span className="font-semibold">{reaction.label}</span>
                  </span>
                  <span className="font-bold text-slate-900">{reaction.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>{post.comments?.length || 0} bình luận</span>
          <span>{post.sharesCount || 0} chia sẻ</span>
        </div>
      </div>

      {reactionError && (
        <div className="px-4 sm:px-5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border-b border-rose-100">
          {reactionError}
        </div>
      )}

      {/* Các nút hành động tương tác */}
      <div className="px-2 py-1 flex items-center justify-between text-slate-600 relative">
        
        {/* Nút Cảm xúc với Popover 6 loại cảm xúc chuẩn Facebook */}
        <div 
          className="flex-1 relative"
          onMouseEnter={() => setShowReactionPicker(true)}
          onMouseLeave={() => setShowReactionPicker(false)}
        >
          {/* Thanh Popover chọn 6 cảm xúc */}
          {showReactionPicker && (
            <div className="absolute -top-12 left-2 z-30 bg-white rounded-full px-2.5 py-1.5 shadow-xl border border-slate-200 flex items-center gap-2 animate-fade-in">
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
            onClick={() => handleSelectReaction(currentReaction || 'like')}
            className={`w-full py-2 flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 hover:bg-slate-50 cursor-pointer ${
              activeReactionObj ? `${activeReactionObj.color} font-bold` : 'text-slate-600'
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

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex-1 py-2 flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-50 transition duration-150 cursor-pointer"
        >
          <MessageCircle className="w-4 h-4 text-slate-500" />
          <span>Bình luận</span>
        </button>

        <button
          onClick={handleShare}
          className="flex-1 py-2 flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-50 transition duration-150 cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-slate-500" />
          <span>Chia sẻ</span>
        </button>

        <button
          onClick={() => setIsSaved(!isSaved)}
          className={`px-3 py-2 rounded-xl hover:bg-slate-50 transition duration-150 cursor-pointer ${
            isSaved ? 'text-amber-500' : 'text-slate-400'
          }`}
          title={isSaved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-amber-500' : ''}`} />
        </button>
      </div>

      {/* Khu vực bình luận (Hiển thị khi click nút Bình luận hoặc mặc định nếu có bình luận) */}
      {showComments && (
        <div className="px-4 sm:px-5 py-4 bg-slate-50/70 border-t border-slate-100 space-y-3">
          
          {/* Form nhập bình luận mới */}
          <form onSubmit={handleCommentSubmit} className="flex gap-2">
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
            />
            <div className="flex-1 relative">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Viết bình luận công khai..."
                className="w-full pl-3 pr-10 py-1.5 text-xs bg-white border border-slate-200 rounded-full focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:text-blue-700 disabled:opacity-30 disabled:hover:text-blue-600"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Danh sách bình luận */}
          <div className="space-y-2.5 pt-1">
            {post.comments && post.comments.length > 0 ? (
              post.comments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5 items-start text-xs">
                  <img 
                    src={comment.author.avatar} 
                    alt={comment.author.name} 
                    className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                  />
                  <div className="flex-1 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800">{comment.author.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{comment.time}</span>
                        <button
                          onClick={() => onOpenReportModal && onOpenReportModal({
                            targetType: 'comment',
                            targetId: comment.id,
                            targetAuthor: comment.author,
                            contentExcerpt: comment.content
                          })}
                          title="Báo cáo bình luận này"
                          className="text-slate-300 hover:text-rose-500 transition cursor-pointer p-0.5"
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-700">{comment.content}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
            )}
          </div>

        </div>
      )}

    </div>
  );
}

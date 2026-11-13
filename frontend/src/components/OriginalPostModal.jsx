import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ExternalLink, ShieldCheck, CheckCircle2, Share2, 
  MessageCircle, ThumbsUp, Reply, Bookmark,
  Eye, EyeOff, ShieldAlert
} from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { formatRelativeTime } from '../utils/timeAgo';
import { appealCommentModeration, appealPostModeration, createComment, updateCommentReaction, updatePostReaction, sharePost, fetchPostById, uploadPostImage } from '../api/client';
import VerifiedBadge from './VerifiedBadge';
import CommentInputBar from './CommentInputBar';
import CommentReactionButton from './CommentReactionButton';
import { buildCommentTree } from '../utils/commentThreadLogic';
import { getModerationNoticeText, moderationViolationNotice } from '../utils/moderationNoticeLogic';
import { shouldHideContentForViewer } from '../utils/imageModerationReviewLogic';
import { 
  REACTIONS, 
  normalizeReactionCounts, 
  getTotalReactionCount, 
  getSummaryReactions, 
  applyReactionState 
} from '../utils/reactionLogic';
import HashtagText from './HashtagText';

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
  const [postImageModeration, setPostImageModeration] = useState(post?.imageModeration || null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [currentReaction, setCurrentReaction] = useState(null);
  const [reactionCounts, setReactionCounts] = useState({});
  const [reactionCount, setReactionCount] = useState(0);
  const [localSharesCount, setLocalSharesCount] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const commentInputRef = useRef(null);
  const [commentImageFile, setCommentImageFile] = useState(null);
  const [commentImagePreview, setCommentImagePreview] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyImageFile, setReplyImageFile] = useState(null);
  const [replyImagePreview, setReplyImagePreview] = useState('');
  const commentAppealLocksRef = useRef(new Set());
  const [pendingCommentAppealId, setPendingCommentAppealId] = useState(null);
  const [commentAppealError, setCommentAppealError] = useState('');
  const [unblurredComments, setUnblurredComments] = useState({});
  const [postAppealSubmitting, setPostAppealSubmitting] = useState(false);
  const [postAppealError, setPostAppealError] = useState('');
  const postAppealLockRef = useRef(false);

  useEffect(() => {
    setPostImageModeration(post?.imageModeration || null);
  }, [post?.id, post?.imageModeration]);

  const handleImagePostAppeal = async () => {
    if (postAppealLockRef.current) return;
    postAppealLockRef.current = true;
    setPostAppealSubmitting(true);
    setPostAppealError('');
    try {
      const result = await appealPostModeration({ userId: currentUser?.id, postId: post.id });
      const imageModeration = {
        ...postImageModeration,
        status: 'appeal_pending',
        noticeType: 'appeal_pending',
        noticeText: getModerationNoticeText('post', 'appeal_pending'),
        appealedAt: result.data?.appealedAt || new Date().toISOString(),
      };
      setPostImageModeration(imageModeration);
      onUpdatePost?.(post.id, { imageModeration });
    } catch (error) {
      setPostAppealError(error.message || 'Không thể gửi khiếu nại.');
    } finally {
      postAppealLockRef.current = false;
      setPostAppealSubmitting(false);
    }
  };

  const handleImageCommentAppeal = async (comment) => {
    const id = String(comment.id);
    if (commentAppealLocksRef.current.has(id)) return;
    commentAppealLocksRef.current.add(id);
    setPendingCommentAppealId(id);
    setCommentAppealError('');
    try {
      const result = await appealCommentModeration({ userId: currentUser?.id, postId: post.id, commentId: comment.id });
      const imageModeration = { ...comment.imageModeration, status: 'appeal_pending', noticeType: 'appeal_pending', noticeText: getModerationNoticeText('comment', 'appeal_pending'), appealedAt: result.data?.appealedAt || new Date().toISOString() };
      setComments((previous) => previous.map((entry) => String(entry.id) === id ? { ...entry, imageModeration } : entry));
      onUpdatePost?.(post.id, { commentModeration: { id, imageModeration } });
    } catch (error) {
      setCommentAppealError(error.message || 'Không thể gửi khiếu nại.');
    } finally {
      commentAppealLocksRef.current.delete(id);
      setPendingCommentAppealId(null);
    }
  };

  // Khởi tạo và đồng bộ state khi mở modal với bài viết
  useEffect(() => {
    if (post && isOpen) {
      // 1. Đồng bộ ngay với bài viết có sẵn trên Feed (nếu có)
      const feedMatch = allPosts?.find(p => String(p.id) === String(post.id));
      const source = feedMatch || post;

      setPostImageModeration(source.imageModeration || null);
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
              setPostImageModeration(apiData.imageModeration || null);
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
  const originalImageStatus = postImageModeration?.status || post.image_moderation_status;
  const isOriginalPostAuthor = Boolean(currentUser?.id && String(currentUser.id) === String(post.author?.id || post.author_id));
  const hideOriginalPostImage = shouldHideContentForViewer({ isAuthor: isOriginalPostAuthor, status: originalImageStatus, isSensitive: originalImageStatus === 'sensitive' });
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

  const selectModalImage = (e, setFile, setPreview) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh hợp lệ.');
      return;
    }
    setFile(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearModalImage = (setFile, previewUrl, setPreview) => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreview('');
  };

  const submitModalComment = async ({ parentId = null, rawText = '', imageFile = null, onReset }) => {
    const trimmed = String(rawText || '').trim();
    if ((!trimmed && !imageFile) || isSubmittingComment) return;

    if (!currentUser) {
      onRequireAuth ? onRequireAuth("Vui lòng đăng nhập để bình luận") : alert("Vui lòng đăng nhập");
      return;
    }

    setIsSubmittingComment(true);
    let uploadedUrl = null;
    if (imageFile) {
      try {
        uploadedUrl = await uploadPostImage(imageFile);
      } catch (err) {
        console.error('Lỗi tải ảnh bình luận:', err);
        alert('Không thể tải ảnh bình luận lên. Vui lòng thử lại!');
        setIsSubmittingComment(false);
        return;
      }
    }

    try {
      let authorFilterKeywords = post?.author?.filter_keywords || post?.filter_keywords;
      if (!authorFilterKeywords && String(post?.author?.id || post?.author_id) === String(currentUser?.id)) {
        try {
          const localSettings = JSON.parse(localStorage.getItem('nexussocial_user_settings') || '{}');
          if (localSettings.filter_keywords) authorFilterKeywords = localSettings.filter_keywords;
        } catch {}
      }

      const res = await createComment({
        userId: currentUser.id,
        postId: post.id,
        parentId: parentId || null,
        content: trimmed,
        imageUrl: uploadedUrl,
        authorFilterKeywords,
      });

      if (res.nudge) {
        alert(res.message);
        setIsSubmittingComment(false);
        return;
      }

      const isCommentHidden = Boolean(
        res.isAuthorBlacklisted ||
        res.data?.is_hidden || res.data?.isHidden ||
        res.data?.ai_status === 'hidden' || res.data?.aiStatus === 'hidden' ||
        res.data?.ai_label === 'Author Blacklist' || res.data?.aiLabel === 'Author Blacklist'
      );

      if (isCommentHidden) {
        alert(res.message || "Bình luận chứa từ khóa cấm và đã bị ẩn hoàn toàn theo tiêu chuẩn cộng đồng.");
        onReset?.();
        setIsSubmittingComment(false);
        return;
      }

      const newComment = res.data
        ? {
            ...res.data,
            parentId: res.data.parentId ?? res.data.parent_id ?? parentId ?? null,
            parent_id: res.data.parent_id ?? res.data.parentId ?? parentId ?? null,
          }
        : {
            id: `temp-${Date.now()}`,
            parentId: parentId || null,
            parent_id: parentId || null,
            author: {
              id: currentUser.id,
              name: currentUser.name || 'Bạn',
              avatar: currentUser.avatar || DEFAULT_AVATAR
            },
            content: trimmed,
            image: uploadedUrl,
            time: 'Vừa xong',
            createdAt: new Date().toISOString(),
          };

      const updatedList = [...comments, newComment];
      setComments(updatedList);
      onReset?.();
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

  // Xử lý Gửi bình luận gốc
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    await submitModalComment({
      parentId: null,
      rawText: commentText,
      imageFile: commentImageFile,
      onReset: () => {
        setCommentText('');
        clearModalImage(setCommentImageFile, commentImagePreview, setCommentImagePreview);
      },
    });
  };

  // Xử lý Gửi phản hồi bình luận theo cấp
  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyingTo?.id) return;
    await submitModalComment({
      parentId: replyingTo.id,
      rawText: replyText,
      imageFile: replyImageFile,
      onReset: () => {
        setReplyText('');
        setReplyingTo(null);
        clearModalImage(setReplyImageFile, replyImagePreview, setReplyImagePreview);
      },
    });
  };

  // Chia sẻ nhanh liên kết
  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.origin);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const visibleComments = (comments || []).filter((item) => {
    const isHidden = Boolean(
      item.is_hidden || item.isHidden ||
      item.ai_status === 'hidden' || item.aiStatus === 'hidden' ||
      item.ai_label === 'Author Blacklist' || item.aiLabel === 'Author Blacklist'
    );
    const isRejectedFinal = (item.imageModeration?.status || item.image_moderation_status) === 'rejected_final';
    return !isHidden && !isRejectedFinal;
  });

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
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
                    {(post.author?.isVerified || post.author?.is_verified) && (
                      <VerifiedBadge size="sm" />
                    )}
                    {(post.ai_label || post.aiLabel) && !['pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending'].includes(originalImageStatus) && (
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

            {isOriginalPostAuthor && ['rejected_admin', 'appeal_pending', 'pending_review', 'rejected_hold'].includes(originalImageStatus) && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{postImageModeration?.noticeText || getModerationNoticeText('post', originalImageStatus)}</span>
                  {['rejected_admin', 'rejected_hold'].includes(originalImageStatus) && (
                    <button type="button" disabled={postAppealSubmitting} onClick={handleImagePostAppeal} className="rounded-md bg-rose-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
                      {postAppealSubmitting ? 'Đang gửi...' : 'Khiếu nại'}
                    </button>
                  )}
                </div>
                {postAppealError && <p className="mt-1 text-rose-700">{postAppealError}</p>}
              </div>
            )}

            {/* Nội dung chữ */}
            {isOriginalPostAuthor && originalImageStatus === 'sensitive' && (
              <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {postImageModeration?.noticeText || getModerationNoticeText('post', 'sensitive')}
              </div>
            )}
            {post.content && (
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-words pt-1">
                <HashtagText text={post.content} />
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
                  className={`w-full max-h-[380px] object-cover group-hover:scale-[1.01] transition duration-200 ${hideOriginalPostImage ? 'blur-xl scale-105' : ''}`}
                />
                {hideOriginalPostImage && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/60 text-center text-white">
                    <span className="text-xs font-semibold">Nội dung nhạy cảm</span>
                    <span className="rounded bg-white/20 px-3 py-1 text-[10px] font-semibold">Xem</span>
                  </div>
                )}
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
              <span>{visibleComments.length > 0 ? visibleComments.length : (post.commentsCount || post.comments_count || 0)} bình luận</span>
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
              Bình luận ({visibleComments.length})
            </h4>

            {/* Form nhập bình luận mới */}
            <CommentInputBar
              avatar={currentUser?.avatar}
              userName={currentUser?.name || 'Bạn'}
              value={commentText}
              onChange={setCommentText}
              onSubmit={handleCommentSubmit}
              isSubmitting={isSubmittingComment}
              hasContent={Boolean(commentImageFile)}
              imagePreview={commentImagePreview}
              onSelectImageFile={(e) => selectModalImage(e, setCommentImageFile, setCommentImagePreview)}
              onRemoveImage={() => clearModalImage(setCommentImageFile, commentImagePreview, setCommentImagePreview)}
              inputRef={commentInputRef}
              onImageButtonClick={() => {
                if (!currentUser && onRequireAuth) {
                  onRequireAuth("Vui lòng đăng nhập để bình luận");
                  return false;
                }
                return true;
              }}
              placeholder={currentUser ? "Viết bình luận công khai..." : "Đăng nhập để bình luận..."}
            />

            {/* Danh sách bình luận (mới nhất trên cùng, hỗ trợ phân cấp) */}
            <div className="space-y-3 pt-1">
              {(() => {
                const commentTree = buildCommentTree(visibleComments);
                if (commentTree.length === 0) {
                  return (
                    <div className="text-center py-6 text-slate-400">
                      <MessageCircle className="w-8 h-8 mx-auto text-slate-300 mb-1.5" />
                      <p className="text-xs">Chưa có bình luận nào.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Hãy là người đầu tiên thảo luận về bài viết này!</p>
                    </div>
                  );
                }

                const renderModalCommentNode = (cmt, depth = 0) => {
                  const imageStatus = cmt.imageModeration?.status || cmt.image_moderation_status;
                  const isCommentAuthor = Boolean(currentUser?.id && String(currentUser.id) === String(cmt.author?.id || cmt.author_id));
                  const hideCommentImage = shouldHideContentForViewer({ isAuthor: isCommentAuthor, status: imageStatus, isSensitive: ['sensitive', 'rejected_hold', 'rejected_admin', 'pending_review', 'appeal_pending'].includes(imageStatus) });
                  const isReplyingHere = Boolean(replyingTo && String(replyingTo.id) === String(cmt.id));

                  return (
                    <div key={cmt.id} className="space-y-2 animate-fade-in">
                      <div className="flex gap-2.5 items-start text-xs">
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
                          className={`${depth > 0 ? 'w-6 h-6' : 'w-7 h-7'} rounded-full object-cover shrink-0 mt-0.5 ring-1 ring-slate-200 cursor-pointer hover:ring-2 hover:ring-blue-400 transition`}
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
                          {isCommentAuthor && ['rejected_admin', 'appeal_pending', 'pending_review', 'rejected_hold'].includes(imageStatus) && (
                            <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900">
                              <div className="flex items-center justify-between gap-2">
                                <span>{cmt.imageModeration?.noticeText || getModerationNoticeText('comment', imageStatus)}</span>
                                {['rejected_admin', 'rejected_hold'].includes(imageStatus) && <button type="button" disabled={pendingCommentAppealId === String(cmt.id)} onClick={() => handleImageCommentAppeal(cmt)} className="rounded bg-rose-600 px-2.5 py-1 font-semibold text-white disabled:opacity-50">{pendingCommentAppealId === String(cmt.id) ? 'Đang gửi...' : 'Khiếu nại'}</button>}
                              </div>
                              {commentAppealError && <p className="mt-1">{commentAppealError}</p>}
                            </div>
                          )}
                          {isCommentAuthor && imageStatus === 'sensitive' && (
                            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                              {cmt.imageModeration?.noticeText || getModerationNoticeText('comment', 'sensitive')}
                            </div>
                          )}
                          {cmt.content && (
                            <p className="text-slate-700 leading-relaxed whitespace-pre-line break-words">
                              <HashtagText text={cmt.content} />
                            </p>
                          )}

                          {cmt.image && (
                            <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 max-w-xs group">
                              {hideCommentImage && !unblurredComments[cmt.id] ? (
                                <div className="relative">
                                  <img
                                    src={cmt.image}
                                    alt="Bình luận có ảnh"
                                    className="w-full max-h-52 object-cover filter blur-xl select-none scale-105 transition duration-300"
                                  />
                                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-center text-white">
                                    <ShieldAlert className="w-5 h-5 text-amber-400 mb-1" />
                                    <span className="text-[11px] font-semibold">{cmt.imageModeration?.status === 'rejected_hold' ? moderationViolationNotice('comment') : 'Nội dung nhạy cảm'}</span>
                                    <span className="text-[9px] text-slate-200 mb-2">Ảnh này được gắn nhãn nhạy cảm</span>
                                    <button
                                      type="button"
                                      onClick={() => setUnblurredComments(prev => ({ ...prev, [cmt.id]: true }))}
                                      className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-medium backdrop-blur-sm transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <Eye className="w-3 h-3" /> Xem
                                    </button>
                                    {cmt.imageModeration?.status === 'rejected_hold' && cmt.author?.id === currentUser?.id && <button type="button" disabled={pendingCommentAppealId === String(cmt.id)} onClick={() => handleImageCommentAppeal(cmt)} className="mt-1 px-2.5 py-1 bg-rose-500 text-white rounded text-[10px] disabled:opacity-50">Kháng cáo</button>}
                                  </div>
                                </div>
                              ) : (
                                <div className="relative">
                                  <img
                                    src={cmt.image}
                                    alt="Bình luận có ảnh"
                                    className="w-full max-h-52 object-cover rounded-lg cursor-pointer hover:opacity-95 transition"
                                    onClick={() => window.open(cmt.image, '_blank')}
                                  />
                                  {cmt.imageModeration?.status === 'sensitive' && unblurredComments[cmt.id] && (
                                    <button
                                      type="button"
                                      onClick={() => setUnblurredComments(prev => ({ ...prev, [cmt.id]: false }))}
                                      className="absolute top-1.5 right-1.5 px-2 py-0.5 bg-black/60 hover:bg-black/80 text-white rounded text-[9px] flex items-center gap-1 backdrop-blur-xs transition cursor-pointer"
                                      title="Ẩn lại ảnh này"
                                    >
                                      <EyeOff className="w-2.5 h-2.5" /> Ẩn lại
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-3 mt-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500 font-semibold">
                            <CommentReactionButton
                              initialCounts={cmt.reactionCounts || {}}
                              initialMyReaction={cmt.myReaction || null}
                              canReact={Boolean(currentUser?.id)}
                              onRequireAuth={() => onRequireAuth ? onRequireAuth('Vui lòng đăng nhập để thả cảm xúc bình luận') : alert('Vui lòng đăng nhập')}
                              onReact={async ({ type, action }) => {
                                if (Number.isNaN(Number(post.id)) || Number.isNaN(Number(cmt.id))) return null;
                                const result = await updateCommentReaction({
                                  userId: currentUser.id,
                                  postId: post.id,
                                  commentId: cmt.id,
                                  type,
                                  action,
                                });
                                if (result?.data) {
                                  const nextComments = comments.map((item) => (
                                    String(item.id) === String(cmt.id)
                                      ? {
                                          ...item,
                                          reactionCounts: result.data.reactionCounts,
                                          totalReactions: result.data.totalReactions,
                                          myReaction: result.data.myReaction,
                                        }
                                      : item
                                  ));
                                  setComments(nextComments);
                                  onUpdatePost?.(post.id, { comments: nextComments });
                                }
                                return result?.data || null;
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!currentUser && onRequireAuth) {
                                  onRequireAuth("Vui lòng đăng nhập để trả lời bình luận");
                                  return;
                                }
                                setReplyingTo({ id: cmt.id, authorName: cmt.author?.name || 'Người dùng' });
                                setReplyText('');
                              }}
                              className={`inline-flex items-center gap-1 cursor-pointer transition ${
                                isReplyingHere ? 'text-blue-600' : 'hover:text-blue-600'
                              }`}
                            >
                              <Reply className="w-3 h-3" />
                              <span>{isReplyingHere ? 'Đang trả lời...' : 'Trả lời'}</span>
                            </button>
                            {cmt.replies?.length > 0 && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                {cmt.replies.length} phản hồi
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isReplyingHere && (
                        <div className="ml-8 pl-3 border-l-2 border-blue-200">
                          <CommentInputBar
                            compact
                            autoFocus
                            avatar={currentUser?.avatar}
                            userName={currentUser?.name || 'Bạn'}
                            value={replyText}
                            onChange={setReplyText}
                            onSubmit={handleReplySubmit}
                            isSubmitting={isSubmittingComment}
                            hasContent={Boolean(replyImageFile)}
                            imagePreview={replyImagePreview}
                            onSelectImageFile={(e) => selectModalImage(e, setReplyImageFile, setReplyImagePreview)}
                            onRemoveImage={() => clearModalImage(setReplyImageFile, replyImagePreview, setReplyImagePreview)}
                            replyingToName={replyingTo.authorName}
                            onCancelReply={() => {
                              setReplyingTo(null);
                              setReplyText('');
                              clearModalImage(setReplyImageFile, replyImagePreview, setReplyImagePreview);
                            }}
                            placeholder={`Trả lời @${replyingTo.authorName}...`}
                          />
                        </div>
                      )}

                      {Array.isArray(cmt.replies) && cmt.replies.length > 0 && (
                        <div className={`${depth < 2 ? 'ml-7 pl-3 border-l-2 border-slate-200' : ''} space-y-2`}>
                          {cmt.replies.map((reply) => renderModalCommentNode(reply, depth + 1))}
                        </div>
                      )}
                    </div>
                  );
                };

                return commentTree.map((root) => renderModalCommentNode(root, 0));
              })()}
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
    </div>,
    document.body
  );
}

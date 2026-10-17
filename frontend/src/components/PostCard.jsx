import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  MessageCircle, Share2, Bookmark, MoreHorizontal, ShieldCheck, 
  CheckCircle2, Send, ThumbsUp, Flag, Scale, ShieldAlert, AlertCircle, Pencil, Trash2, ExternalLink,
  Image as ImageIcon, X, Eye, EyeOff, Loader2
} from 'lucide-react';
import { appealCommentModeration, appealPostModeration, sharePost, updatePostReaction, uploadPostImage } from '../api/client';
import {
  applyReactionCounts,
  applyReactionState,
  getSummaryReactions,
  getTotalReactionCount,
  normalizeReactionCounts,
  rollbackReactionState,
  REACTIONS,
} from '../utils/reactionLogic';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { computeMeasuredPopoverPlacement } from '../utils/popoverLogic';
import { canDeletePost, canEditPost, canReportPost } from '../utils/postActionLogic';
import { moderationViolationNotice } from '../utils/moderationNoticeLogic';
import { shouldClosePostMenuForPointer } from '../utils/menuLogic';
import EditPostModal from './EditPostModal';
import DeletePostModal from './DeletePostModal';
import InlineNotice from './InlineNotice';
import VerifiedBadge from './VerifiedBadge';
import SharePostModal from './SharePostModal';
import OriginalPostModal from './OriginalPostModal';
import { formatRelativeTime } from '../utils/timeAgo';

function PortalPopover({ anchorRef, open, children, className = '', gap = 8, onRequestClose, onMouseEnter, onMouseLeave }) {
  const popoverRef = useRef(null);
  const [style, setStyle] = useState({ position: 'fixed', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none' });
  const [placement, setPlacement] = useState('top');

  useLayoutEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;

      const next = computeMeasuredPopoverPlacement({
        anchorRect: anchor.getBoundingClientRect(),
        popoverSize: popover.getBoundingClientRect(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        gap,
      });

      if (!next.ready) {
        setStyle({ position: 'fixed', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none' });
        return;
      }

      setPlacement(next.placement);
      setStyle({
        position: 'fixed',
        top: `${next.top}px`,
        left: `${next.left}px`,
        visibility: 'visible',
        pointerEvents: 'auto',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition, { passive: true });
    window.addEventListener('scroll', updatePosition, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, children, gap, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onRequestClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onRequestClose, open]);

  if (!open) return null;

  return createPortal(
    <div 
      ref={popoverRef} 
      style={style} 
      className={`z-50 ${className}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Cầu nối vô hình giúp con trỏ chuột di chuyển qua khoảng cách gap giữa nút và thanh cảm xúc mà không bị mất hover */}
      <div 
        className={`absolute inset-x-0 pointer-events-auto ${placement === 'bottom' ? '-top-3.5 h-4' : '-bottom-3.5 h-4'}`}
        aria-hidden="true" 
      />
      {children}
    </div>,
    document.body
  );
}


export default function PostCard({ 
  post, 
  currentUser, 
  onToggleLike, 
  onAddComment,
  onOpenReportModal,
  onOpenAppealModal,
  onRequireAuth,
  onRequireLogin,
  onOpenProfile,
  onEditPost,
  onDeletePost,
  openPostMenuId,
  onTogglePostMenu,
  onClosePostMenu,
  onDismissNotice,
  onSharePost,
  allPosts = [],
  onUpdatePost
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentImageFile, setCommentImageFile] = useState(null);
  const [commentImagePreview, setCommentImagePreview] = useState('');
  const [isUploadingCommentImage, setIsUploadingCommentImage] = useState(false);
  const [unblurredComments, setUnblurredComments] = useState({});
  const [unblurredPosts, setUnblurredPosts] = useState({});
  const [revealedComments, setRevealedComments] = useState({});
  const isBanned = currentUser?.status === 'banned';
  const isCooldown = currentUser?.status === 'cooldown' && currentUser?.cooldown_until && new Date(currentUser.cooldown_until) > new Date();
  const commentFileInputRef = useRef(null);
  const commentSubmitLockRef = useRef(false);
  useEffect(() => {
    if (post.imageModeration?.status !== 'rejected_hold' || holdRemaining == null) return undefined;
    const timer = setInterval(() => setHoldRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [post.imageModeration?.status, holdRemaining]);
  const handleModerationAppeal = async () => {
    await appealPostModeration({ userId: currentUser?.id, postId: post.id });
    onUpdatePost?.(post.id, { imageModeration: { ...post.imageModeration, status: 'pending_review', moderationExpiresAt: null, remainingSeconds: null } });
  };

  const handleCommentImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh hợp lệ.');
      return;
    }
    setCommentImageFile(file);
    setCommentImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveCommentImage = () => {
    setCommentImageFile(null);
    if (commentImagePreview) {
      URL.revokeObjectURL(commentImagePreview);
    }
    setCommentImagePreview('');
    if (commentFileInputRef.current) {
      commentFileInputRef.current.value = '';
    }
  };
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [currentReaction, setCurrentReaction] = useState(post.myReaction || (post.isLiked ? 'like' : null));
  const [reactionCounts, setReactionCounts] = useState(() => normalizeReactionCounts(post.reactionCounts || post.counts));
  const [reactionCount, setReactionCount] = useState(() => {
    const totalFromCounts = getTotalReactionCount(post.reactionCounts || post.counts);
    return totalFromCounts || post.totalReactions || post.likesCount || 0;
  });
  const [reactionError, setReactionError] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showReactionSummary, setShowReactionSummary] = useState(false);
  const [localShowPostMenu, setLocalShowPostMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showOriginalModal, setShowOriginalModal] = useState(false);
  const [localSharesCount, setLocalSharesCount] = useState(post.sharesCount || 0);
  const [postError, setPostError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const reactionSummaryRef = useRef(null);

  const reactionPickerRef = useRef(null);
  const reactionPickerTimeoutRef = useRef(null);

  const handleOpenReactionPicker = useCallback(() => {
    if (reactionPickerTimeoutRef.current) {
      clearTimeout(reactionPickerTimeoutRef.current);
      reactionPickerTimeoutRef.current = null;
    }
    setShowReactionPicker(true);
  }, []);

  const handleCloseReactionPicker = useCallback((delay = 350) => {
    if (reactionPickerTimeoutRef.current) {
      clearTimeout(reactionPickerTimeoutRef.current);
    }
    reactionPickerTimeoutRef.current = setTimeout(() => {
      setShowReactionPicker(false);
      reactionPickerTimeoutRef.current = null;
    }, delay);
  }, []);

  useEffect(() => {
    return () => {
      if (reactionPickerTimeoutRef.current) {
        clearTimeout(reactionPickerTimeoutRef.current);
      }
    };
  }, []);

  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const usesSharedMenuState = openPostMenuId !== undefined && onTogglePostMenu && onClosePostMenu;
  const showPostMenu = usesSharedMenuState
    ? String(openPostMenuId || '') === String(post.id)
    : localShowPostMenu;
  const allowEdit = canEditPost(post, currentUser);
  const allowDelete = canDeletePost(post, currentUser);
  const allowReport = canReportPost(post, currentUser);

  const closePostMenu = useCallback(() => {
    if (usesSharedMenuState) onClosePostMenu();
    else setLocalShowPostMenu(false);
  }, [onClosePostMenu, usesSharedMenuState]);

  const togglePostMenu = useCallback(() => {
    if (usesSharedMenuState) onTogglePostMenu(post.id);
    else setLocalShowPostMenu((value) => !value);
  }, [onTogglePostMenu, post.id, usesSharedMenuState]);

  useEffect(() => {
    if (!showPostMenu) return undefined;

    const handlePointerDown = (event) => {
      if (shouldClosePostMenuForPointer({
        target: event.target,
        menuElement: menuRef.current,
        triggerElement: menuButtonRef.current,
      })) {
        closePostMenu();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closePostMenu();
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePostMenu, showPostMenu]);

  useEffect(() => {
    setCurrentReaction(post.myReaction || (post.isLiked ? 'like' : null));
  }, [post.myReaction, post.isLiked]);

  useEffect(() => {
    if (post.reactionCounts || post.counts) {
      const counts = normalizeReactionCounts(post.reactionCounts || post.counts);
      setReactionCounts(counts);
      setReactionCount(getTotalReactionCount(counts) || post.totalReactions || post.likesCount || 0);
    }
  }, [post.reactionCounts, post.counts, post.totalReactions, post.likesCount]);

  const handleSelectReaction = async (reactionId = 'like') => {
    if (reactionPickerTimeoutRef.current) {
      clearTimeout(reactionPickerTimeoutRef.current);
      reactionPickerTimeoutRef.current = null;
    }
    setShowReactionPicker(false);
    setReactionError('');


    if (!currentUser?.id) {
      if (onRequireAuth) {
        onRequireAuth("Vui lòng đăng nhập để tương tác bài viết");
      } else if (onRequireLogin) {
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
      // Chỉ toggle like khi thay đổi giữa trạng thái (chưa thả <-> đã thả)
      if ((!currentReaction && nextState.myReaction) || (currentReaction && !nextState.myReaction)) {
        onToggleLike && onToggleLike(post.id);
      }
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
      const isRevoking = nextState.myReaction === null;
      const result = await updatePostReaction({
        userId: currentUser.id,
        postId: post.id,
        type: isRevoking ? null : reactionId,
        action: isRevoking ? 'remove' : 'set',
      });
      setCurrentReaction(result.data.myReaction);
      const syncedCounts = normalizeReactionCounts(result.data.reactionCounts || result.data.counts);
      setReactionCounts(syncedCounts);
      setReactionCount(getTotalReactionCount(syncedCounts));
    } catch (error) {
      const rollbackState = rollbackReactionState({ previousReaction, previousCount, error });
      setCurrentReaction(rollbackState.myReaction);
      setReactionCount(rollbackState.totalCount);
      setReactionCounts(previousCounts);
      setReactionError(rollbackState.errorMessage);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (commentSubmitLockRef.current) return;
    if (!currentUser) {
      if (onRequireAuth) onRequireAuth("Chỉ đăng nhập mới được bình luận, khi bấm vào nút bình luận mà chưa đăng nhập sẽ bị chuyển tới màn hình đăng nhập (User Story 5)");
      return;
    }
    if (isBanned) {
      alert('Tài khoản của bạn đang bị khóa. Không thể bình luận.');
      return;
    }
    if (isCooldown) {
      alert('Bạn đang trong thời gian bị hạn chế đăng bài và bình luận.');
      return;
    }
    if (!commentText.trim() && !commentImageFile) return;
    commentSubmitLockRef.current = true;

    let uploadedUrl = null;
    if (commentImageFile) {
      try {
        setIsUploadingCommentImage(true);
        uploadedUrl = await uploadPostImage(commentImageFile);
      } catch (err) {
        console.error('Lỗi tải ảnh bình luận:', err);
        alert('Không thể tải ảnh bình luận lên. Vui lòng thử lại!');
        setIsUploadingCommentImage(false);
        commentSubmitLockRef.current = false;
        return;
      } finally {
        setIsUploadingCommentImage(false);
      }
    }

    onAddComment(post.id, {
      id: `cmt-${Date.now()}`,
      author: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar
      },
      content: commentText.trim(),
      image: uploadedUrl,
      time: "Vừa xong",
      likes: 0
    });

    setCommentText('');
    handleRemoveCommentImage();
    commentSubmitLockRef.current = false;
  };

  const handleShare = () => {
    if (!currentUser?.id) {
      if (onRequireAuth) {
        onRequireAuth('Vui lòng đăng nhập để chia sẻ bài viết');
      } else if (onRequireLogin) {
        onRequireLogin();
      }
      return;
    }
    setShowShareModal(true);
  };

  const handleConfirmShare = async (content) => {
    const result = await sharePost({
      userId: currentUser.id,
      user: currentUser,
      postId: post.id,
      content,
    });
    // Optimistic: tăng đếm ngay sau khi API thành công
    setLocalSharesCount((prev) => prev + 1);
    // Thông báo ra ngoài nếu cần cập nhật Feed
    onSharePost?.(result?.data);
  };

  const handleSaveEdit = async ({ content, imageUrl }) => {
    setPostError('');
    const updatedPost = await onEditPost(post.id, { content, imageUrl });
    setShowEditModal(false);
    return updatedPost;
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setPostError('');
    try {
      await onDeletePost(post.id);
      setShowDeleteModal(false);
    } catch (error) {
      setPostError(error.message || 'Xóa bài viết thất bại');
    } finally {
      setIsDeleting(false);
    }
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
  const summaryReactions = getSummaryReactions({ counts: reactionCounts, myReaction: currentReaction });
  const reactionDetails = getSummaryReactions({ counts: reactionCounts, max: Number.POSITIVE_INFINITY });

  if (post.imageModeration?.status === 'rejected_hold' && holdRemaining === 0) return null;

  // Nếu bài viết bị ẩn cứng (Hate Speech hoặc Bạo lực)
  const isPostAuthor = currentUser && (currentUser.id === post.author_id || currentUser.id === post.author?.id);
  const canViewHiddenPost = isPostAuthor || currentUser?.role === 'admin' || currentUser?.role === 'moderator';
  if (post.ai_status === 'hidden' && !canViewHiddenPost) {
    return null;
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-xs mb-5 overflow-hidden transition-all hover:border-slate-300/80 ${
      post.ai_status === 'hidden' ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200/80'
    }`}>
      {/* Banner cảnh báo bài viết bị ẩn cứng */}
      {post.ai_status === 'hidden' && (
        <div className="p-3.5 bg-rose-50 border-b border-rose-200 text-xs flex items-center justify-between gap-3 text-rose-900">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold text-rose-800">Bài viết đã bị ẩn:</span> vi phạm tiêu chuẩn ({post.ai_label || 'Ngôn từ thù địch / Bạo lực'})
              <div className="text-[11px] text-rose-700/80">Bài viết chỉ hiển thị với riêng bạn. Bạn có thể gửi kháng cáo để được xem xét lại.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenAppealModal && onOpenAppealModal({
              targetType: 'post',
              targetId: post.id,
              targetAuthor: post.author || { id: post.author_id, name: post.full_name },
              contentExcerpt: post.content || '[Hình ảnh]'
            })}
            className="px-2.5 py-1 rounded bg-white border border-rose-300 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] shrink-0 flex items-center gap-1 transition cursor-pointer shadow-xs"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Kháng cáo</span>
          </button>
        </div>
      )}
      
      {/* Toast thông báo đã sao chép link */}
      {copiedToast && (
        <div className="bg-slate-900 text-white text-xs py-1.5 px-3 text-center transition-all animate-fade-in font-medium">
          Đã sao chép liên kết bài viết vào bộ nhớ tạm!
        </div>
      )}

      {/* Header bài viết */}
      {post.inlineNotice?.type === 'edit' && (
        <InlineNotice
          notice={post.inlineNotice}
          onDismiss={() => onDismissNotice?.(post.id)}
          className="mx-4 mt-4 sm:mx-5"
        />
      )}

      <div className="p-4 sm:p-5 flex items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <img 
            src={post.author?.avatar || DEFAULT_AVATAR} 
            alt={post.author?.name || 'Tác giả'} 
            onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
            onClick={() => onOpenProfile && onOpenProfile(post.author)}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100 cursor-pointer hover:opacity-90 transition shrink-0"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 
                onClick={() => onOpenProfile && onOpenProfile(post.author)}
                className="text-sm font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition"
              >
                {post.author?.name || 'Người dùng'}
              </h3>
              {(post.author?.isVerified || post.author?.is_verified) && (
                <VerifiedBadge size="sm" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {post.author?.username && <span>@{post.author.username}</span>}
              {post.author?.username && <span>•</span>}
              <span>{formatRelativeTime(post.createdAt || post.created_at)}</span>
              {post.isEdited && (
                <>
                  <span>•</span>
                  <span>Đã chỉnh sửa</span>
                </>
              )}
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
              ref={menuButtonRef}
              onClick={togglePostMenu}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              aria-haspopup="menu"
              aria-expanded={showPostMenu}
              title="Tùy chọn bài viết"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showPostMenu && (
              <div ref={menuRef} role="menu" className="absolute right-0 top-8 z-30 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 animate-fade-in text-xs">
                {allowEdit && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      if (!currentUser?.id) {
                        onRequireAuth?.('Vui lòng đăng nhập để tiếp tục');
                        return;
                      }
                      closePostMenu();
                      setShowEditModal(true);
                    }}
                    className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold transition cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                    <span>Chỉnh sửa bài viết</span>
                  </button>
                )}
                {allowDelete && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      if (!currentUser?.id) {
                        onRequireAuth?.('Vui lòng đăng nhập để tiếp tục');
                        return;
                      }
                      closePostMenu();
                      setShowDeleteModal(true);
                    }}
                    className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa bài viết</span>
                  </button>
                )}
                <button
                  role="menuitem"
                  onClick={() => {
                    closePostMenu();
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
                  className={`w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 ${allowReport ? 'flex' : 'hidden'} items-center gap-2 font-semibold transition cursor-pointer`}
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
        {post.imageModeration?.status === 'sensitive' && post.author?.id === currentUser?.id && (
          <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <span>{moderationViolationNotice('post')}</span>
            <button type="button" disabled title="Sắp ra mắt" className="ml-3 rounded bg-slate-300 px-2 py-1 text-[11px] text-slate-600">Kháng cáo</button>
          </div>
        )}
        {post.imageModeration?.status === 'pending_review' && post.author?.id === currentUser?.id && (
          <div className="mb-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Đang chờ quản trị viên duyệt</div>
        )}
        {post.imageModeration?.status === 'rejected_hold' && post.author?.id === currentUser?.id && (
          <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
              <span>{moderationViolationNotice('post')}. Sẽ bị xóa sau {String(Math.floor((holdRemaining || 0) / 60)).padStart(2, '0')}:{String((holdRemaining || 0) % 60).padStart(2, '0')} nếu không kháng cáo</span>
            <button type="button" onClick={handleModerationAppeal} className="ml-3 rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white">Kháng cáo</button>
          </div>
        )}
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
        <div className="min-w-0 w-full bg-slate-100 border-y border-slate-100 flex items-center justify-center relative">
          <img 
            src={post.image} 
            alt="Ảnh đính kèm bài viết" 
            loading="lazy"
            decoding="async"
            className={`block h-auto max-h-[75vh] w-full object-contain ${post.imageModeration?.status === 'sensitive' && !unblurredPosts[post.id] ? 'blur-xl scale-105' : ''}`}
          />
          {post.imageModeration?.status === 'sensitive' && !unblurredPosts[post.id] && (
            <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center text-white gap-2">
              <span className="font-semibold">Nội dung nhạy cảm</span>
              <button type="button" className="px-3 py-1 rounded bg-white/20" onClick={() => setUnblurredPosts((prev) => ({ ...prev, [post.id]: true }))}>Xem</button>
            </div>
          )}
        </div>
      )}

      {/* ===== EMBEDDED BÀI GỐC (nếu đây là bài chia sẻ) ===== */}
      {post.originalPost !== undefined && (
        <div className="mx-4 sm:mx-5 mb-3 mt-1">
          {post.originalPost ? (
            <div 
              onClick={() => setShowOriginalModal(true)}
              className="border border-slate-200/90 hover:border-blue-300 hover:shadow-xs rounded-2xl overflow-hidden bg-slate-50/80 text-xs transition-all duration-200 cursor-pointer group/orig"
              title="Nhấn để xem chi tiết bài viết gốc"
            >
              {/* Header tác giả bài gốc */}
              <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
                <div className="flex items-center gap-2.5">
                  <img
                    src={post.originalPost.author?.avatar || DEFAULT_AVATAR}
                    alt={post.originalPost.author?.name}
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProfile && post.originalPost.author && onOpenProfile(post.originalPost.author);
                    }}
                    className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 hover:ring-2 hover:ring-blue-300 transition"
                  />
                  <div>
                    <div className="flex items-center gap-1 font-semibold text-slate-800 leading-tight">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProfile && post.originalPost.author && onOpenProfile(post.originalPost.author);
                        }}
                        className="hover:text-blue-600 transition"
                      >
                        {post.originalPost.author?.name || 'Người dùng'}
                      </span>
                      {(post.originalPost.author?.isVerified || post.originalPost.author?.is_verified) && (
                        <VerifiedBadge size="sm" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {formatRelativeTime(post.originalPost.createdAt || post.originalPost.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 group-hover/orig:text-blue-600 transition font-medium">
                  <span>Xem bài viết gốc</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </div>
              {/* Nội dung bài gốc */}
              {post.originalPost.content && (
                <p className="px-3.5 pb-2 text-slate-700 leading-relaxed line-clamp-3">
                  {post.originalPost.content}
                </p>
              )}
              {/* Ảnh bài gốc */}
              {(post.originalPost.image || post.originalPost.imageUrl || post.originalPost.image_url) && (
                <div className="border-t border-slate-200/80 bg-slate-100">
                  <img
                    src={post.originalPost.image || post.originalPost.imageUrl || post.originalPost.image_url}
                    alt="Ảnh bài gốc"
                    className="w-full max-h-52 object-cover"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Bài gốc đã bị xóa */
            <div className="border border-slate-200 rounded-xl px-3.5 py-3 bg-slate-50 text-xs text-slate-400 flex items-center gap-2">
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>Bài viết gốc đã bị xóa hoặc không còn tồn tại</span>
            </div>
          )}
        </div>
      )}

      {/* Thống kê tương tác cảm xúc */}
      <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs text-slate-400 border-b border-slate-100">
        <button
          type="button"
          ref={reactionSummaryRef}
          className="flex min-w-0 items-center gap-1.5 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-100"
          onMouseEnter={() => setShowReactionSummary(true)}
          onMouseLeave={() => setShowReactionSummary(false)}
          onFocus={() => setShowReactionSummary(true)}
          onBlur={() => setShowReactionSummary(false)}
          onClick={() => setShowReactionSummary((value) => !value)}
          aria-label="Xem số lượng từng loại cảm xúc"
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
          <PortalPopover
            anchorRef={reactionSummaryRef}
            open={showReactionSummary && reactionDetails.length > 0}
            onRequestClose={() => setShowReactionSummary(false)}
            className="min-w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
          >
            {reactionDetails.map((reaction) => (
              <div key={reaction.id} className="flex items-center justify-between gap-4 px-2 py-1 text-xs text-slate-700">
                <span className="flex items-center gap-2">
                  <span>{reaction.emoji}</span>
                  <span className="font-semibold">{reaction.label}</span>
                </span>
                <span className="font-bold text-slate-900">{reaction.count}</span>
              </div>
            ))}
          </PortalPopover>
        </button>
        <div className="flex items-center gap-3">
          <span onClick={() => setShowComments(!showComments)} className="cursor-pointer hover:underline">{post.comments?.length || 0} bình luận</span>
          <span>{localSharesCount} chia sẻ</span>
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
          ref={reactionPickerRef}
          className="flex-1 relative"
          onMouseEnter={handleOpenReactionPicker}
          onMouseLeave={() => handleCloseReactionPicker(350)}
        >
          {/* Thanh Popover chọn 6 cảm xúc */}
          <PortalPopover
            anchorRef={reactionPickerRef}
            open={showReactionPicker}
            gap={8}
            onRequestClose={() => {
              if (reactionPickerTimeoutRef.current) clearTimeout(reactionPickerTimeoutRef.current);
              setShowReactionPicker(false);
            }}
            onMouseEnter={handleOpenReactionPicker}
            onMouseLeave={() => handleCloseReactionPicker(350)}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-xl animate-fade-in"
          >

            <div className="flex items-center gap-2">
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
          </PortalPopover>

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
          <form onSubmit={handleCommentSubmit} className="space-y-2">
            {commentImagePreview && (
              <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="relative group">
                  <img
                    src={commentImagePreview}
                    alt="Ảnh bình luận"
                    className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveCommentImage}
                    className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 shadow hover:bg-rose-600 transition cursor-pointer"
                    title="Xóa ảnh"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex-1 text-xs">
                  <span className="text-[11px] text-slate-500 block mb-1">Ảnh đính kèm sẽ được đăng cùng bình luận</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 items-center">
              <img 
                src={currentUser?.avatar || DEFAULT_AVATAR} 
                alt={currentUser?.name || "Khách"} 
                className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
              />
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={commentText}
                  disabled={isBanned || isCooldown}
                  onClick={() => {
                    if (!currentUser && onRequireAuth) {
                      onRequireAuth("Chỉ đăng nhập mới được bình luận, khi bấm vào nút bình luận mà chưa đăng nhập sẽ bị chuyển tới màn hình đăng nhập (User Story 5)");
                    }
                  }}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    isBanned
                      ? "Tài khoản của bạn đã bị khóa. Không thể bình luận..."
                      : isCooldown
                      ? "Bạn đang bị hạn chế đăng bài và bình luận..."
                      : currentUser
                      ? "Viết bình luận công khai..."
                      : "Đăng nhập để viết bình luận..."
                  }
                  className={`w-full pl-3 pr-16 py-1.5 text-xs bg-white border border-slate-200 rounded-full focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
                    (isBanned || isCooldown) ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''
                  }`}
                />

                <input
                  ref={commentFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCommentImageSelect}
                  className="hidden"
                />

                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser && onRequireAuth) {
                        onRequireAuth("Chỉ đăng nhập mới được bình luận, khi bấm vào nút bình luận mà chưa đăng nhập sẽ bị chuyển tới màn hình đăng nhập (User Story 5)");
                        return;
                      }
                      commentFileInputRef.current?.click();
                    }}
                    disabled={isUploadingCommentImage}
                    title="Đính kèm ảnh vào bình luận"
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    disabled={(!commentText.trim() && !commentImageFile) || isUploadingCommentImage}
                    title="Gửi bình luận"
                    className="p-1 text-blue-600 hover:text-blue-700 disabled:opacity-30 disabled:hover:text-blue-600 cursor-pointer"
                  >
                    {isUploadingCommentImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Danh sách bình luận */}
          <div className="space-y-2.5 pt-1">
            {post.comments && post.comments.length > 0 ? (
              // Sắp xếp: Comment bình thường lên trước, comment Toxic (ẩn mềm) xếp ở cuối
              [...(post.comments || [])].sort((a, b) => {
                const aToxic = a.is_soft_hidden || a.isSoftHidden || a.ai_label === 'Toxic' || a.aiLabel === 'Toxic';
                const bToxic = b.is_soft_hidden || b.isSoftHidden || b.ai_label === 'Toxic' || b.aiLabel === 'Toxic';
                if (aToxic && !bToxic) return 1;
                if (!aToxic && bToxic) return -1;
                return 0;
              }).map((comment) => {
                const isCommentAuthor = currentUser && (currentUser.id === comment.author?.id);
                const canViewHiddenComment = isCommentAuthor || currentUser?.role === 'admin' || currentUser?.role === 'moderator';
                const isHardHidden = comment.is_hidden || comment.isHidden || comment.ai_status === 'hidden' || comment.aiStatus === 'hidden';
                const isSoftHidden = comment.is_soft_hidden || comment.isSoftHidden || comment.ai_label === 'Toxic' || comment.aiLabel === 'Toxic';
                const isRevealed = Boolean(revealedComments[comment.id]);

                // 1. Trường hợp bình luận bị ẩn cứng (Hate Speech hoặc Violence)
                if (isHardHidden) {
                  if (!canViewHiddenComment) return null;
                  return (
                    <div key={comment.id} className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs flex items-center justify-between gap-3 text-rose-900">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <span className="font-semibold text-rose-800">Bình luận bị ẩn:</span> vi phạm tiêu chuẩn ({comment.ai_label || comment.aiLabel || 'Hate Speech / Bạo lực'})
                          {comment.content && <div className="text-[11px] text-rose-700/80 italic mt-0.5 line-clamp-1">"{comment.content}"</div>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenAppealModal && onOpenAppealModal({
                          targetType: 'comment',
                          targetId: comment.id,
                          targetAuthor: comment.author,
                          contentExcerpt: comment.content || (comment.image ? '[Hình ảnh]' : '')
                        })}
                        className="px-2.5 py-1 rounded bg-white border border-rose-300 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] shrink-0 flex items-center gap-1 transition cursor-pointer shadow-xs"
                      >
                        <Scale className="w-3 h-3" />
                        <span>Kháng cáo</span>
                      </button>
                    </div>
                  );
                }

                // 2. Trường hợp bình luận Toxic: ẩn mềm ở cuối danh sách, bấm vào thì hiện
                if (isSoftHidden && !isRevealed) {
                  return (
                    <div key={comment.id} className="p-2.5 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs flex items-center justify-between gap-2 text-amber-900">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="text-[11px]">Bình luận này bị nghi ngờ độc hại và đã được làm mờ ở cuối danh sách.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRevealedComments(prev => ({ ...prev, [comment.id]: true }))}
                        className="px-2.5 py-1 rounded bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] shrink-0 flex items-center gap-1 transition cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Xem bình luận</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={comment.id} className={`flex gap-2.5 items-start text-xs ${['sensitive', 'rejected_hold'].includes(comment.imageModeration?.status) && !unblurredComments[comment.id] ? 'relative' : ''}`}>
                    <img 
                      src={comment.author.avatar} 
                      alt={comment.author.name} 
                      onClick={() => onOpenProfile && onOpenProfile(comment.author)}
                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
                    />
                    <div className={`flex-1 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs ${['sensitive', 'rejected_hold'].includes(comment.imageModeration?.status) && !unblurredComments[comment.id] ? 'blur-sm' : ''} ${isSoftHidden ? 'border-amber-200 bg-amber-50/20' : ''}`}>
                      {/* Tiêu đề cảnh báo nếu đang mở xem bình luận Toxic */}
                      {isSoftHidden && isRevealed && (
                        <div className="text-[10px] text-amber-800 flex items-center justify-between pb-1 border-b border-amber-100 mb-1.5">
                          <span className="flex items-center gap-1 font-semibold">
                            <ShieldAlert className="w-3 h-3 text-amber-600" />
                            Bình luận độc hại (đang hiển thị)
                          </span>
                          <button 
                            type="button"
                            onClick={() => setRevealedComments(prev => ({ ...prev, [comment.id]: false }))} 
                            className="text-amber-800 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                          >
                            <EyeOff className="w-3 h-3" /> Ẩn lại
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <span 
                            onClick={() => onOpenProfile && onOpenProfile(comment.author)}
                            className="font-bold text-slate-800 hover:text-blue-600 cursor-pointer transition"
                          >
                            {comment.author.name}
                          </span>
                          {(comment.author?.isVerified || comment.author?.is_verified) && (
                            <VerifiedBadge size="xs" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">{comment.time}</span>
                          <button
                            onClick={() => onOpenReportModal && onOpenReportModal({
                              targetType: 'comment',
                              targetId: comment.id,
                              targetAuthor: comment.author,
                              contentExcerpt: comment.content || (comment.image ? '[Hình ảnh]' : '')
                            })}
                            title="Báo cáo bình luận này"
                            className="text-slate-300 hover:text-rose-500 transition cursor-pointer p-0.5"
                          >
                            <Flag className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {comment.content && <p className="text-slate-700">{comment.content}</p>}

                      {comment.image && (
                        <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 max-w-xs group">
                          {comment.imageModeration?.status === 'sensitive' && !unblurredComments[comment.id] ? (
                            <div className="relative">
                              <img
                                src={comment.image}
                                alt="Bình luận có ảnh"
                                className="w-full max-h-52 object-cover filter blur-xl select-none scale-105 transition duration-300"
                              />
                              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-center text-white">
                                <ShieldAlert className="w-5 h-5 text-amber-400 mb-1" />
                                <span className="text-[11px] font-semibold">Nội dung nhạy cảm (NSFW)</span>
                                <span className="text-[9px] text-slate-200 mb-2">Ảnh này được gắn nhãn nhạy cảm</span>
                                <button
                                  type="button"
                                  onClick={() => setUnblurredComments(prev => ({ ...prev, [comment.id]: true }))}
                                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-medium backdrop-blur-sm transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" /> Xem ảnh
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative">
                              <img
                                src={comment.image}
                                alt="Bình luận có ảnh"
                                className="w-full max-h-52 object-cover rounded-lg cursor-pointer hover:opacity-95 transition"
                                onClick={() => window.open(comment.image, '_blank')}
                              />
                              {comment.imageModeration?.status === 'sensitive' && unblurredComments[comment.id] && (
                                <button
                                  type="button"
                                  onClick={() => setUnblurredComments(prev => ({ ...prev, [comment.id]: false }))}
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
                    </div>
                    {['sensitive', 'rejected_hold'].includes(comment.imageModeration?.status) && !unblurredComments[comment.id] && (
                      <div className="absolute inset-0 bg-slate-900/60 rounded-xl flex items-center justify-center text-white gap-2">
                        <span className="text-[11px] font-semibold">{comment.imageModeration?.status === 'rejected_hold' ? moderationViolationNotice('comment') : 'Nội dung nhạy cảm'}</span>
                        <button type="button" className="px-2 py-1 rounded bg-white/20 text-[10px]" onClick={() => setUnblurredComments((prev) => ({ ...prev, [comment.id]: true }))}>Xem</button>
                        {comment.imageModeration?.status === 'rejected_hold' && comment.author?.id === currentUser?.id && <button type="button" className="px-2 py-1 rounded bg-rose-500 text-[10px]" onClick={() => appealCommentModeration({ userId: currentUser.id, postId: post.id, commentId: comment.id })}>Kháng cáo</button>}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
            )}
          </div>

        </div>
      )}

      <EditPostModal
        post={post}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEdit}
      />
      <DeletePostModal
        post={post}
        isOpen={showDeleteModal}
        isDeleting={isDeleting}
        errorMessage={postError}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
      />
      {showShareModal && (
        <SharePostModal
          post={post}
          currentUser={currentUser}
          onConfirm={handleConfirmShare}
          onClose={() => setShowShareModal(false)}
        />
      )}
      {showOriginalModal && (
        <OriginalPostModal
          post={post.originalPost}
          isOpen={showOriginalModal}
          onClose={() => setShowOriginalModal(false)}
          currentUser={currentUser}
          onOpenProfile={onOpenProfile}
          onRequireAuth={onRequireAuth}
          allPosts={allPosts}
          onUpdatePost={onUpdatePost}
        />
      )}
    </div>
  );
}

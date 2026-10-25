import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  MessageCircle, Share2, Bookmark, MoreHorizontal, ShieldCheck, Reply, 
  CheckCircle2, Send, ThumbsUp, Flag, Scale, ShieldAlert, AlertCircle, Pencil, Trash2, ExternalLink,
  Image as ImageIcon, X, Eye, EyeOff, Loader2, Sparkles, Timer, Lock
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
import { getModerationNoticeText, moderationViolationNotice } from '../utils/moderationNoticeLogic';
import { canSubmitImageAppeal } from '../utils/imageModerationReviewLogic';
import { shouldClosePostMenuForPointer } from '../utils/menuLogic';
import EditPostModal from './EditPostModal';
import DeletePostModal from './DeletePostModal';
import InlineNotice from './InlineNotice';
import VerifiedBadge from './VerifiedBadge';
import SharePostModal from './SharePostModal';
import OriginalPostModal from './OriginalPostModal';
import PostReactionsModal from './PostReactionsModal';
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
  onUpdatePost,
  isTargeted = false,
  targetType = null,
  targetActor = null,
  targetCommentId = null
}) {
  const [showComments, setShowComments] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentImageFile, setCommentImageFile] = useState(null);
  const [commentImagePreview, setCommentImagePreview] = useState('');
  const [isUploadingCommentImage, setIsUploadingCommentImage] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const commentInputRef = useRef(null);

  const handleReplyToComment = (targetComment) => {
    if (['pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending', 'rejected_final'].includes(targetComment.imageModeration?.status || targetComment.image_moderation_status)) return;
    if (isBanned || isCooldown) return;
    if (!currentUser && onRequireAuth) {
      onRequireAuth("Vui lòng đăng nhập để trả lời bình luận");
      return;
    }
    const authorName = targetComment.author?.name || 'Người dùng';
    setReplyingTo({ id: targetComment.id, authorName });
    const mentionTag = `@${authorName} `;
    if (!commentText.startsWith(mentionTag)) {
      setCommentText(mentionTag + (commentText ? commentText.replace(/^@[\w\s\u00C0-\u1EF9]+ /, '') : ''));
    }
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 50);
  };
  const [unblurredComments, setUnblurredComments] = useState({});
  const [unblurredPosts, setUnblurredPosts] = useState({});
  const [revealedComments, setRevealedComments] = useState({});
  const [revealedSensitivePost, setRevealedSensitivePost] = useState(false);
  const [holdRemaining, setHoldRemaining] = useState(post.imageModeration?.remainingSeconds ?? null);
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealError, setAppealError] = useState('');
  const appealLockRef = useRef(false);
  const commentAppealLocksRef = useRef(new Set());
  const [pendingCommentAppealId, setPendingCommentAppealId] = useState(null);
  const [commentAppealError, setCommentAppealError] = useState('');
  const isBanned = currentUser?.status === 'banned';
  const cooldownVal = currentUser?.cooldown_until || currentUser?.cooldownUntil;
  const cooldownUntil = cooldownVal ? new Date(cooldownVal) : null;
  const isCooldown = (currentUser?.status === 'cooldown' || Boolean(cooldownUntil && cooldownUntil > new Date())) && Boolean(cooldownUntil && cooldownUntil > new Date());
  const [cooldownRemainingStr, setCooldownRemainingStr] = useState('');

  useEffect(() => {
    if (!isCooldown || !cooldownUntil) {
      setCooldownRemainingStr('');
      return;
    }
    const updateCountdown = () => {
      const now = new Date();
      const diff = cooldownUntil - now;
      if (diff <= 0) {
        setCooldownRemainingStr('0 giây (đã hết hạn)');
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (hours > 0) setCooldownRemainingStr(`${hours} giờ ${minutes} phút ${seconds} giây`);
      else if (minutes > 0) setCooldownRemainingStr(`${minutes} phút ${seconds} giây`);
      else setCooldownRemainingStr(`${seconds} giây`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isCooldown, cooldownVal]);
  const commentFileInputRef = useRef(null);
  const commentSubmitLockRef = useRef(false);
  const [commentNudgeData, setCommentNudgeData] = useState(null);
  useEffect(() => {
    if (post.imageModeration?.status !== 'rejected_hold' || holdRemaining == null) return undefined;
    const timer = setInterval(() => setHoldRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [post.imageModeration?.status, holdRemaining]);
  const handleModerationAppeal = async () => {
    if (appealLockRef.current || !canSubmitImageAppeal(post.imageModeration?.status, appealSubmitting)) return;
    appealLockRef.current = true;
    setAppealSubmitting(true);
    setAppealError('');
    try {
      const result = await appealPostModeration({ userId: currentUser?.id, postId: post.id });
      onUpdatePost?.(post.id, { imageModeration: { ...post.imageModeration, status: 'appeal_pending', noticeType: 'appeal_pending', appealedAt: result.data?.appealedAt || new Date().toISOString(), moderationExpiresAt: null, remainingSeconds: null } });
    } catch (error) {
      setAppealError(error.message || 'Không thể gửi khiếu nại.');
    } finally {
      appealLockRef.current = false;
      setAppealSubmitting(false);
    }
  };
  const handleCommentModerationAppeal = async (comment) => {
    const id = String(comment.id);
    if (commentAppealLocksRef.current.has(id) || !canSubmitImageAppeal(comment.imageModeration?.status, pendingCommentAppealId === id)) return;
    commentAppealLocksRef.current.add(id);
    setPendingCommentAppealId(id);
    setCommentAppealError('');
    try {
      const result = await appealCommentModeration({ userId: currentUser?.id, postId: post.id, commentId: comment.id });
      onUpdatePost?.(post.id, { commentModeration: {
        id,
        imageModeration: {
          ...comment.imageModeration,
          status: 'appeal_pending',
          noticeType: 'appeal_pending',
          appealedAt: result.data?.appealedAt || new Date().toISOString(),
          moderationExpiresAt: null,
          remainingSeconds: null,
        },
      } });
    } catch (error) {
      setCommentAppealError(error.message || 'Không thể gửi khiếu nại.');
    } finally {
      commentAppealLocksRef.current.delete(id);
      setPendingCommentAppealId(null);
    }
  };

  // Tự động mở khung bình luận và highlight đúng bình luận được nhắc đến từ thông báo
  useEffect(() => {
    if (isTargeted && targetType === 'comment') {
      setShowComments(true);

      const timer = setTimeout(() => {
        let target = null;
        // 1. Thử tìm theo mã bình luận targetCommentId
        if (targetCommentId) {
          target = post.comments?.find(c => String(c.id) === String(targetCommentId));
        }
        // 2. Thử tìm theo người gửi bình luận (actor)
        if (!target && targetActor) {
          target = [...(post.comments || [])].reverse().find(c => 
            (c.author?.id && (String(c.author.id) === String(targetActor.id) || String(c.author.id) === String(targetActor.userId))) ||
            (c.author?.name && targetActor?.name && c.author.name.trim().toLowerCase() === targetActor.name.trim().toLowerCase())
          );
        }
        // 3. Fallback: Lấy bình luận mới nhất trong bài
        if (!target && post.comments && post.comments.length > 0) {
          target = post.comments[post.comments.length - 1];
        }

        if (target) {
          setHighlightedCommentId(target.id);
          const el = document.getElementById(`comment-${target.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          const clearTimer = setTimeout(() => {
            setHighlightedCommentId(null);
          }, 4500);
          return () => clearTimeout(clearTimer);
        }
      }, 250);

      return () => clearTimeout(timer);
    }
  }, [isTargeted, targetType, targetCommentId, targetActor, post.comments]);

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
  const [hoveredReactionId, setHoveredReactionId] = useState(null);
  const [isReactionsModalOpen, setIsReactionsModalOpen] = useState(false);
  const longPressTimerRef = useRef(null);
  const isLongPressingRef = useRef(false);

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
      setHoveredReactionId(null);
      reactionPickerTimeoutRef.current = null;
    }, delay);
  }, []);

  // Xử lý nhấn giữ (Long press) mở bảng chọn cảm xúc & kéo chọn
  const handleReactionButtonMouseDown = (e) => {
    if (e.button !== 0) return;
    isLongPressingRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressingRef.current = true;
      setShowReactionPicker(true);
    }, 260);
  };

  const handleReactionButtonMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    if (!isLongPressingRef.current) {
      if (hoveredReactionId) {
        handleSelectReaction(hoveredReactionId);
        setHoveredReactionId(null);
      } else {
        handleSelectReaction(currentReaction || 'like');
      }
    } else {
      if (hoveredReactionId) {
        handleSelectReaction(hoveredReactionId);
        setHoveredReactionId(null);
        setShowReactionPicker(false);
      }
    }
    isLongPressingRef.current = false;
  };

  const handleReactionTouchStart = () => {
    isLongPressingRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressingRef.current = true;
      setShowReactionPicker(true);
    }, 260);
  };

  const handleReactionTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    if (isLongPressingRef.current && hoveredReactionId) {
      handleSelectReaction(hoveredReactionId);
      setHoveredReactionId(null);
      setShowReactionPicker(false);
    } else if (!isLongPressingRef.current) {
      handleSelectReaction(currentReaction || 'like');
    }
    isLongPressingRef.current = false;
  };

  useEffect(() => {
    return () => {
      if (reactionPickerTimeoutRef.current) {
        clearTimeout(reactionPickerTimeoutRef.current);
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
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

  const doSubmitComment = async (forceComment = false) => {
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

    const commentPayload = {
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
    };

    const res = await onAddComment(post.id, commentPayload, { forceComment });
    if (res?.nudge) {
      setCommentNudgeData({
        message: res.message,
        contentSnippet: commentText.trim(),
        payload: commentPayload
      });
      commentSubmitLockRef.current = false;
      return;
    }

    setCommentText('');
    setReplyingTo(null);
    handleRemoveCommentImage();
    commentSubmitLockRef.current = false;
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    await doSubmitComment(false);
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

  if (post.imageModeration?.status === 'rejected_final') return null;
  if (post.imageModeration?.status === 'rejected_hold' && holdRemaining === 0) return null;

  // Nếu bài viết bị ẩn cứng (Hate Speech hoặc Bạo lực)
  const isAuthor = Boolean(currentUser && (currentUser.id === post.author_id || currentUser.id === post.author?.id));
  const isPostAuthor = isAuthor;
  const canViewHiddenPost = isAuthor || currentUser?.role === 'admin' || currentUser?.role === 'moderator';
  if (post.ai_status === 'hidden' && !canViewHiddenPost) {
    return null;
  }
  const isToxicText = (post.ai_label === 'Toxic' || post.aiLabel === 'Toxic' || post.aiStatus?.label === 'Toxic') && post.ai_status !== 'hidden';
  const adminImageReviewStatus = ['rejected_admin', 'appeal_pending'].includes(post.imageModeration?.status);
  const isNsfwImage = adminImageReviewStatus || ((post.imageModeration?.status === 'sensitive' || post.image_label === 'NSFW' || post.imageLabel === 'NSFW' || post.image_moderation_status === 'sensitive') && post.ai_status !== 'hidden');
  const isSensitivePost = isToxicText || isNsfwImage;

  return (
    <div 
      id={`post-${post.id}`}
      className={`bg-white dark:bg-slate-900 rounded-2xl border mb-5 overflow-hidden shadow-xs hover:border-slate-300/80 dark:hover:border-slate-700 transition-all duration-300 ${
        post.ai_status === 'hidden' ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200/80 dark:border-slate-800'
      }`}
    >
      {/* Banner cảnh báo bài viết bị ẩn cứng */}
      {post.ai_status === 'hidden' && (
        <div className="p-3.5 bg-rose-50 border-b border-rose-200 text-xs flex items-center justify-between gap-3 text-rose-900">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold text-rose-800">Bài viết đã bị ẩn:</span> vi phạm tiêu chuẩn ({post.ai_label || 'Ngôn từ thù địch / Bạo lực'})
              <div className="text-[11px] text-rose-700/80">Bài viết chỉ hiển thị với riêng bạn. {isAuthor ? 'Bạn có thể gửi kháng cáo để được xem xét lại.' : ''}</div>
            </div>
          </div>
          {isAuthor && (
            <button
              type="button"
              onClick={() => onOpenAppealModal && onOpenAppealModal({
                targetType: 'post',
                targetId: post.id,
                targetAuthor: post.author || { id: post.author_id, name: post.full_name },
                contentExcerpt: post.content || (post.image ? '[Hình ảnh]' : ''),
                imageUrl: post.image || null,
                aiStatus: post.aiStatus || { label: post.ai_label || 'Violence', confidence: 0.95, action: 'hide' }
              })}
              className="px-2.5 py-1 rounded bg-white border border-rose-300 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] shrink-0 flex items-center gap-1 transition cursor-pointer shadow-xs"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Kháng cáo</span>
            </button>
          )}
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

                {/* Khiếu nại kiểm duyệt AI - CHỈ DÀNH CHO CHÍNH CHỦ TÁC GIẢ KHI BÀI VIẾT BỊ GẮN NHÃN SAI */}
                {isAuthor && (post.ai_label !== 'Normal' || post.aiStatus?.label !== 'Normal') && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      closePostMenu();
                      if (onOpenAppealModal) {
                        onOpenAppealModal({
                          ...post,
                          targetType: 'post',
                          targetId: post.id,
                          targetAuthor: post.author || { id: post.author_id, name: post.full_name },
                          contentExcerpt: post.content || (post.image ? '[Hình ảnh]' : ''),
                          imageUrl: post.image || null,
                          aiStatus: post.aiStatus
                        });
                      }
                    }}
                    className="w-full px-3 py-2 text-left text-amber-700 hover:bg-amber-50 flex items-center gap-2 font-semibold transition cursor-pointer"
                  >
                    <Scale className="w-4 h-4 text-amber-600" />
                    <span>Khiếu nại kiểm duyệt AI</span>
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
                        contentExcerpt: post.content || (post.image ? '[Hình ảnh]' : ''),
                        imageUrl: post.image || null,
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



      {/* KHUNG CẢNH BÁO NỘI DUNG NHẠY CẢM HỢP NHẤT (Twitter / Reddit style) */}
      {isAuthor && ['rejected_admin', 'appeal_pending'].includes(post.imageModeration?.status) && (
        <div className="mx-4 sm:mx-5 mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{post.imageModeration.noticeText || getModerationNoticeText('post', post.imageModeration.status)}</span>
            {post.imageModeration.status === 'rejected_admin' && (
              <button type="button" disabled={appealSubmitting} onClick={handleModerationAppeal} className="rounded-md bg-rose-600 px-3 py-1.5 font-semibold text-white disabled:cursor-wait disabled:opacity-50">
                {appealSubmitting ? 'Đang gửi...' : 'Khiếu nại'}
              </button>
            )}
          </div>
          {appealError && <p className="mt-1 text-rose-700">{appealError}</p>}
        </div>
      )}

      {isSensitivePost && !revealedSensitivePost ? (
        <div className="mx-4 sm:mx-5 my-3.5 p-6 bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl flex flex-col items-center justify-center text-center gap-3.5 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="max-w-md">
            <h4 className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-100">
              {adminImageReviewStatus ? 'Nội dung nhạy cảm' : 'Cảnh báo: Nội dung nhạy cảm'}
            </h4>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1 leading-relaxed">
              {isToxicText && isNsfwImage
                ? 'Bài viết này chứa ngôn từ công kích/độc hại (Toxic) và hình ảnh nhạy cảm (NSFW).'
                : isNsfwImage
                ? 'Bài viết này có đính kèm hình ảnh nhạy cảm (18+ / NSFW).'
                : 'Bài viết này có thể chứa ngôn từ độc hại hoặc thô tục (Toxic).'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRevealedSensitivePost(true)}
            className="mt-1 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Eye className="w-4 h-4" />
            <span>{adminImageReviewStatus ? 'Xem' : 'Xem toàn bộ bài viết'}</span>
          </button>
        </div>
      ) : (
        <>
          {/* Nội dung bài viết */}
          <div className="px-4 sm:px-5 pb-3">
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
            
            {/* Thanh cảnh báo nhỏ khi đang xem bài viết nhạy cảm */}
            {isSensitivePost && revealedSensitivePost && (
              <div className="flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50/90 dark:bg-amber-950/40 px-3.5 py-1.5 rounded-xl border border-amber-200/70 dark:border-amber-800/40 mb-3">
                <span className="flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Đang hiển thị nội dung nhạy cảm ({isToxicText && isNsfwImage ? 'Toxic & NSFW' : isNsfwImage ? 'NSFW' : 'Toxic'})
                </span>
                <button
                  type="button"
                  onClick={() => setRevealedSensitivePost(false)}
                  className="hover:underline flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-100 cursor-pointer text-[10px]"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Ẩn lại</span>
                </button>
              </div>
            )}

            <p className="text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-relaxed whitespace-pre-line break-words">
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
          {(post.image || post.image_url) && (
            <div className="min-w-0 w-full bg-slate-100 dark:bg-slate-800 border-y border-slate-100 dark:border-slate-800 flex items-center justify-center relative">
              <img 
                src={post.image || post.image_url} 
                alt="Ảnh đính kèm bài viết" 
                loading="lazy"
                decoding="async"
                className="block h-auto max-h-[75vh] w-full object-contain"
              />
            </div>
          )}
        </>
      )}

      {/* ===== EMBEDDED BÀI GỐC (nếu đây là bài chia sẻ) ===== */}
      {Boolean(post.originalPost) && (
        <div className="mx-4 sm:mx-5 mb-3 mt-1">
          {(post.originalPost?.author || post.originalPost?.id || post.originalPost?.content) && !post.originalPost?.isDeleted ? (
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
          className="flex min-w-0 items-center gap-1.5 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 group/reactors cursor-pointer transition"
          onMouseEnter={() => setShowReactionSummary(true)}
          onMouseLeave={() => setShowReactionSummary(false)}
          onFocus={() => setShowReactionSummary(true)}
          onBlur={() => setShowReactionSummary(false)}
          onClick={() => {
            setShowReactionSummary(false);
            setIsReactionsModalOpen(true);
          }}
          title="Nhấn để xem ai đã bày tỏ cảm xúc"
          aria-label="Xem ai đã bày tỏ cảm xúc về bài viết"
        >
          {summaryReactions.length > 0 && (
            <div className="flex items-center -space-x-1 group-hover/reactors:scale-105 transition-transform">
              {summaryReactions.map((reaction) => (
                <span
                  key={reaction.id}
                  className="w-4 h-4 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-[10px] shadow-2xs ring-1 ring-white dark:ring-slate-700"
                  title={reaction.label}
                >
                  {reaction.emoji}
                </span>
              ))}
            </div>
          )}
          <span className="font-semibold text-slate-600 dark:text-slate-300 group-hover/reactors:text-blue-600 dark:group-hover/reactors:text-blue-400 pl-1 transition">
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
          {/* Thanh Popover chọn 6 cảm xúc với hiệu ứng nổi bật */}
          <PortalPopover
            anchorRef={reactionPickerRef}
            open={showReactionPicker}
            gap={10}
            onRequestClose={() => {
              if (reactionPickerTimeoutRef.current) clearTimeout(reactionPickerTimeoutRef.current);
              setShowReactionPicker(false);
              setHoveredReactionId(null);
            }}
            onMouseEnter={handleOpenReactionPicker}
            onMouseLeave={() => handleCloseReactionPicker(350)}
            className="rounded-full border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2.5 py-1.5 shadow-2xl animate-fade-in z-50 select-none"
          >
            <div className="flex items-center gap-1 sm:gap-2">
              {REACTIONS.map((r) => {
                const isHovered = hoveredReactionId === r.id;
                return (
                  <div key={r.id} className="relative flex flex-col items-center">
                    {/* Tooltip hiển thị tên cảm xúc khi rê qua */}
                    {isHovered && (
                      <div className="absolute -top-8 px-2 py-0.5 bg-slate-900/95 dark:bg-slate-800 text-white text-[10px] font-bold rounded-full shadow-lg whitespace-nowrap animate-fade-in pointer-events-none z-20">
                        {r.label}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-slate-900/95 dark:bg-slate-800 rotate-45" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectReaction(r.id);
                        setShowReactionPicker(false);
                        setHoveredReactionId(null);
                      }}
                      onMouseEnter={() => setHoveredReactionId(r.id)}
                      onMouseLeave={() => setHoveredReactionId(null)}
                      title={r.label}
                      className={`text-2xl sm:text-3xl p-1 cursor-pointer transition-all duration-200 ease-out select-none ${
                        isHovered 
                          ? 'scale-150 -translate-y-2.5 z-10 drop-shadow-md' 
                          : 'hover:scale-125 hover:-translate-y-1'
                      }`}
                    >
                      <span className="inline-block transform active:scale-90 transition-transform">{r.emoji}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </PortalPopover>

          <button
            onClick={() => {
              if (!isLongPressingRef.current) {
                handleSelectReaction(currentReaction || 'like');
              }
            }}
            onMouseDown={handleReactionButtonMouseDown}
            onMouseUp={handleReactionButtonMouseUp}
            onTouchStart={handleReactionTouchStart}
            onTouchEnd={handleReactionTouchEnd}
            className={`w-full py-2 flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer select-none ${
              activeReactionObj ? `${activeReactionObj.color} font-bold` : 'text-slate-600 dark:text-slate-300'
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
          className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-semibold transition duration-150 cursor-pointer ${
            isCooldown
              ? 'text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/30'
              : 'hover:bg-slate-50'
          }`}
          title={isCooldown ? `Đang bị khóa bình luận (${cooldownRemainingStr || 'Đang đếm...'})` : undefined}
        >
          <MessageCircle className={`w-4 h-4 ${isCooldown ? 'text-amber-600' : 'text-slate-500'}`} />
          <span>{isCooldown ? 'Xem bình luận (Đang bị khóa)' : 'Bình luận'}</span>
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
          
          {/* Banner hiển thị thời gian gỡ phạt còn lại khi đang bị cấm bình luận */}
          {isCooldown && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 text-xs flex items-center justify-between gap-2.5 animate-fade-in shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <Timer className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                <span className="font-bold truncate">Đang bị vô hiệu hóa bình luận</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">Thời gian gỡ phạt còn lại:</span>
                <span className="font-mono bg-amber-200/90 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 font-black px-2.5 py-0.5 rounded-lg text-[11px] shadow-2xs border border-amber-300/60 text-rose-600 dark:text-rose-400">
                  {cooldownRemainingStr || 'Đang đếm ngược...'}
                </span>
              </div>
            </div>
          )}

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
              <div className="flex-1">
                {replyingTo && (
                  <div className="flex items-center justify-between px-3 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-[11px] text-blue-700 dark:text-blue-300 mb-1.5 animate-fade-in">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Reply className="w-3 h-3 text-blue-600 rotate-180" />
                      <span>Đang trả lời <strong>@{replyingTo.authorName}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const mentionTag = `@${replyingTo.authorName} `;
                        if (commentText.startsWith(mentionTag)) {
                          setCommentText(commentText.replace(mentionTag, ''));
                        }
                        setReplyingTo(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                      title="Hủy trả lời"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="relative flex items-center">
                <input
                  ref={commentInputRef}
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
                      ? `🚫 Bạn đang bị cấm bình luận • Gỡ phạt sau: ${cooldownRemainingStr || 'Đang đếm...'}`
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
                    disabled={isBanned || isCooldown || isUploadingCommentImage}
                    title={isCooldown ? "Đang bị khóa bình luận" : "Đính kèm ảnh vào bình luận"}
                    className={`p-1 rounded-full transition ${
                      (isBanned || isCooldown) 
                        ? 'text-slate-300 opacity-40 cursor-not-allowed pointer-events-none' 
                        : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    disabled={isBanned || isCooldown || (!commentText.trim() && !commentImageFile) || isUploadingCommentImage}
                    title={isCooldown ? `Đang bị khóa bình luận (còn lại: ${cooldownRemainingStr})` : "Gửi bình luận"}
                    className="p-1 text-blue-600 hover:text-blue-700 disabled:opacity-30 disabled:hover:text-blue-600 disabled:cursor-not-allowed cursor-pointer"
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
            </div>
          </form>

          {/* Danh sách bình luận */}
          <div className="space-y-2.5 pt-1">
            {post.comments && post.comments.length > 0 ? (
              // Sắp xếp: Comment bình thường lên trước, comment Toxic / NSFW (ẩn mềm) xếp ở cuối
              [...(post.comments || [])].sort((a, b) => {
                const aSoft = Boolean(a.is_soft_hidden || a.isSoftHidden || a.ai_label === 'Toxic' || a.aiLabel === 'Toxic' || a.image_label === 'NSFW' || a.imageLabel === 'NSFW' || a.imageModeration?.status === 'sensitive');
                const bSoft = Boolean(b.is_soft_hidden || b.isSoftHidden || b.ai_label === 'Toxic' || b.aiLabel === 'Toxic' || b.image_label === 'NSFW' || b.imageLabel === 'NSFW' || b.imageModeration?.status === 'sensitive');
                if (aSoft && !bSoft) return 1;
                if (!aSoft && bSoft) return -1;
                return 0;
              }).map((comment) => {
                if ((comment.imageModeration?.status || comment.image_moderation_status) === 'rejected_final') return null;
                const isCommentAuthor = currentUser && (currentUser.id === comment.author?.id);
                const canViewHiddenComment = isCommentAuthor || currentUser?.role === 'admin' || currentUser?.role === 'moderator';
                const commentImageStatus = comment.imageModeration?.status || comment.image_moderation_status;
                const isAdminImageReview = ['rejected_admin', 'appeal_pending'].includes(commentImageStatus);
                const isHardHidden = Boolean(comment.is_hidden || comment.isHidden || comment.ai_status === 'hidden' || comment.aiStatus === 'hidden' || commentImageStatus === 'rejected_hold');
                const isSoftHidden = !isAdminImageReview && Boolean(comment.is_soft_hidden || comment.isSoftHidden || comment.ai_label === 'Toxic' || comment.aiLabel === 'Toxic' || comment.image_label === 'NSFW' || comment.imageLabel === 'NSFW' || commentImageStatus === 'sensitive');
                const isRevealed = Boolean(revealedComments[comment.id]);
                const isThisCommentHighlighted = highlightedCommentId && String(comment.id) === String(highlightedCommentId);

                const isToxicText = comment.ai_label === 'Toxic' || comment.aiLabel === 'Toxic';
                const isNsfwImg = comment.image_label === 'NSFW' || comment.imageLabel === 'NSFW' || ['sensitive', 'rejected_admin', 'appeal_pending'].includes(commentImageStatus);

                // 1. Trường hợp bình luận bị ẩn cứng (Bạo lực hoặc Thù ghét - Text hoặc Ảnh)
                if (isHardHidden) {
                  if (!canViewHiddenComment) return null;
                  const isViolence = comment.ai_label === 'Violence' || comment.aiLabel === 'Violence' || comment.image_moderation_violence >= 0.8 || comment.image_moderation_status === 'rejected_hold';
                  const labelText = isViolence ? 'Bạo lực' : (comment.ai_label || comment.aiLabel || 'Hate Speech / Bạo lực');

                  return (
                    <div key={comment.id} id={`comment-${comment.id}`} className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs flex items-center justify-between gap-3 text-rose-900 dark:text-rose-200">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <div>
                            <span className="font-semibold text-rose-800 dark:text-rose-300">Bình luận bị ẩn:</span> vi phạm tiêu chuẩn ({labelText})
                          </div>
                          {comment.content && <div className="text-[11px] text-rose-700/80 dark:text-rose-300/80 italic mt-0.5 line-clamp-1">"{comment.content}"</div>}
                          {comment.image && (
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                              <span>🖼️ Kèm hình ảnh vi phạm</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {isCommentAuthor && isAdminImageReview && (
                        <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-900">
                          <div className="flex items-center justify-between gap-2">
                            <span>{comment.imageModeration?.noticeText || getModerationNoticeText('comment', commentImageStatus)}</span>
                            {commentImageStatus === 'rejected_admin' && <button type="button" disabled={pendingCommentAppealId === String(comment.id)} onClick={() => handleCommentModerationAppeal(comment)} className="rounded bg-rose-600 px-2.5 py-1 font-semibold text-white disabled:opacity-50">{pendingCommentAppealId === String(comment.id) ? 'Đang gửi...' : 'Khiếu nại'}</button>}
                          </div>
                          {commentAppealError && <p className="mt-1">{commentAppealError}</p>}
                        </div>
                      )}
                      {isCommentAuthor && (
                        <button
                          type="button"
                          onClick={() => onOpenAppealModal && onOpenAppealModal({
                            targetType: 'comment',
                            targetId: comment.id,
                            targetAuthor: comment.author,
                            contentExcerpt: comment.content || (comment.image ? '[Hình ảnh]' : ''),
                            imageUrl: comment.image || null,
                            aiStatus: { label: labelText, confidence: 0.95, action: 'hide' }
                          })}
                          className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-semibold text-[11px] shrink-0 flex items-center gap-1 transition cursor-pointer shadow-xs"
                        >
                          <Scale className="w-3 h-3" />
                          <span>Kháng cáo</span>
                        </button>
                      )}
                    </div>
                  );
                }

                // 2. Trường hợp bình luận Toxic / NSFW: ẩn mềm chung ở cuối danh sách, bấm vào thì hiện cả hai
                if (isSoftHidden && !isRevealed) {
                  let softHiddenMessage = 'Bình luận này có thể chứa nội dung không phù hợp (Toxic / NSFW) theo chính sách cộng đồng.';
                  if (isToxicText && isNsfwImg) {
                    softHiddenMessage = 'Bình luận chứa cả ngôn từ độc hại (Toxic) và hình ảnh nhạy cảm (NSFW).';
                  } else if (isNsfwImg) {
                    softHiddenMessage = 'Bình luận này có đính kèm hình ảnh nhạy cảm (NSFW).';
                  } else if (isToxicText) {
                    softHiddenMessage = 'Bình luận này có thể chứa ngôn từ độc hại hoặc thô tục (Toxic).';
                  }

                  return (
                    <div key={comment.id} id={`comment-${comment.id}`} className="p-2.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-800/40 rounded-xl text-xs flex items-center justify-between gap-2 text-amber-900 dark:text-amber-200">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="text-[11px] font-medium">{softHiddenMessage}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRevealedComments(prev => ({ ...prev, [comment.id]: true }))}
                        className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-semibold text-[11px] shrink-0 flex items-center gap-1 transition cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Xem bình luận</span>
                      </button>
                    </div>
                  );
                }

                let revealedBadge = 'Toxic & NSFW';
                if (isToxicText && !isNsfwImg) revealedBadge = 'Toxic';
                else if (!isToxicText && isNsfwImg) revealedBadge = 'NSFW';

                return (
                  <div 
                    key={comment.id} 
                    id={`comment-${comment.id}`}
                    className={`flex gap-2.5 items-start text-xs rounded-2xl p-1.5 transition-all duration-300 ${
                      isThisCommentHighlighted
                        ? 'bg-blue-50/90 dark:bg-blue-950/60 ring-2 ring-blue-500 dark:ring-blue-400 shadow-sm'
                        : ''
                    }`}
                  >
                    <img 
                      src={comment.author?.avatar || DEFAULT_AVATAR} 
                      alt={comment.author?.name || 'Người dùng'} 
                      onClick={() => onOpenProfile && onOpenProfile(comment.author)}
                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
                    />
                    <div className={`flex-1 bg-white dark:bg-slate-800/90 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs ${
                      isSoftHidden ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50/20 dark:bg-amber-950/10' : ''
                    }`}>
                      {isCommentAuthor && isAdminImageReview && (
                        <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900">
                          <div className="flex items-center justify-between gap-2">
                            <span>{comment.imageModeration?.noticeText || getModerationNoticeText('comment', commentImageStatus)}</span>
                            {commentImageStatus === 'rejected_admin' && <button type="button" disabled={pendingCommentAppealId === String(comment.id)} onClick={() => handleCommentModerationAppeal(comment)} className="rounded bg-rose-600 px-2.5 py-1 font-semibold text-white disabled:opacity-50">{pendingCommentAppealId === String(comment.id) ? 'Đang gửi...' : 'Khiếu nại'}</button>}
                          </div>
                          {commentAppealError && <p className="mt-1">{commentAppealError}</p>}
                        </div>
                      )}
                      {/* Tiêu đề cảnh báo nếu đang mở xem bình luận Toxic / NSFW đã ẩn mềm */}
                      {isSoftHidden && isRevealed && (
                        <div className="text-[10px] text-amber-800 dark:text-amber-300 flex items-center justify-between pb-1 border-b border-amber-200 dark:border-amber-800/50 mb-1.5">
                          <span className="flex items-center gap-1 font-semibold">
                            <ShieldAlert className="w-3 h-3 text-amber-600" />
                            Bình luận nhạy cảm (${revealedBadge} - đang hiển thị)
                          </span>
                          <button 
                            type="button"
                            onClick={() => setRevealedComments(prev => ({ ...prev, [comment.id]: false }))} 
                            className="text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                          >
                            <EyeOff className="w-3 h-3" /> Ẩn lại
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span 
                            onClick={() => onOpenProfile && onOpenProfile(comment.author)}
                            className="font-bold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition"
                          >
                            {comment.author?.name}
                          </span>
                          {(comment.author?.isVerified || comment.author?.is_verified) && (
                            <VerifiedBadge size="xs" />
                          )}
                          {isThisCommentHighlighted && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-600 text-white rounded-full flex items-center gap-1 animate-pulse">
                              <span>Bình luận được nhắc đến</span>
                            </span>
                          )}
                        </div>
                      </div>
                      {comment.content && <p className="text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">{comment.content}</p>}

                      {/* Hiển thị hình ảnh đính kèm (ẩn mềm chung đã được mở, không lồng thêm lớp blur thứ hai) */}
                      {comment.image && (
                        <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 max-w-xs group">
                          {['sensitive', 'rejected_admin', 'appeal_pending'].includes(commentImageStatus) && !isRevealed ? (
                            <div className="relative">
                              <img src={comment.image} alt="Bình luận có ảnh" className="w-full max-h-52 object-cover blur-xl select-none scale-105" />
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/60 text-center text-white">
                                <span className="text-[11px] font-semibold">Nội dung nhạy cảm</span>
                                <button type="button" onClick={() => setRevealedComments((previous) => ({ ...previous, [comment.id]: true }))} className="rounded bg-white/20 px-3 py-1 text-[10px] font-semibold">Xem</button>
                              </div>
                            </div>
                          ) : (
                            <img src={comment.image} alt="Bình luận có ảnh" className="w-full max-h-52 object-cover rounded-lg cursor-pointer hover:opacity-95 transition" onClick={() => window.open(comment.image, '_blank')} />
                          )}
                        </div>
                      )}

                      {/* Hàng hành động: Thời gian, Trả lời bình luận, và Báo cáo vi phạm rõ ràng */}
                      <div className="flex items-center gap-3 mt-2 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-400 font-medium">
                        <span>{comment.time}</span>
                        <button
                          type="button"
                          onClick={() => handleReplyToComment(comment)}
                          disabled={isBanned || isCooldown}
                          className={`transition flex items-center gap-1 font-semibold ${
                            (isBanned || isCooldown)
                              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50'
                              : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer'
                          }`}
                        >
                          <Reply className="w-3 h-3 text-blue-600" />
                          <span>Trả lời</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenReportModal && onOpenReportModal({
                            targetType: 'comment',
                            targetId: comment.id,
                            targetAuthor: comment.author,
                            contentExcerpt: comment.content || (comment.image ? '[Hình ảnh]' : ''),
                            imageUrl: comment.image || null,
                            aiStatus: { label: comment.ai_label || 'Normal', confidence: 0.90 }
                          })}
                          title="Báo cáo bình luận này"
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ml-auto font-medium"
                        >
                          <Flag className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">Báo cáo</span>
                        </button>
                      </div>
                    </div>
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
      {isReactionsModalOpen && (
        <PostReactionsModal
          isOpen={isReactionsModalOpen}
          onClose={() => setIsReactionsModalOpen(false)}
          postId={post.id}
          post={post}
          currentUser={currentUser}
          onOpenProfile={onOpenProfile}
          onRequireAuth={onRequireAuth}
        />
      )}
    </div>
  );
}

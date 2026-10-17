import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  MessageCircle, Share2, Bookmark, MoreHorizontal, ShieldCheck, 
  CheckCircle2, Send, ThumbsUp, Flag, Scale, ShieldAlert, AlertCircle, Pencil, Trash2, ExternalLink,
  Image as ImageIcon, X, Eye, EyeOff, Loader2, Sparkles
} from 'lucide-react';
import { sharePost, updatePostReaction, uploadPostImage } from '../api/client';
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
import { shouldClosePostMenuForPointer } from '../utils/menuLogic';
import EditPostModal from './EditPostModal';
import DeletePostModal from './DeletePostModal';
import InlineNotice from './InlineNotice';
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
  const [commentImageLabel, setCommentImageLabel] = useState('Safe');
  const [isUploadingCommentImage, setIsUploadingCommentImage] = useState(false);
  const [unblurredComments, setUnblurredComments] = useState({});
  const commentFileInputRef = useRef(null);

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

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      if (onRequireAuth) onRequireAuth("Chỉ đăng nhập mới được bình luận, khi bấm vào nút bình luận mà chưa đăng nhập sẽ bị chuyển tới màn hình đăng nhập (User Story 5)");
      return;
    }
    if (!commentText.trim() && !commentImageFile) return;

    let uploadedUrl = null;
    if (commentImageFile) {
      try {
        setIsUploadingCommentImage(true);
        uploadedUrl = await uploadPostImage(commentImageFile);
      } catch (err) {
        console.error('Lỗi tải ảnh bình luận:', err);
        alert('Không thể tải ảnh bình luận lên. Vui lòng thử lại!');
        setIsUploadingCommentImage(false);
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
      imageLabel: commentImageLabel || 'Safe',
      time: "Vừa xong",
      likes: 0
    });

    setCommentText('');
    handleRemoveCommentImage();
    setCommentImageLabel('Safe');
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

  return (
    <div 
      id={`post-${post.id}`}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 mb-5 overflow-hidden shadow-xs hover:border-slate-300/80 dark:hover:border-slate-700 transition-all duration-300"
    >
      
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
              {post.author?.isVerified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
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
        <div className="min-w-0 w-full bg-slate-100 border-y border-slate-100 flex items-center justify-center">
          <img 
            src={post.image} 
            alt="Ảnh đính kèm bài viết" 
            className="block h-auto max-h-[75vh] w-full object-contain"
            loading="lazy"
            decoding="async"
          />
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
                      {post.originalPost.author?.isVerified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
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
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">Nhãn test ảnh:</span>
                    <select
                      value={commentImageLabel}
                      onChange={(e) => setCommentImageLabel(e.target.value)}
                      className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md px-2 py-0.5 font-medium text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="Safe">Safe (An toàn)</option>
                      <option value="NSFW">NSFW (Nhạy cảm - che mờ)</option>
                      <option value="Violence">Violence (Bạo lực)</option>
                    </select>
                  </div>
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
                  onClick={() => {
                    if (!currentUser && onRequireAuth) {
                      onRequireAuth("Chỉ đăng nhập mới được bình luận, khi bấm vào nút bình luận mà chưa đăng nhập sẽ bị chuyển tới màn hình đăng nhập (User Story 5)");
                    }
                  }}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={currentUser ? "Viết bình luận công khai..." : "Đăng nhập để viết bình luận..."}
                  className="w-full pl-3 pr-16 py-1.5 text-xs bg-white border border-slate-200 rounded-full focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
              post.comments.map((comment) => {
                const isThisCommentHighlighted = highlightedCommentId && String(comment.id) === String(highlightedCommentId);
                return (
                  <div 
                    key={comment.id} 
                    id={`comment-${comment.id}`}
                    className={`flex gap-2.5 items-start text-xs rounded-2xl p-1.5 transition-all duration-500 ${
                      isThisCommentHighlighted
                        ? 'bg-blue-50/90 dark:bg-blue-950/60 ring-2 ring-blue-500 dark:ring-blue-400 shadow-sm'
                        : ''
                    }`}
                  >
                    <img 
                      src={comment.author.avatar} 
                      alt={comment.author.name} 
                      onClick={() => onOpenProfile && onOpenProfile(comment.author)}
                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
                    />
                    <div className="flex-1 bg-white dark:bg-slate-800/90 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span 
                            onClick={() => onOpenProfile && onOpenProfile(comment.author)}
                            className="font-bold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition"
                          >
                            {comment.author.name}
                          </span>
                          {isThisCommentHighlighted && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-600 text-white rounded-full flex items-center gap-1 animate-pulse">
                              <span>Bình luận được nhắc đến</span>
                            </span>
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
                      {comment.content && <p className="text-slate-700 dark:text-slate-200">{comment.content}</p>}

                      {comment.image && (
                        <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 max-w-xs group">
                          {comment.imageLabel === 'NSFW' && !unblurredComments[comment.id] ? (
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
                              {comment.imageLabel === 'NSFW' && unblurredComments[comment.id] && (
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

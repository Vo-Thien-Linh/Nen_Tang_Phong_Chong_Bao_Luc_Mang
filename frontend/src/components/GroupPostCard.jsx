import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Reply,
  Scale,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  createPost,
  createCommunityGroupPostAppeal,
  createCommunityGroupPostComment,
  createCommunityGroupReport,
  deleteCommunityGroupPost,
  fetchCommunityGroupPostComments,
  previewPostImage,
  shareCommunityGroupPost,
  toggleSaveCommunityGroupPost,
  updateCommunityGroupPost,
  updateCommunityGroupCommentReaction,
  updateCommunityGroupPostReaction,
  uploadCommunityGroupPostImage,
} from '../api/client';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { applyReactionCounts, applyReactionState, getSummaryReactions, getTotalReactionCount, normalizeReactionCounts, REACTIONS } from '../utils/reactionLogic';
import { selectGroupModerationPreview } from '../utils/groupModerationPreview';
import { validateImageFile } from '../utils/imageLogic';
import DeletePostModal from './DeletePostModal';
import EditPostModal from './EditPostModal';
import HashtagText from './HashtagText';
import PostReactionsModal from './PostReactionsModal';
import ReportModal from './ReportModal';
import SharePostModal from './SharePostModal';
import AppealModal from './AppealModal';
import VerifiedBadge from './VerifiedBadge';
import CommentEmojiPicker from './CommentEmojiPicker';
import CommentReactionButton from './CommentReactionButton';
import { buildCommentTree } from '../utils/commentThreadLogic';

const moderationLabels = {
  Normal: 'Nội dung văn bản',
  'No text': 'Không có văn bản',
  Toxic: 'Có thể xúc phạm',
  'Hate Speech': 'Có thể thù ghét',
  Violence: 'Có thể bạo lực',
  SAFE: 'Ảnh an toàn',
  SENSITIVE: 'Ảnh nhạy cảm',
  PENDING_REVIEW: 'Ảnh cần xem xét',
  VIOLATION: 'Ảnh vi phạm',
  safe: 'Ảnh an toàn',
  sensitive: 'Ảnh nhạy cảm',
  pending_review: 'Ảnh cần xem xét',
  rejected: 'Ảnh vi phạm',
};

function formatDate(value) {
  if (!value) return 'Vừa xong';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa xong';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function ModerationBadge({ post }) {
  const moderation = selectGroupModerationPreview(
    { label: post.aiLabel, confidence: post.aiConfidence, source: post.aiSource },
    post.imageModeration,
  );
  if (!moderation || moderation.severity === 0) return null;
  const label = moderation.confidenceLabel || moderationLabels[moderation.label] || 'Cần xem xét';
  const confidence = moderation.confidence == null ? '' : ` · ${Math.round(moderation.confidence * 100)}%`;
  const color = moderation.severity >= 3
    ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
  return <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${color}`}><ShieldCheck size={12} />{label}{confidence}</p>;
}

export default function GroupPostCard({
  post,
  currentUser,
  canInteract = false,
  currentGroupRole = null,
  onRequireAuth,
  onOpenGroup,
  onOpenProfile,
  onPostUpdated,
  onPostDeleted,
  onToggleSave,
  showGroup = false,
}) {
  const [reaction, setReaction] = useState(post.myReaction || (post.isLiked ? 'like' : null));
  const [reactionCounts, setReactionCounts] = useState(() => normalizeReactionCounts(post.reactionCounts));
  const [likesCount, setLikesCount] = useState(() => getTotalReactionCount(post.reactionCounts) || Number(post.likesCount || 0));
  const [commentsCount, setCommentsCount] = useState(Number(post.commentsCount || 0));
  const [sharesCount, setSharesCount] = useState(Number(post.sharesCount || 0));
  const [isSaved, setIsSaved] = useState(Boolean(post.isSaved));
  const [comments, setComments] = useState([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [commentImageFile, setCommentImageFile] = useState(null);
  const [commentImagePreview, setCommentImagePreview] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [hoveredReactionId, setHoveredReactionId] = useState(null);
  const [reactionsModalOpen, setReactionsModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const authorName = post.author?.name || post.authorName || 'Thành viên';
  const authorAvatar = post.author?.avatar || post.authorAvatar;
  const authorVerified = Boolean(post.authorIsVerified || post.author?.isVerified);
  const isAuthor = Boolean(currentUser?.id && String(currentUser.id) === String(post.authorId || post.author?.id));
  const canModerateGroup = ['owner', 'admin', 'moderator'].includes(currentGroupRole);
  const groupId = post.groupId;
  const menuRef = useRef(null);
  const commentFileInputRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const reactionPickerCloseTimerRef = useRef(null);
  const reactionLongPressTimerRef = useRef(null);
  const isLongPressingReactionRef = useRef(false);
  const hoveredReactionRef = useRef(null);
  const suppressReactionClickRef = useRef(false);
  const reactionHandlerRef = useRef(null);

  useEffect(() => {
    setReaction(post.myReaction || (post.isLiked ? 'like' : null));
    const counts = normalizeReactionCounts(post.reactionCounts);
    setReactionCounts(counts);
    setLikesCount(getTotalReactionCount(counts) || Number(post.likesCount || 0));
    setCommentsCount(Number(post.commentsCount || 0));
    setSharesCount(Number(post.sharesCount || 0));
    setIsSaved(Boolean(post.isSaved));
  }, [post.myReaction, post.isLiked, post.reactionCounts, post.likesCount, post.commentsCount, post.sharesCount, post.isSaved]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!commentImageFile) {
      setCommentImagePreview('');
      return undefined;
    }
    const url = URL.createObjectURL(commentImageFile);
    setCommentImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [commentImageFile]);

  useEffect(() => {
    const handleGroupRealtime = (event) => {
      const payload = event.detail;
      if (!payload || String(payload.postId) !== String(post.id)) return;
      if (payload.type === 'GROUP_COMMENT_CREATED' && payload.comment) {
        setComments((prev) => {
          if (prev.some((item) => String(item.id) === String(payload.comment.id))) return prev;
          setCommentsCount((count) => count + 1);
          return [...prev, payload.comment];
        });
      }
    };
    window.addEventListener('nexussocial:group-realtime', handleGroupRealtime);
    return () => window.removeEventListener('nexussocial:group-realtime', handleGroupRealtime);
  }, [post.id]);

  const ensureMember = () => {
    if (!currentUser?.id) {
      onRequireAuth?.('Đăng nhập và tham gia nhóm để tương tác với bài viết.');
      return false;
    }
    if (!canInteract) {
      setError('Hãy tham gia nhóm để thích, bình luận hoặc chia sẻ bài viết.');
      return false;
    }
    return true;
  };

  const handleReaction = async (reactionType = reaction || 'like') => {
    if (!ensureMember() || busyAction === 'reaction') return;
    setBusyAction('reaction');
    setError('');
    const previousReaction = reaction;
    const previousCounts = reactionCounts;
    const nextState = applyReactionState({ currentReaction: reaction, totalCount: likesCount, selectedReaction: reactionType });
    const nextCounts = applyReactionCounts({ counts: reactionCounts, previousReaction, nextReaction: nextState.myReaction });
    setReaction(nextState.myReaction);
    setReactionCounts(nextCounts);
    setLikesCount(nextState.totalCount);
    try {
      const result = await updateCommunityGroupPostReaction({
        groupId,
        postId: post.id,
        type: nextState.myReaction,
        action: nextState.myReaction ? 'set' : 'remove',
      });
      setReaction(result.data?.myReaction || null);
      const syncedCounts = normalizeReactionCounts(result.data?.reactionCounts || nextCounts);
      setReactionCounts(syncedCounts);
      setLikesCount(getTotalReactionCount(syncedCounts) || Number(result.data?.likesCount || 0));
    } catch (requestError) {
      setReaction(previousReaction);
      setReactionCounts(previousCounts);
      setLikesCount(getTotalReactionCount(previousCounts) || Number(post.likesCount || 0));
      setError(requestError.message || 'Không thể cập nhật cảm xúc.');
    } finally {
      setBusyAction('');
      setReactionPickerOpen(false);
    }
  };

  useEffect(() => {
    reactionHandlerRef.current = handleReaction;
  });

  const handleOpenReactionPicker = () => {
    if (reactionPickerCloseTimerRef.current) {
      clearTimeout(reactionPickerCloseTimerRef.current);
      reactionPickerCloseTimerRef.current = null;
    }
    setReactionPickerOpen(true);
  };

  const handleCloseReactionPicker = (delay = 350) => {
    if (reactionPickerCloseTimerRef.current) clearTimeout(reactionPickerCloseTimerRef.current);
    reactionPickerCloseTimerRef.current = setTimeout(() => {
      setReactionPickerOpen(false);
      setHoveredReactionId(null);
      hoveredReactionRef.current = null;
      reactionPickerCloseTimerRef.current = null;
    }, delay);
  };

  const handleReactionPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (reactionLongPressTimerRef.current) clearTimeout(reactionLongPressTimerRef.current);
    isLongPressingReactionRef.current = false;
    reactionLongPressTimerRef.current = setTimeout(() => {
      isLongPressingReactionRef.current = true;
      handleOpenReactionPicker();
    }, 260);
  };

  useEffect(() => {
    const setHoveredFromPoint = (event) => {
      if (!isLongPressingReactionRef.current) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const reactionButton = target?.closest('[data-group-reaction-id]');
      const nextId = reactionPickerRef.current?.contains(reactionButton)
        ? reactionButton.getAttribute('data-group-reaction-id')
        : null;
      hoveredReactionRef.current = nextId;
      setHoveredReactionId(nextId);
    };
    const finishLongPress = (event) => {
      if (reactionLongPressTimerRef.current) {
        clearTimeout(reactionLongPressTimerRef.current);
        reactionLongPressTimerRef.current = null;
      }
      if (!isLongPressingReactionRef.current) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const reactionButton = target?.closest('[data-group-reaction-id]');
      const selectedId = (reactionPickerRef.current?.contains(reactionButton)
        ? reactionButton.getAttribute('data-group-reaction-id')
        : null) || hoveredReactionRef.current;
      isLongPressingReactionRef.current = false;
      if (selectedId) {
        suppressReactionClickRef.current = true;
        window.setTimeout(() => { suppressReactionClickRef.current = false; }, 0);
        reactionHandlerRef.current?.(selectedId);
      }
      setHoveredReactionId(null);
      hoveredReactionRef.current = null;
    };
    const cancelLongPress = () => {
      const wasLongPressing = isLongPressingReactionRef.current;
      if (reactionLongPressTimerRef.current) clearTimeout(reactionLongPressTimerRef.current);
      reactionLongPressTimerRef.current = null;
      isLongPressingReactionRef.current = false;
      if (wasLongPressing) setReactionPickerOpen(false);
      setHoveredReactionId(null);
      hoveredReactionRef.current = null;
    };
    document.addEventListener('pointermove', setHoveredFromPoint);
    document.addEventListener('pointerup', finishLongPress);
    document.addEventListener('pointercancel', cancelLongPress);
    return () => {
      document.removeEventListener('pointermove', setHoveredFromPoint);
      document.removeEventListener('pointerup', finishLongPress);
      document.removeEventListener('pointercancel', cancelLongPress);
      if (reactionLongPressTimerRef.current) clearTimeout(reactionLongPressTimerRef.current);
      if (reactionPickerCloseTimerRef.current) clearTimeout(reactionPickerCloseTimerRef.current);
    };
  }, []);

  const handleToggleComments = async () => {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    setError('');
    if (!nextOpen || comments.length || loadingComments) return;
    setLoadingComments(true);
    try {
      const result = await fetchCommunityGroupPostComments({ groupId, postId: post.id });
      const list = Array.isArray(result.data) ? result.data : [];
      setComments(list);
      setCommentsCount(list.length);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải bình luận.');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCommentImageChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setError('');
    setCommentImageFile(file);
  };

  const handleSubmitComment = async (event) => {
    event.preventDefault();
    if (!ensureMember() || submittingComment || (!commentText.trim() && !commentImageFile)) return;
    setSubmittingComment(true);
    setError('');
    try {
      let imageUrl = null;
      let imageCleanupToken = null;
      if (commentImageFile) {
        const preview = await previewPostImage(commentImageFile, currentUser?.id);
        if (preview?.failed || preview?.category === 'VIOLATION') {
          throw new Error(preview?.category === 'VIOLATION'
            ? 'Ảnh bình luận vi phạm tiêu chuẩn cộng đồng và không thể đăng.'
            : 'Không thể kiểm duyệt ảnh bình luận lúc này.');
        }
        const uploaded = await uploadCommunityGroupPostImage(commentImageFile);
        imageUrl = uploaded.url;
        imageCleanupToken = uploaded.cleanupToken;
      }
      const result = await createCommunityGroupPostComment({
        groupId,
        postId: post.id,
        content: commentText.trim(),
        parentId: replyingTo?.id || null,
        imageUrl,
        imageCleanupToken,
      });
      setComments((items) => {
        if (items.some((item) => String(item.id) === String(result.data?.id))) return items;
        setCommentsCount((count) => count + 1);
        return [...items, result.data];
      });
      setCommentText('');
      setReplyingTo(null);
      setCommentImageFile(null);
    } catch (requestError) {
      setError(requestError.message || 'Không thể gửi bình luận.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleToggleSave = async () => {
    if (!currentUser?.id) {
      onRequireAuth?.('Vui lòng đăng nhập để lưu bài viết.');
      return;
    }
    if (busyAction === 'save') return;
    const nextState = !isSaved;
    setIsSaved(nextState);
    setBusyAction('save');
    setError('');
    try {
      const result = await toggleSaveCommunityGroupPost({ groupId, postId: post.id });
      const serverSaved = Boolean(result.data?.isSaved);
      setIsSaved(serverSaved);
      setNotice(serverSaved ? 'Đã lưu bài viết nhóm.' : 'Đã bỏ lưu bài viết nhóm.');
      onToggleSave?.(post.id, serverSaved);
    } catch (requestError) {
      setIsSaved(!nextState);
      setError(requestError.message || 'Không thể lưu bài viết.');
    } finally {
      setBusyAction('');
    }
  };

  const handleSaveEdit = async ({ content, imageUrl, imageCleanupToken }) => {
    const result = await updateCommunityGroupPost({ groupId, postId: post.id, content, imageUrl, imageCleanupToken });
    setEditModalOpen(false);
    const updated = result?.data;
    if (updated) {
      onPostUpdated?.(updated);
      setNotice(updated.status === 'pending'
        ? 'Đã cập nhật bài viết; bài đang chờ duyệt lại.'
        : updated.status === 'rejected'
          ? 'Bài viết sau chỉnh sửa đã bị AI từ chối.'
          : 'Đã cập nhật bài viết nhóm.');
    }
    return updated;
  };

  const handleConfirmDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteCommunityGroupPost({ groupId, postId: post.id });
      setDeleteModalOpen(false);
      onPostDeleted?.(post.id);
    } catch (requestError) {
      setDeleteError(requestError.message || 'Không thể xóa bài viết.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmitReport = async (reportData) => {
    try {
      await createCommunityGroupReport({
        groupId,
        targetType: reportData.targetType,
        targetId: reportData.targetId,
        parentPostId: reportData.parentPostId || post.id,
        reason: reportData.reason,
        details: reportData.details,
      });
      setNotice('Đã gửi báo cáo tới quản trị viên nhóm.');
    } catch (requestError) {
      setError(requestError.message || 'Không thể gửi báo cáo.');
    }
  };

  const handleSubmitAppeal = async (appealData) => {
    try {
      await createCommunityGroupPostAppeal({
        groupId,
        postId: post.id,
        appealReason: appealData.appealReason,
      });
      setNotice('Đã gửi đơn kháng cáo tới quản trị viên nhóm.');
    } catch (requestError) {
      setError(requestError.message || 'Không thể gửi kháng cáo.');
    }
  };

  const recordShare = async () => {
    const result = await shareCommunityGroupPost({ groupId, postId: post.id });
    setSharesCount(Number(result.data?.sharesCount || 0));
    return result;
  };

  const handleShareToFeed = async (content) => {
    const sharedContent = [content.trim(), `🔗 ${shareUrl.toString()}`].filter(Boolean).join('\n\n');
    const result = await createPost({ userId: currentUser.id, content: sharedContent });
    if (result?.data?.nudge) throw new Error(result.data.message || 'Bài chia sẻ cần được chỉnh sửa trước khi đăng.');
    await recordShare();
    return result;
  };

  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set('groupId', groupId);
  shareUrl.searchParams.set('groupPostId', post.id);
  shareUrl.hash = 'groups';
  const sharePost = { ...post, id: `group-post-${post.id}`, author: { name: authorName, avatar: authorAvatar } };
  const summaryReactions = getSummaryReactions({ counts: reactionCounts, myReaction: reaction });
  const commentTree = buildCommentTree(comments);
  const openAuthorProfile = (targetUser) => {
    if (!onOpenProfile || !targetUser?.id) return;
    onOpenProfile(targetUser);
  };
  const handleReactionButtonClick = (event) => {
    if (suppressReactionClickRef.current) {
      suppressReactionClickRef.current = false;
      event.preventDefault();
      return;
    }
    handleReaction(reaction || 'like');
  };
  const handleSelectPickerReaction = (event, reactionId) => {
    event.stopPropagation();
    if (suppressReactionClickRef.current) {
      suppressReactionClickRef.current = false;
      return;
    }
    handleReaction(reactionId);
  };

  return (
    <article id={`group-post-${post.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {showGroup && <div className="border-b border-blue-100 bg-blue-50/70 px-4 py-2.5 dark:border-blue-900/50 dark:bg-blue-950/30">
        <button type="button" onClick={() => onOpenGroup?.(groupId, post.id)} className="inline-flex items-center gap-2 text-xs font-bold text-blue-800 hover:text-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-200 dark:hover:text-white">
          <Users size={14} />Đã đăng trong nhóm {post.groupName || 'cộng đồng'}
        </button>
      </div>}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => openAuthorProfile({ id: post.authorId, name: authorName, username: post.username, avatar: authorAvatar, isVerified: authorVerified })}
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <img src={authorAvatar || DEFAULT_AVATAR} alt={authorName} onError={(event) => { event.currentTarget.src = DEFAULT_AVATAR; }} className="h-11 w-11 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openAuthorProfile({ id: post.authorId, name: authorName, username: post.username, avatar: authorAvatar, isVerified: authorVerified })}
                  className="truncate text-left text-sm font-bold text-slate-900 hover:underline dark:text-white"
                >
                  {authorName}
                </button>
                {authorVerified && <VerifiedBadge size="xs" />}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {formatDate(post.createdAt)}
                {post.editedAt && <span className="ml-1.5 text-[11px] text-slate-400">· Đã chỉnh sửa</span>}
              </p>
            </div>
          </div>

          {(canInteract || isAuthor || canModerateGroup) && (
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Tùy chọn bài viết nhóm"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-8 z-30 w-52 rounded-2xl border border-slate-200 bg-white py-1.5 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  {isAuthor && canInteract && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setEditModalOpen(true); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-4 w-4" />
                      <span>Chỉnh sửa bài viết</span>
                    </button>
                  )}
                  {(isAuthor || canModerateGroup) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setDeleteError(''); setDeleteModalOpen(true); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Xóa bài viết</span>
                    </button>
                  )}
                  {isAuthor && (post.status === 'rejected' || (post.aiLabel && !['Normal', 'No text'].includes(post.aiLabel))) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setAppealModalOpen(true); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                    >
                      <Scale className="h-4 w-4" />
                      <span>Khiếu nại kiểm duyệt</span>
                    </button>
                  )}
                  {!isAuthor && canInteract && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setReportTarget({
                          targetType: 'post',
                          targetId: post.id,
                          parentPostId: post.id,
                          targetAuthor: { name: authorName, username: post.username },
                          contentExcerpt: post.content || '[Hình ảnh]',
                          imageUrl: post.imageUrl || post.image || null,
                          aiStatus: { label: post.aiLabel || 'Normal', confidence: Number(post.aiConfidence || 0.9) },
                        });
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      <span>Báo cáo bài viết</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {post.content && (
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 dark:text-slate-100">
            <HashtagText text={post.content} />
          </p>
        )}
        {(post.imageUrl || post.image) && <img src={post.imageUrl || post.image} alt={`Ảnh bài viết${post.groupName ? ` trong nhóm ${post.groupName}` : ''}`} loading="lazy" className={`mt-3 max-h-[32rem] w-full rounded-xl object-contain ${['sensitive', 'pending_review', 'rejected'].includes(post.imageModeration?.decision) ? 'blur-md' : ''}`} />}
        <ModerationBadge post={post} />

        <div className="mt-4 flex items-center justify-between gap-2 border-y border-slate-100 py-2 text-xs text-slate-500 dark:border-slate-800">
          <button type="button" disabled={!likesCount} onClick={() => setReactionsModalOpen(true)} aria-label="Xem ai đã bày tỏ cảm xúc" title="Nhấn để xem ai đã bày tỏ cảm xúc" className="inline-flex min-w-0 items-center gap-1.5 rounded-lg text-left transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default">
            {summaryReactions.map((item) => <span key={item.id} title={item.label} className="text-sm">{item.emoji}</span>)}
            <span>{likesCount.toLocaleString('vi-VN')} cảm xúc</span>
          </button>
          <button type="button" onClick={handleToggleComments} className="shrink-0 hover:underline">{commentsCount.toLocaleString('vi-VN')} bình luận</button>
          <span className="shrink-0">{sharesCount.toLocaleString('vi-VN')} chia sẻ</span>
        </div>

        <div className="relative mt-1 flex items-center border-b border-slate-100 pb-1 dark:border-slate-800">
          <div ref={reactionPickerRef} className="relative flex flex-1 items-center" onMouseEnter={handleOpenReactionPicker} onMouseLeave={() => handleCloseReactionPicker(350)}>
            {reactionPickerOpen && <div role="group" aria-label="Chọn cảm xúc" onMouseEnter={handleOpenReactionPicker} onMouseLeave={() => handleCloseReactionPicker(350)} className="absolute bottom-full left-1/2 z-20 mb-2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {REACTIONS.map((item) => {
                const hovered = hoveredReactionId === item.id;
                return <div key={item.id} className="relative flex flex-col items-center">
                  {hovered && <span className="absolute -top-8 z-20 whitespace-nowrap rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">{item.label}</span>}
                  <button data-reaction-id={item.id} data-group-reaction-id={item.id} type="button" onClick={(event) => handleSelectPickerReaction(event, item.id)} onPointerEnter={() => { hoveredReactionRef.current = item.id; setHoveredReactionId(item.id); }} title={item.label} aria-label={item.label} className={`select-none rounded-full p-1 text-2xl transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${hovered ? '-translate-y-2.5 scale-150 drop-shadow-md' : 'hover:-translate-y-1 hover:scale-125'}`}>{item.emoji}</button>
                </div>;
              })}
            </div>}
            <button type="button" onClick={handleReactionButtonClick} onPointerDown={handleReactionPointerDown} onContextMenu={(event) => event.preventDefault()} disabled={busyAction === 'reaction'} aria-pressed={Boolean(reaction)} aria-expanded={reactionPickerOpen} className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 dark:hover:bg-slate-800 ${REACTIONS.find((item) => item.id === reaction)?.color || 'text-slate-600 dark:text-slate-300'}`}>
              {reaction ? <><span className="text-base">{REACTIONS.find((item) => item.id === reaction)?.emoji}</span>{REACTIONS.find((item) => item.id === reaction)?.label}</> : <><ThumbsUp size={16} />Thích</>}
            </button>
          </div>
          <button type="button" onClick={handleToggleComments} aria-expanded={commentsOpen} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800"><MessageCircle size={16} />Bình luận</button>
          <button type="button" onClick={() => { if (ensureMember()) setShareModalOpen(true); }} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800"><Share2 size={16} />Chia sẻ</button>
          <button
            type="button"
            onClick={handleToggleSave}
            disabled={busyAction === 'save'}
            aria-pressed={isSaved}
            title={isSaved ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 ${isSaved ? 'text-blue-600' : 'text-slate-600 dark:text-slate-300'}`}
          >
            <Bookmark size={16} className={isSaved ? 'fill-current' : ''} />
            <span className="hidden sm:inline">{isSaved ? 'Đã lưu' : 'Lưu'}</span>
          </button>
        </div>

        {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mt-2 text-xs ${error ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{error || notice}</p>}

        {commentsOpen && <section aria-label="Bình luận" className="mt-3 space-y-3 bg-slate-50/70 px-3 py-4 dark:bg-slate-950/30">
          {replyingTo && (
            <div className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-1.5 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              <span>Đang trả lời <strong>@{replyingTo.authorName}</strong></span>
              <button type="button" onClick={() => setReplyingTo(null)} aria-label="Hủy trả lời"><X size={14} /></button>
            </div>
          )}
          {commentImagePreview && (
            <div className="relative inline-block">
              <img src={commentImagePreview} alt="Xem trước ảnh bình luận" className="max-h-28 rounded-xl border border-slate-200 object-cover" />
              <button type="button" onClick={() => setCommentImageFile(null)} aria-label="Bỏ ảnh bình luận" className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-1 text-white"><X size={12} /></button>
            </div>
          )}
          <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
            <img src={currentUser?.avatar || DEFAULT_AVATAR} alt={currentUser?.name || 'Bạn'} onError={(event) => { event.currentTarget.src = DEFAULT_AVATAR; }} className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
            <input ref={commentFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleCommentImageChange} />
            <div className="flex min-w-0 flex-1 items-center rounded-full border border-slate-200 bg-white pr-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:ring-blue-950">
              <input value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={2000} placeholder={replyingTo ? `Trả lời @${replyingTo.authorName}...` : 'Viết bình luận công khai…'} className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm outline-none dark:text-white" />
              <CommentEmojiPicker onSelectEmoji={(emoji) => setCommentText((prev) => `${prev || ''}${emoji}`)} />
              <button type="button" onClick={() => { if (ensureMember()) commentFileInputRef.current?.click(); }} aria-label="Đính kèm ảnh bình luận" className="rounded-full p-1.5 text-slate-400 hover:text-blue-600"><ImageIcon size={16} /></button>
            </div>
            <button type="submit" disabled={submittingComment || (!commentText.trim() && !commentImageFile)} aria-label="Gửi bình luận" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{submittingComment ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button>
          </form>

          {loadingComments ? <p className="flex items-center gap-2 py-3 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Đang tải bình luận…</p> : commentTree.length ? <ul className="space-y-3">
            {commentTree.map((rootComment) => {
              const renderCommentItem = (comment, depth = 0) => {
                const isOwnComment = Boolean(currentUser?.id && String(currentUser.id) === String(comment.authorId));
                const blurCommentImg = ['sensitive', 'pending_review', 'rejected'].includes(comment.imageModeration?.decision);
                return (
                  <div key={comment.id} className={depth > 0 ? `${depth <= 2 ? 'ml-7 sm:ml-9 pl-3 border-l-2 border-slate-200 dark:border-slate-700' : ''} mt-2` : ''}>
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => openAuthorProfile({ id: comment.authorId, name: comment.authorName, username: comment.username, avatar: comment.authorAvatar, isVerified: comment.authorIsVerified })}
                        className="mt-0.5 shrink-0 rounded-full"
                      >
                        <img src={comment.authorAvatar || DEFAULT_AVATAR} alt={comment.authorName || 'Thành viên'} onError={(event) => { event.currentTarget.src = DEFAULT_AVATAR; }} className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="inline-block max-w-full rounded-2xl bg-white px-3 py-2 shadow-xs dark:bg-slate-800/80">
                          <div className="flex flex-wrap items-center gap-x-1.5">
                            <button
                              type="button"
                              onClick={() => openAuthorProfile({ id: comment.authorId, name: comment.authorName, username: comment.username, avatar: comment.authorAvatar, isVerified: comment.authorIsVerified })}
                              className="text-xs font-bold text-slate-800 hover:underline dark:text-slate-100"
                            >
                              {comment.authorName || 'Thành viên'}
                            </button>
                            {comment.authorIsVerified && <VerifiedBadge size="xs" />}
                            <time className="text-[10px] text-slate-400">{formatDate(comment.createdAt)}</time>
                          </div>
                          {comment.content && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200"><HashtagText text={comment.content} /></p>}
                          {comment.imageUrl && (
                            <img src={comment.imageUrl} alt="Ảnh bình luận" loading="lazy" className={`mt-2 max-h-56 rounded-xl object-contain ${blurCommentImg ? 'blur-md' : ''}`} />
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 px-2 text-[11px] font-semibold text-slate-500">
                          <CommentReactionButton
                            initialCounts={comment.reactionCounts || {}}
                            initialMyReaction={comment.myReaction || null}
                            disabled={!canInteract}
                            canReact={Boolean(currentUser?.id && canInteract)}
                            onRequireAuth={() => ensureMember()}
                            onReact={async ({ type, action }) => {
                              const result = await updateCommunityGroupCommentReaction({
                                groupId,
                                postId: post.id,
                                commentId: comment.id,
                                type,
                                action,
                              });
                              if (result?.data) {
                                setComments((prev) => prev.map((item) => (
                                  String(item.id) === String(comment.id)
                                    ? {
                                        ...item,
                                        reactionCounts: result.data.reactionCounts,
                                        totalReactions: result.data.totalReactions,
                                        myReaction: result.data.myReaction,
                                      }
                                    : item
                                )));
                              }
                              return result?.data || null;
                            }}
                          />
                          {canInteract && (
                            <button
                              type="button"
                              onClick={() => setReplyingTo({ id: comment.id, authorName: comment.authorName || 'Thành viên' })}
                              className="inline-flex items-center gap-1 hover:text-blue-600"
                            >
                              <Reply size={12} />Trả lời
                            </button>
                          )}
                          {canInteract && !isOwnComment && (
                            <button
                              type="button"
                              onClick={() => setReportTarget({
                                targetType: 'comment',
                                targetId: comment.id,
                                parentPostId: post.id,
                                targetAuthor: { name: comment.authorName || 'Thành viên', username: comment.username },
                                contentExcerpt: comment.content || '[Hình ảnh]',
                                imageUrl: comment.imageUrl || null,
                                aiStatus: { label: comment.aiLabel || 'Normal', confidence: 0.9 },
                              })}
                              className="text-rose-600 hover:underline"
                            >
                              Báo cáo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                      <div className="space-y-2">
                        {comment.replies.map((reply) => renderCommentItem(reply, depth + 1))}
                      </div>
                    )}
                  </div>
                );
              };
              return (
                <li key={rootComment.id}>
                  {renderCommentItem(rootComment, 0)}
                </li>
              );
            })}
          </ul> : <p className="py-2 text-center text-xs text-slate-500">Chưa có bình luận. Hãy mở đầu cuộc trò chuyện.</p>}
        </section>}
      </div>
      {shareModalOpen && <SharePostModal
        post={sharePost}
        currentUser={currentUser}
        postUrl={shareUrl.toString()}
        onConfirm={handleShareToFeed}
        onComplete={recordShare}
        onClose={() => setShareModalOpen(false)}
      />}
      {reactionsModalOpen && <PostReactionsModal
        isOpen={reactionsModalOpen}
        onClose={() => setReactionsModalOpen(false)}
        postId={post.id}
        post={{ ...post, reactionCounts }}
        groupId={groupId}
        currentUser={currentUser}
        onOpenProfile={onOpenProfile}
        onRequireAuth={onRequireAuth}
      />}
      {editModalOpen && <EditPostModal
        isOpen={editModalOpen}
        post={post}
        hidePrivacy
        uploadImageFn={uploadCommunityGroupPostImage}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSaveEdit}
      />}
      <DeletePostModal
        isOpen={deleteModalOpen}
        post={{ ...post, author: { name: authorName, avatar: authorAvatar } }}
        isDeleting={isDeleting}
        errorMessage={deleteError}
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
      <ReportModal
        isOpen={Boolean(reportTarget)}
        target={reportTarget}
        currentUser={currentUser}
        onClose={() => setReportTarget(null)}
        onSubmitReport={handleSubmitReport}
      />
      <AppealModal
        isOpen={appealModalOpen}
        contentItem={{
          ...post,
          contentType: 'post',
          aiStatus: { label: post.aiLabel || 'Hate Speech', confidence: Number(post.aiConfidence || 0.9), action: post.aiAction || 'hide' },
        }}
        currentUser={currentUser}
        onClose={() => setAppealModalOpen(false)}
        onSubmitAppeal={handleSubmitAppeal}
      />
    </article>
  );
}

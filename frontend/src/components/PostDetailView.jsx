import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, MessageCircle, Heart, Repeat, ShieldAlert, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import PostCard from './PostCard';
import { fetchPostById } from '../api/client';
import { initialPosts } from '../data/mockData';

export default function PostDetailView({
  postId,
  post: initialPost = null,
  meta = null,
  currentUser,
  onBack,
  allPosts = [],
  onUpdatePost,
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
  onSharePost
}) {
  const [post, setPost] = useState(initialPost);
  const [isLoading, setIsLoading] = useState(!initialPost && Boolean(postId));
  const [errorMessage, setErrorMessage] = useState('');

  // Nếu chưa có dữ liệu bài viết (bài viết cũ hoặc điều hướng trực tiếp), tải từ API
  useEffect(() => {
    if (initialPost) {
      setPost(initialPost);
      setIsLoading(false);
      return;
    }

    if (!postId) {
      setErrorMessage('Không tìm thấy mã bài viết.');
      setIsLoading(false);
      return;
    }

    // Kiểm tra xem bài viết có sẵn trong allPosts hoặc initialPosts không
    const sourceList = Array.isArray(allPosts) && allPosts.length > 0 ? allPosts : initialPosts;
    const cachedPost = sourceList.find(
      (p) =>
        String(p.id) === String(postId) ||
        String(p.id) === String(postId).replace(/^post-/, '') ||
        `post-${p.id}` === String(postId)
    ) || initialPosts.find(
      (p) =>
        String(p.id) === String(postId) ||
        String(p.id) === String(postId).replace(/^post-/, '') ||
        `post-${p.id}` === String(postId)
    );

    if (cachedPost) {
      setPost(cachedPost);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage('');

    fetchPostById({ postId: String(postId), userId: currentUser?.id })
      .then((res) => {
        if (!isMounted) return;
        const fetchedData = res?.data || res;
        if (fetchedData && (fetchedData.id || fetchedData.content)) {
          setPost(fetchedData);
        } else {
          setErrorMessage('Bài viết không tồn tại hoặc đã bị tác giả xóa.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Lỗi khi tải chi tiết bài viết:', err);
        const fallback = initialPosts.find(
          (p) =>
            String(p.id) === String(postId) ||
            String(p.id) === String(postId).replace(/^post-/, '') ||
            `post-${p.id}` === String(postId)
        );
        if (fallback) {
          setPost(fallback);
        } else {
          setErrorMessage('Không thể tải bài viết này. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [postId, initialPost, allPosts, currentUser?.id]);

  // Cập nhật post cục bộ khi allPosts thay đổi (vd người dùng like, cmt, share)
  useEffect(() => {
    if (post?.id && allPosts?.length) {
      const updated = allPosts.find((p) => String(p.id) === String(post.id));
      if (updated && updated !== post) {
        setPost(updated);
      }
    }
  }, [allPosts, post?.id]);

  // Thuật toán đề xuất Bài viết liên quan & Gợi ý (Related & Suggested Posts)
  const relatedPosts = useMemo(() => {
    if (!post?.id) return [];

    const pool = (Array.isArray(allPosts) && allPosts.length > 1) ? allPosts : initialPosts;
    const currentId = String(post.id);
    const authorId = post.author?.id;
    const postWords = new Set(
      (post.content || '')
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .split(/\s+/)
        .filter((w) => w.length >= 3)
    );

    const scored = pool
      .filter((p) => String(p.id) !== currentId && String(p.id) !== currentId.replace(/^post-/, '') && !p.inlineNotice)
      .map((p) => {
        let score = 0;
        // Ưu tiên 1: Cùng tác giả bài viết
        if (authorId && p.author?.id === authorId) {
          score += 20;
        }
        // Ưu tiên 2: Trùng từ khóa nội dung
        if (p.content) {
          const words = p.content
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
            .split(/\s+/);
          let matchCount = 0;
          for (const w of words) {
            if (postWords.has(w)) matchCount++;
          }
          score += matchCount * 4;
        }
        // Ưu tiên 3: Bài viết có thảo luận và tương tác cao
        const reactions = Number(p.reactionCount || p.likesCount || p.totalReactions || 0);
        const comments = Array.isArray(p.comments) ? p.comments.length : Number(p.commentsCount || 0);
        score += reactions * 0.8 + comments * 1.5;

        return { ...p, _relScore: score };
      })
      .sort((a, b) => b._relScore - a._relScore);

    return scored.slice(0, 4);
  }, [post?.id, post?.author?.id, post?.content, allPosts]);

  return (
    <div className="w-full max-w-[760px] mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      
      {/* Thanh điều hướng quay lại & Breadcrumb */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>

        <div className="text-xs font-semibold text-slate-400 dark:text-slate-500">
          <span>Bảng tin</span>
          <span className="mx-1.5">/</span>
          <span className="text-blue-600 dark:text-blue-400 font-bold">Chi tiết bài viết</span>
        </div>
      </div>

      {/* Trạng thái Loading Skeleton */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-40" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-24" />
            </div>
          </div>
          <div className="space-y-2.5 pt-2">
            <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-full" />
            <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
            <div className="h-3.5 bg-slate-100 dark:bg-slate-800/60 rounded w-2/3" />
          </div>
          <div className="h-60 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-full" />
          <div className="flex items-center justify-center py-4 text-xs font-semibold text-slate-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Đang tải nội dung bài viết từ máy chủ...</span>
          </div>
        </div>
      ) : errorMessage ? (
        /* Trạng thái lỗi không tìm thấy bài viết */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Không tìm thấy bài viết
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {errorMessage}
            </p>
          </div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại trang trước</span>
          </button>
        </div>
      ) : post ? (
        <div className="space-y-6">
          {/* Thẻ bài viết chính được hiển thị tiêu điểm với đầy đủ tính năng */}
          <div className="relative">
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              allPosts={allPosts}
              onUpdatePost={onUpdatePost}
              onToggleLike={onToggleLike}
              onAddComment={onAddComment}
              onOpenReportModal={onOpenReportModal}
              onOpenAppealModal={onOpenAppealModal}
              onRequireAuth={onRequireAuth}
              onRequireLogin={onRequireLogin}
              onOpenProfile={onOpenProfile}
              onEditPost={onEditPost}
              onDeletePost={onDeletePost}
              openPostMenuId={openPostMenuId}
              onTogglePostMenu={onTogglePostMenu}
              onClosePostMenu={onClosePostMenu}
              onDismissNotice={onDismissNotice}
              onSharePost={onSharePost}
              isTargeted={meta?.type === 'comment'}
              targetType={meta?.type}
              targetActor={meta?.actor}
              targetCommentId={meta?.targetCommentId}
            />
          </div>

          {/* ================= KHU VỰC BÀI VIẾT LIÊN QUAN & GỢI Ý ================= */}
          {relatedPosts.length > 0 && (
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      Bài viết liên quan & Gợi ý
                      <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {relatedPosts.length} bài
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Các bài viết cùng tác giả hoặc chủ đề sôi nổi có thể bạn quan tâm
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {relatedPosts.map((relPost) => (
                  <PostCard
                    key={relPost.id}
                    post={relPost}
                    currentUser={currentUser}
                    allPosts={allPosts}
                    onUpdatePost={onUpdatePost}
                    onToggleLike={onToggleLike}
                    onAddComment={onAddComment}
                    onOpenReportModal={onOpenReportModal}
                    onOpenAppealModal={onOpenAppealModal}
                    onRequireAuth={onRequireAuth}
                    onRequireLogin={onRequireLogin}
                    onOpenProfile={onOpenProfile}
                    onEditPost={onEditPost}
                    onDeletePost={onDeletePost}
                    openPostMenuId={openPostMenuId}
                    onTogglePostMenu={onTogglePostMenu}
                    onClosePostMenu={onClosePostMenu}
                    onDismissNotice={onDismissNotice}
                    onSharePost={onSharePost}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

    </div>
  );
}

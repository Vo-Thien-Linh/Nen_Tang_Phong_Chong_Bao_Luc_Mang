function formatRelativeTime(createdAt) {
  if (!createdAt) return 'Vừa xong';
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return 'Vừa xong';

  const diffMs = Date.now() - createdDate.getTime();
  if (diffMs < 60_000) return 'Vừa xong';

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  return `${Math.floor(diffHours / 24)} ngày trước`;
}

export function mapPostToResponse(post) {
  return {
    id: String(post.id),
    title: post.title,
    content: post.content,
    image: post.image_url || null,
    createdAt: formatRelativeTime(post.created_at),
    createdAtIso: post.created_at,
    author: {
      id: post.author_id,
      name: post.full_name,
      username: post.username,
      avatar: post.avatar_url,
      isVerified: Boolean(post.is_verified),
    },
    tags: [],
    likesCount: post.likes_count || 0,
    reactionCounts: post.reaction_counts || {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    },
    totalReactions: Number(post.total_reactions ?? post.likes_count ?? 0),
    myReaction: post.my_reaction || null,
    sharesCount: post.shares_count || 0,
    comments: [],
    aiStatus: {
      label: post.ai_label || 'Normal',
      confidence: Number(post.ai_confidence ?? 0.99),
      status: post.ai_status || 'approved',
    },
    moderationStatus: post.ai_status || 'approved',
  };
}

export function createPostsController({ postService }) {
  return {
    async createPost(req, res, next) {
      try {
        const post = await postService.createPost({
          user: req.user,
          title: req.body?.title,
          content: req.body?.content,
          imageUrl: req.body?.imageUrl,
        });

        res.status(201).json({
          success: true,
          message: 'Đăng bài thành công',
          data: mapPostToResponse(post),
        });
      } catch (error) {
        next(error);
      }
    },

    async listPosts(req, res, next) {
      try {
        const posts = await postService.listVisiblePosts({ user: req.user });
        res.json({
          success: true,
          data: posts.map(mapPostToResponse),
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

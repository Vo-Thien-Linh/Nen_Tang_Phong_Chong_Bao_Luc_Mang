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
    comments: (post.comments || []).map((c) => ({
      id: String(c.id),
      author: {
        id: c.author?.id,
        name: c.author?.name || c.full_name || 'Người dùng',
        avatar: c.author?.avatar || c.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
      },
      content: c.content,
      time: formatRelativeTime(c.created_at),
      createdAt: c.created_at,
    })),
    aiStatus: {
      label: post.ai_label || 'Normal',
      confidence: Number(post.ai_confidence ?? 0.99),
      status: post.ai_status || 'approved',
    },
    moderationStatus: post.ai_status || 'approved',
  };
}

export function createPostsController({ postService, postRepository }) {
  return {
    async createPost(req, res, next) {
      try {
        const post = await postService.createPost({
          user: req.user,
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

    async createComment(req, res, next) {
      try {
        const { postId } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
          return res.status(400).json({ success: false, message: 'Nội dung bình luận không được rỗng' });
        }

        const comment = await postRepository.createComment({
          postId,
          authorId: req.user.id,
          content: content.trim(),
        });

        res.status(201).json({
          success: true,
          message: 'Bình luận thành công',
          data: {
            id: String(comment.id),
            author: {
              id: comment.author_id,
              name: comment.full_name,
              avatar: comment.avatar_url,
            },
            content: comment.content,
            time: 'Vừa xong',
            createdAt: comment.created_at,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

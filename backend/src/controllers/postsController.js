import { realtimeService } from '../services/realtimeService.js';
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
    imageModeration: post.image_moderation_status ? {
      status: post.image_moderation_status,
      label: post.image_moderation_label,
      scores: { safe: post.image_moderation_safe, nsfw: post.image_moderation_nsfw, violence: post.image_moderation_violence },
    } : null,
    createdAt: formatRelativeTime(post.created_at),
    createdAtIso: post.created_at,
    editedAt: post.edited_at || null,
    isEdited: Boolean(post.edited_at),
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
    totalReactions: Number(post.total_reactions || post.likes_count || 0),
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
      image: c.image || c.image_url || null,
      imageLabel: c.imageLabel || c.image_label || 'Safe',
      time: formatRelativeTime(c.created_at),
      createdAt: c.created_at,
    })),
    aiStatus: {
      label: post.ai_label || 'Normal',
      confidence: Number(post.ai_confidence ?? 0.99),
      status: post.ai_status || 'approved',
    },
    moderationStatus: post.ai_status || 'approved',
    // Thông tin bài gốc nếu đây là bài chia sẻ
    originalPost: post.original_post
      ? {
          id: String(post.original_post.id),
          content: post.original_post.content,
          image: post.original_post.image_url || null,
          createdAt: formatRelativeTime(post.original_post.created_at),
          likesCount: Number(post.original_post.likes_count || 0),
          commentsCount: Number(post.original_post.comments_count || 0),
          sharesCount: Number(post.original_post.shares_count || 0),
          author: {
            id: post.original_post.author_id,
            name: post.original_post.full_name,
            username: post.original_post.username,
            avatar: post.original_post.avatar_url,
          },
        }
      : post.original_post_id
        ? null   // Bài gốc đã bị xóa (SET NULL không còn)
        : undefined,
  };
}

export function createPostsController({ postService, postRepository, imageModerationClient }) {
  return {
    async createPost(req, res, next) {
      try {
        const post = await postService.createPost({
          user: req.user,
          content: req.body?.content,
          imageUrl: req.body?.imageUrl,
        });

        const mappedPost = mapPostToResponse(post);
        realtimeService.broadcast({
          type: 'POST_CREATED',
          post: mappedPost,
        });

        res.status(201).json({
          success: true,
          message: 'Đăng bài thành công',
          data: mappedPost,
        });
      } catch (error) {
        next(error);
      }
    },

    async getPost(req, res, next) {
      try {
        const post = await postService.getVisiblePost({
          user: req.user,
          postId: req.params.postId,
        });

        res.json({
          success: true,
          data: mapPostToResponse(post),
        });
      } catch (error) {
        next(error);
      }
    },

    async editPost(req, res, next) {
      try {
        const post = await postService.editPost({
          user: req.user,
          postId: req.params.postId,
          content: req.body?.content,
          imageUrl: req.body?.imageUrl,
        });

        res.json({
          success: true,
          message: 'Cập nhật bài viết thành công',
          data: mapPostToResponse(post),
        });
      } catch (error) {
        next(error);
      }
    },

    async deletePost(req, res, next) {
      try {
        await postService.deletePost({
          user: req.user,
          postId: req.params.postId,
        });

        realtimeService.broadcast({
          type: 'POST_DELETED',
          postId: String(req.params.postId),
        });

        res.json({
          success: true,
          message: 'Xóa bài viết thành công',
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
        const { content, imageUrl, imageLabel } = req.body || {};

        if ((!content || !content.trim()) && !imageUrl) {
          return res.status(400).json({ success: false, message: 'Nội dung hoặc ảnh bình luận không được rỗng' });
        }

        const imageModeration = imageUrl && imageModerationClient
          ? await imageModerationClient(imageUrl)
          : null;
        if (imageModeration?.decision === 'rejected') {
          return res.status(422).json({ success: false, code: 'CONTENT_VIOLATION', message: 'Bài viết của bạn vi phạm quy định cộng đồng' });
        }
        const comment = await postRepository.createComment({
          postId,
          authorId: req.user.id,
          content: (content || '').trim(),
          imageUrl: imageUrl || null,
          imageLabel: imageLabel || 'Safe',
          imageModeration,
        });

        const commentData = {
          id: String(comment.id),
          author: {
            id: comment.author_id,
            name: comment.full_name,
            avatar: comment.avatar_url,
          },
          content: comment.content,
          image: comment.image_url || null,
          imageLabel: comment.image_label || 'Safe',
          time: 'Vừa xong',
          createdAt: comment.created_at,
        };

        realtimeService.broadcast({
          type: 'COMMENT_CREATED',
          postId: String(postId),
          comment: commentData,
        });

        res.status(201).json({
          success: true,
          message: 'Bình luận thành công',
          data: commentData,
        });
      } catch (error) {
        next(error);
      }
    },

    async sharePost(req, res, next) {
      try {
        const { postId } = req.params;
        const { content } = req.body || {};

        const sharedPost = await postService.sharePost({
          user: req.user,
          originalPostId: postId,
          content: content || '',
        });

        const mappedSharedPost = mapPostToResponse(sharedPost);
        realtimeService.broadcast({
          type: 'POST_SHARED',
          post: mappedSharedPost,
          originalPostId: String(postId),
        });

        res.status(201).json({
          success: true,
          message: 'Chia sẻ bài viết thành công',
          data: mappedSharedPost,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

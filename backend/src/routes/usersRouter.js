import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';

/**
 * Chuyển đổi dữ liệu user từ DB sang format chuẩn cho Frontend
 */
function formatUserProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.full_name,
    full_name: row.full_name,
    avatar: row.avatar_url,
    avatar_url: row.avatar_url,
    cover: row.cover_url,
    cover_url: row.cover_url,
    role: row.role,
    isVerified: row.is_verified,
    is_verified: row.is_verified,
    bio: row.bio || '',
    location: row.location || '',
    hometown: row.hometown || '',
    education: row.education || '',
    highSchool: row.high_school || '',
    high_school: row.high_school || '',
    relationship: row.relationship_status || '',
    relationship_status: row.relationship_status || '',
    status: row.status,
    postsCount: row.posts_count || 0,
    friendsCount: row.friends_count || 0,
    joinedDate: row.created_at
      ? new Date(row.created_at).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
      : '',
  };
}

function formatFriend(row) {
  return {
    id: row.id,
    username: row.username,
    name: row.full_name,
    avatar: row.avatar_url,
    avatar_url: row.avatar_url,
    isVerified: row.is_verified,
    bio: row.bio || '',
    location: row.location || '',
  };
}

export function createUsersRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const { requireAuth, optionalAuth } = createAuthMiddleware({ userRepository });

  /**
   * GET /api/users/:userId/profile
   * Lấy thông tin trang cá nhân đầy đủ từ DB
   */
  router.get('/:userId/profile', optionalAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const row = await userRepository.findProfileById(userId, req.user?.id || null);

      if (!row) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      }

      res.json({ success: true, data: formatUserProfile(row) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PATCH /api/users/:userId/profile
   * Cập nhật thông tin trang cá nhân (bio, location, v.v.)
   * Yêu cầu đăng nhập và chỉ được sửa trang của chính mình
   */
  router.patch('/:userId/profile', requireAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;

      // Chỉ cho phép sửa profile của chính mình
      if (req.user.id !== userId) {
        return res.status(403).json({ success: false, message: 'Không có quyền chỉnh sửa trang cá nhân của người khác' });
      }

      const { bio, location, hometown, education, high_school, relationship_status, avatar_url, cover_url } = req.body;
      const updated = await userRepository.updateProfile(userId, {
        bio, location, hometown, education, high_school, relationship_status, avatar_url, cover_url
      });

      if (!updated) {
        return res.status(400).json({ success: false, message: 'Không có trường nào được cập nhật' });
      }

      res.json({ success: true, data: formatUserProfile(updated), message: 'Đã cập nhật thông tin cá nhân' });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/users/:userId/friends
   * Lấy danh sách bạn bè của người dùng (tối đa 6 người)
   */
  router.get('/:userId/friends', optionalAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit) || 6;
      const friends = await userRepository.findFriends(userId, limit);

      res.json({ success: true, data: friends.map(formatFriend) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/users/:userId/posts
   * Lấy tất cả bài viết của một người dùng cụ thể
   */
  router.get('/:userId/posts', optionalAuth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const viewerId = req.user?.id || null;
      const posts = await userRepository.findUserPosts(userId, viewerId);

      // Chuyển đổi sang format chuẩn Frontend (tương tự postsController)
      const formatted = posts.map(p => ({
        id: String(p.id),
        author: {
          id: p.author_id,
          name: p.full_name,
          username: p.username,
          avatar: p.avatar_url,
          isVerified: p.is_verified,
        },
        content: p.content,
        image: p.image_url || null,
        imageModeration: p.imageModeration || null,
        createdAt: p.created_at,
        likesCount: p.likes_count || 0,
        commentsCount: p.comments_count || 0,
        sharesCount: p.shares_count || 0,
        isLiked: p.my_reaction != null,
        myReaction: p.my_reaction || null,
        reactionCounts: p.reaction_counts || {},
        aiStatus: {
          label: p.ai_label || 'Normal',
          confidence: parseFloat(p.ai_confidence) || 0.99,
        },
        aiStatusValue: p.ai_status || 'approved',
        comments: (p.comments || []).map(c => ({
          id: c.id,
          author: c.author,
          content: c.content,
          image: c.image || null,
          imageModeration: c.imageModeration || null,
          time: c.created_at,
        })),
        originalPost: p.original_post_id && p.orig_id ? {
          id: String(p.orig_id),
          content: p.orig_content,
          image: p.orig_image_url || null,
          createdAt: p.orig_created_at,
          likesCount: Number(p.orig_likes_count || 0),
          commentsCount: Number(p.orig_comments_count || 0),
          sharesCount: Number(p.orig_shares_count || 0),
          author: {
            id: p.orig_author_id,
            name: p.orig_author_name,
            username: p.orig_author_username,
            avatar: p.orig_author_avatar,
            isVerified: p.orig_author_is_verified,
          },
        } : null,
      }));

      res.json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

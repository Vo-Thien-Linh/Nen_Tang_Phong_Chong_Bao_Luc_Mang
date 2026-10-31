import { calculateTrustDeduction, applyTrustPenalty } from '../services/trustScoreService.js';
import { realtimeService } from '../services/realtimeService.js';
import { moderateTextContent } from '../utils/textModerator.js';
import { harmonizeModeration } from '../utils/moderationHarmonizer.js';
import { formatImageModerationForViewer } from '../services/imageModerationResponse.js';
import { getModerationNoticeText } from '../services/moderationNotificationText.js';
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

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;

  if (diffDays < 30) {
    const diffWeeks = Math.floor(diffDays / 7);
    return diffWeeks <= 1 ? 'tuần trước' : `${diffWeeks} tuần trước`;
  }

  if (diffDays < 365) {
    const diffMonths = Math.max(1, Math.floor(diffDays / 30));
    return `${diffMonths} tháng trước`;
  }

  const day = String(createdDate.getDate()).padStart(2, '0');
  const month = String(createdDate.getMonth() + 1).padStart(2, '0');
  const year = createdDate.getFullYear();
  return `${day}/${month}/${year}`;
}

export function mapPostToResponse(post, viewerId = null) {
  const imageModeration = formatImageModerationForViewer(post.image_moderation_status ? {
    status: post.image_moderation_status,
    label: post.image_moderation_label || null,
    scores: { safe: post.image_moderation_safe, nsfw: post.image_moderation_nsfw, violence: post.image_moderation_violence },
    thresholds: post.image_moderation_thresholds || null,
    appealedAt: post.image_moderation_appealed_at || null,
  } : null, 'post', post.author_id, viewerId);
  return {
    id: String(post.id),
    content: post.content,
    image: post.image_url || null,
    imageModeration,
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
        isVerified: Boolean(c.author?.isVerified || c.author?.is_verified),
        is_verified: Boolean(c.author?.isVerified || c.author?.is_verified),
      },
      content: c.content,
      image: c.image || c.image_url || null,
      imageModeration: formatImageModerationForViewer(c.imageModeration || (c.image_moderation_status ? {
        status: c.image_moderation_status,
        scores: { safe: c.image_moderation_safe, nsfw: c.image_moderation_nsfw, violence: c.image_moderation_violence },
        thresholds: c.image_moderation_thresholds || null,
        appealedAt: c.image_moderation_appealed_at || null,
      } : null), 'comment', c.author?.id ?? c.author_id, viewerId),
      image_label: c.image_label || c.imageLabel || null,
      imageLabel: c.image_label || c.imageLabel || null,
      is_hidden: Boolean(c.is_hidden || c.isHidden),
      isHidden: Boolean(c.is_hidden || c.isHidden),
      is_soft_hidden: Boolean(c.is_soft_hidden || c.isSoftHidden),
      isSoftHidden: Boolean(c.is_soft_hidden || c.isSoftHidden),
      ai_label: c.ai_label || c.aiLabel || 'Normal',
      aiLabel: c.ai_label || c.aiLabel || 'Normal',
      ai_status: c.ai_status || c.aiStatus || 'approved',
      aiStatus: c.ai_status || c.aiStatus || 'approved',
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
          forcePost: Boolean(req.body?.forcePost),
        });

        // Nhắc nhở nhẹ nhàng (Friendly Nudge) nếu người dùng gõ từ ngữ quá khích
        if (post?.nudge) {
          return res.status(200).json({
            success: true,
            nudge: true,
            warningType: post.warningType || 'violence',
            predictedLabel: post.predictedLabel || 'Violence',
            message: post.message || 'Chúng tôi nhận thấy bài viết của bạn có thể chứa từ ngữ bạo lực/xúc phạm người khác. Bạn có muốn xem lại và chỉnh sửa trước khi đăng không?',
          });
        }

        const mappedPost = mapPostToResponse(post, req.user?.id);
        const isHiddenPost = post.ai_status === 'hidden' || mappedPost.moderationStatus === 'hidden';
        if (!isHiddenPost && !['pending_review', 'rejected_hold'].includes(mappedPost.imageModeration?.status)) {
          realtimeService.broadcast({
            type: 'POST_CREATED',
            post: mappedPost,
          });
        }

        res.status(201).json({
          success: true,
          message: isHiddenPost
            ? 'Bài viết đã được tạo nhưng bị ẩn do vi phạm tiêu chuẩn cộng đồng.'
            : 'Đăng bài thành công',
          data: mappedPost,
          cooldown: post.cooldown || null,
        });
      } catch (error) {
        if (error.cooldown) {
          return res.status(403).json({
            success: false,
            message: error.message,
            cooldown: error.cooldown,
          });
        }
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
          data: mapPostToResponse(post, req.user?.id),
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
          forcePost: Boolean(req.body?.forcePost),
        });

        if (post?.nudge) {
          return res.status(200).json({
            success: true,
            nudge: true,
            warningType: post.warningType || 'toxic',
            predictedLabel: post.predictedLabel || 'Toxic',
            message: post.message,
          });
        }

        const mapped = mapPostToResponse(post, req.user?.id);
        res.json({
          success: true,
          message: post.ai_status === 'hidden'
            ? 'Bài viết đã được chỉnh sửa nhưng bị ẩn do vi phạm tiêu chuẩn cộng đồng.'
            : 'Cập nhật bài viết thành công',
          data: mapped,
        });
      } catch (error) {
        next(error);
      }
    },

    async deletePost(req, res, next) {
      try {
        const deleted = await postService.deletePost({
          user: req.user,
          postId: req.params.postId,
        });

        if (!['pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending', 'rejected_final'].includes(deleted.imageModerationStatus)) {
          realtimeService.broadcast({ type: 'POST_DELETED', postId: String(req.params.postId) });
        }

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
          data: posts.map((post) => mapPostToResponse(post, req.user?.id)),
        });
      } catch (error) {
        next(error);
      }
    },

    async createComment(req, res, next) {
      try {
        const { postId } = req.params;
        const { content, imageUrl } = req.body || {};

        let targetPost = null;
        if (postService.getVisiblePost) {
          try {
            targetPost = await postService.getVisiblePost({ user: req.user, postId });
            if (['rejected_admin', 'appeal_pending', 'rejected_final'].includes(targetPost.image_moderation_status)) {
              return res.status(409).json({ success: false, message: 'Không thể bình luận về nội dung đang trong quy trình duyệt' });
            }
          } catch (e) {
            if (e.statusCode === 409) return res.status(409).json({ success: false, message: e.message });
          }
        }

        if (req.user?.status === 'banned') {
          return res.status(403).json({
            success: false,
            message: 'Tài khoản của bạn đã bị khóa, không thể bình luận.',
          });
        }
        if (req.user?.status === 'cooldown' && req.user?.cooldown_until && new Date(req.user.cooldown_until) > new Date()) {
          return res.status(403).json({
            success: false,
            message: 'Bạn đang trong thời gian bị hạn chế đăng bài và bình luận.',
          });
        }

        if ((!content || !content.trim()) && !imageUrl) {
          return res.status(400).json({ success: false, message: 'Nội dung hoặc ảnh bình luận không được rỗng' });
        }

        const normalizedContent = (content || '').trim();
        const forceComment = Boolean(req.body?.forceComment);

        // 1. Kiểm tra danh sách từ khóa cấm của chủ bài viết (Author Keyword Blacklist)
        let postAuthorId = targetPost?.author_id || targetPost?.author?.id;
        if (!postAuthorId && postRepository.findById) {
          try {
            const p = await postRepository.findById(postId, req.user?.id);
            postAuthorId = p?.author_id || p?.author?.id;
          } catch {}
        }
        if (!postAuthorId && postRepository.pool) {
          try {
            const cleanPostId = Number(String(postId).replace(/\D/g, '')) || postId;
            const resAuthor = await postRepository.pool.query('SELECT author_id FROM posts WHERE id = $1', [cleanPostId]);
            postAuthorId = resAuthor.rows[0]?.author_id;
          } catch {}
        }

        let authorKeywords = [];
        if (req.body?.authorFilterKeywords) {
          if (Array.isArray(req.body.authorFilterKeywords)) {
            authorKeywords = req.body.authorFilterKeywords.map(s => String(s).trim().toLowerCase()).filter(Boolean);
          } else if (typeof req.body.authorFilterKeywords === 'string') {
            authorKeywords = req.body.authorFilterKeywords.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
          }
        }

        if (authorKeywords.length === 0 && postAuthorId && postRepository.pool) {
          try {
            const settingsRes = await postRepository.pool.query(
              'SELECT filter_keywords FROM user_settings WHERE user_id = $1',
              [postAuthorId]
            );
            const rawKeywords = settingsRes.rows[0]?.filter_keywords;
            if (rawKeywords) {
              authorKeywords = rawKeywords.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            }
          } catch (err) {
            // DB fallback
          }
        }

        const isPostAuthor = req.user && postAuthorId && String(req.user.id) === String(postAuthorId);
        let matchedAuthorKeyword = null;

        if (!isPostAuthor && normalizedContent && authorKeywords.length > 0) {
          const lowerContent = normalizedContent.toLowerCase();
          for (const kw of authorKeywords) {
            if (!kw) continue;
            if (lowerContent.includes(kw)) {
              matchedAuthorKeyword = kw;
              break;
            }
          }
        }

        // Nếu chứa từ khóa cấm của chủ bài viết:
        // - Lần đầu gửi: Cảnh báo chặn bằng Friendly Nudge
        // - Nếu cố tình gửi (forceComment): Tự động ẨN bình luận hoàn toàn
        if (matchedAuthorKeyword && !forceComment) {
          return res.status(200).json({
            success: true,
            nudge: true,
            warningType: 'keyword_blacklist',
            matchedKeyword: matchedAuthorKeyword,
            predictedLabel: 'Từ khóa cấm của chủ bài viết',
            message: `Bình luận của bạn chứa từ ngữ trong danh sách cấm của chủ bài viết ("${matchedAuthorKeyword}"). Bạn có muốn chỉnh sửa lại không? Nếu tiếp tục gửi, bình luận sẽ tự động bị ẩn.`,
          });
        }

        if (matchedAuthorKeyword && forceComment) {
          const hiddenComment = await postRepository.createComment({
            postId,
            authorId: req.user.id,
            content: normalizedContent,
            imageUrl: imageUrl || null,
            aiLabel: 'Author Blacklist',
            aiStatus: 'hidden',
            isHidden: true,
            isSoftHidden: false,
          });

          return res.status(200).json({
            success: true,
            message: `Bình luận đã tự động bị ẩn do chứa từ khóa trong danh sách cấm của chủ bài viết ("${matchedAuthorKeyword}").`,
            data: hiddenComment,
            isAuthorBlacklisted: true,
          });
        }

        const textMod = normalizedContent
          ? await moderateTextContent(normalizedContent)
          : { label: 'Normal', confidence: 1.0 };

        const imageModeration = imageUrl && imageModerationClient
          ? await imageModerationClient(imageUrl)
          : null;
        const heldModeration = imageModeration?.decision === 'rejected'
          ? { ...imageModeration, decision: 'rejected_hold' }
          : imageModeration;

        // Kết hợp hài hoà kiểm duyệt ngôn từ và hình ảnh (NSFW -> Toxic, Violence -> Violence)
        const harmonized = harmonizeModeration({
          textMod,
          imageModeration: heldModeration,
          contentType: 'comment',
        });

        // Nhắc nhở nhẹ nhàng (Friendly Nudge) nếu bình luận chứa từ ngữ tiêu cực hoặc vi phạm (Toxic, Hate Speech, Violence)
        const isTextViolation = textMod && ['Violence', 'Hate Speech', 'Toxic'].includes(textMod.label);
        const isViolationOrNegative = isTextViolation || harmonized.applyCooldown;

        if (isViolationOrNegative && !forceComment) {
          let nudgeMsg = 'Chúng tôi nhận thấy bình luận của bạn có thể chứa từ ngữ tiêu cực hoặc xúc phạm người khác. Bạn có muốn xem lại và chỉnh sửa trước khi gửi không?';
          let warningType = 'toxic';
          if (harmonized.finalLabel === 'Violence') {
            nudgeMsg = 'Chúng tôi nhận thấy bình luận của bạn có thể chứa từ ngữ bạo lực hoặc đe dọa người khác. Bạn có muốn xem lại và chỉnh sửa trước khi gửi không?';
            warningType = 'violence';
          } else if (harmonized.finalLabel === 'Hate Speech') {
            nudgeMsg = 'Chúng tôi nhận thấy bình luận của bạn có thể chứa ngôn từ mang tính thù ghét hoặc kích động. Bạn có muốn xem lại và chỉnh sửa trước khi gửi không?';
            warningType = 'hate_speech';
          }

          return res.status(200).json({
            success: true,
            nudge: true,
            warningType,
            predictedLabel: harmonized.finalLabel || textMod?.label || 'Toxic',
            message: nudgeMsg,
          });
        }

        // Áp dụng Cooldown nếu vi phạm Bạo lực
        if (harmonized.applyCooldown) {

          // CỐ TÌNH BẤM GỬI -> PHẠT COOLDOWN VÀ ẨN BÌNH LUẬN
          const d = new Date(Date.now() + harmonized.cooldownMinutes * 60 * 1000);
          if (postRepository.pool) {
            await postRepository.pool.query(
              `UPDATE users
               SET status = 'cooldown', cooldown_until = $1, cooldown_reason = 'Vi phạm bạo lực trong bình luận', cooldown_violation_text = $2, updated_at = CURRENT_TIMESTAMP
               WHERE id = $3`,
              [d.toISOString(), normalizedContent || '[Hình ảnh bạo lực]', req.user.id]
            );
          }

          const hiddenComment = await postRepository.createComment({
            postId,
            authorId: req.user.id,
            content: normalizedContent,
            imageUrl: imageUrl || null,
            aiLabel: harmonized.finalLabel,
            aiStatus: 'hidden',
            isHidden: true,
            isSoftHidden: false,
            ...(heldModeration ? { imageModeration: heldModeration } : {}),
          });

          if (postRepository.pool && harmonized.notificationMessage) {
            try {
              await postRepository.pool.query(
                `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
                 VALUES ($1, $2, 'ai_moderation', $3, $4)`,
                [req.user.id, req.user.id, harmonized.notificationMessage, postId]
              );
            } catch (err) {}
          }

          // Trừ điểm uy tín khi bình luận bạo lực
          const commentViolentDeduction = calculateTrustDeduction(
            harmonized.finalLabel || textMod?.label || 'Violence',
            heldModeration?.decision || (harmonized.isImageViolence ? 'rejected_hold' : 'safe')
          );
          if (commentViolentDeduction > 0 && postRepository.pool) {
            try {
              await applyTrustPenalty({
                pool: postRepository.pool,
                userId: req.user.id,
                amount: commentViolentDeduction,
                reason: `Bình luận vi phạm: ${harmonized.reason || harmonized.finalLabel}`,
                actionType: 'comment_violation',
                contentId: hiddenComment?.id || postId,
              });
            } catch (trustErr) {
              console.error('Lỗi trừ điểm uy tín khi bình luận:', trustErr.message);
            }
          }

          const commentCooldown = {
            status: 'cooldown',
            cooldown_until: d.toISOString(),
            cooldown_reason: 'Vi phạm bạo lực trong bình luận',
          };
          return res.status(403).json({
            success: false,
            message: 'Bình luận vi phạm tiêu chuẩn bạo lực. Bình luận đã bị ẩn và bạn bị hạn chế đăng bài, bình luận trong 10 phút.',
            cooldown: commentCooldown,
            data: hiddenComment,
          });
        }

        // Tự động gửi thông báo kiểm duyệt về tài khoản khi bình luận bị ẩn (Hate Speech hoặc Violence)
        if (postRepository.pool && harmonized.notificationMessage) {
          try {
            await postRepository.pool.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
               VALUES ($1, $2, 'ai_moderation', $3, $4)`,
              [req.user.id, req.user.id, harmonized.notificationMessage, postId]
            );
          } catch (err) {
            console.error('Lỗi gửi thông báo kiểm duyệt comment:', err.message);
          }
        }

        const comment = await postRepository.createComment({
          postId,
          authorId: req.user.id,
          content: normalizedContent,
          imageUrl: imageUrl || null,
          imageModeration: heldModeration,
          aiLabel: harmonized.finalLabel,
          aiConfidence: harmonized.confidence,
          isHidden: harmonized.isHidden,
          isSoftHidden: harmonized.isSoftHidden,
          aiStatus: harmonized.aiStatus,
        });

        // Trừ điểm uy tín nếu bình luận vi phạm (Toxic, Hate Speech, NSFW...)
        const commentDeduction = calculateTrustDeduction(
          harmonized.finalLabel || textMod?.label || 'Normal',
          heldModeration?.decision || (harmonized.isImageNsfw ? 'sensitive' : 'safe')
        );
        if (commentDeduction > 0 && postRepository.pool) {
          try {
            await applyTrustPenalty({
              pool: postRepository.pool,
              userId: req.user.id,
              amount: commentDeduction,
              reason: `Bình luận vi phạm: ${harmonized.reason || harmonized.finalLabel}`,
              actionType: 'comment_violation',
              contentId: comment?.id || postId,
            });
          } catch (trustErr) {
            console.error('Lỗi trừ điểm uy tín khi bình luận:', trustErr.message);
          }
        }

        const commentData = {
          id: String(comment.id),
          author: {
            id: comment.author_id,
            name: comment.full_name,
            avatar: comment.avatar_url,
            isVerified: Boolean(comment.is_verified),
          },
          content: comment.content,
          image: comment.image_url || null,
          is_hidden: Boolean(comment.is_hidden),
          isHidden: Boolean(comment.is_hidden),
          is_soft_hidden: Boolean(comment.is_soft_hidden),
          isSoftHidden: Boolean(comment.is_soft_hidden),
          ai_label: comment.ai_label,
          aiLabel: comment.ai_label,
          ai_status: comment.ai_status,
          aiStatus: comment.ai_status,
          imageModeration: comment.image_moderation_status ? {
            status: comment.image_moderation_status,
            noticeText: getModerationNoticeText('comment', comment.image_moderation_status),
            noticeType: comment.image_moderation_status,
            canAppeal: ['rejected_admin', 'rejected_hold'].includes(comment.image_moderation_status),
            appealedAt: comment.image_moderation_appealed_at || null,
            scores: { safe: comment.image_moderation_safe, nsfw: comment.image_moderation_nsfw, violence: comment.image_moderation_violence },
          } : null,
          time: 'Vừa xong',
          createdAt: comment.created_at,
        };

        if (!harmonized.isHidden && !['pending_review', 'rejected_hold'].includes(commentData.imageModeration?.status)) {
          realtimeService.broadcast({
            type: 'COMMENT_CREATED',
            postId: String(postId),
            comment: commentData,
          });
        }

        const commentCooldown = harmonized.applyCooldown ? {
          status: 'cooldown',
          cooldown_until: new Date(Date.now() + harmonized.cooldownMinutes * 60 * 1000).toISOString(),
          cooldown_reason: 'Vi phạm bạo lực trong bình luận',
        } : null;

        res.status(201).json({
          success: true,
          message: harmonized.isHidden
            ? 'Bình luận đã được ghi nhận nhưng bị ẩn do vi phạm tiêu chuẩn cộng đồng.'
            : 'Bình luận thành công',
          data: commentData,
          cooldown: commentCooldown,
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

        const mappedSharedPost = mapPostToResponse(sharedPost, req.user?.id);
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

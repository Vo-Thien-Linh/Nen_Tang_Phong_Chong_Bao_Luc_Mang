import { moderateTextContent } from '../utils/textModerator.js';
import { harmonizeModeration } from '../utils/moderationHarmonizer.js';

export function createPostService({ postRepository, moderationHook, imageModerationClient, clock = () => new Date() }) {
  const holdViolent = (result) => result?.decision === 'rejected'
    ? { ...result, decision: 'rejected_hold', moderationExpiresAt: new Date(clock().getTime() + Number(result.thresholds?.appeal_window_minutes || 10) * 60_000).toISOString() }
    : result;
  const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
  const normalizeImageUrl = (value) => {
    if (value === null) return null;
    return normalizeText(value) || null;
  };

  const isRestrictedUser = (user) => {
    if (!user) return false;
    if (user.status === 'banned') return true;
    if (user.status === 'cooldown' || user.cooldown_until) {
      if (!user.cooldown_until) return true;
      const cooldownUntil = new Date(user.cooldown_until);
      return !Number.isNaN(cooldownUntil.getTime()) && cooldownUntil > clock();
    }
    return false;
  };

  return {
    async createPost({ user, content, imageUrl, forcePost }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để đăng bài');
        error.statusCode = 401;
        throw error;
      }

      if (isRestrictedUser(user)) {
        const error = new Error('Tài khoản của bạn đang bị hạn chế đăng bài và bình luận');
        error.statusCode = 403;
        throw error;
      }

      const normalizedContent = normalizeText(content);

      if (!normalizedContent) {
        const error = new Error('Nội dung là bắt buộc');
        error.statusCode = 400;
        throw error;
      }

      const textMod = await moderateTextContent(normalizedContent);

      const imageModeration = imageUrl && imageModerationClient
        ? await imageModerationClient(imageUrl)
        : null;
      const heldModeration = holdViolent(imageModeration);

      // Kết hợp hài hoà kiểm duyệt ngôn từ và hình ảnh
      const harmonized = harmonizeModeration({
        textMod,
        imageModeration: heldModeration,
        contentType: 'post',
      });

      // Nhắc nhở nhẹ nhàng (Friendly Nudge) nếu vi phạm Bạo lực/Xúc phạm
      if (harmonized.applyCooldown) {
        if (!forcePost) {
          return {
            nudge: true,
            warningType: 'violence',
            predictedLabel: harmonized.finalLabel || 'Violence',
            message: 'Chúng tôi nhận thấy bài viết của bạn có thể chứa từ ngữ bạo lực/xúc phạm người khác. Bạn có muốn xem lại và chỉnh sửa trước khi đăng không?',
          };
        }

        // Người dùng đã được cảnh báo và chọn [Vẫn tiếp tục đăng] -> Kích hoạt ẩn bài và phạt Cooldown 10 phút
        const d = new Date(clock().getTime() + harmonized.cooldownMinutes * 60 * 1000);
        if (postRepository.pool) {
          await postRepository.pool.query(
            `UPDATE users
             SET status = 'cooldown', cooldown_until = $1, cooldown_reason = 'Vi phạm bạo lực trong bài viết', cooldown_violation_text = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [d.toISOString(), normalizedContent || '[Hình ảnh bạo lực]', user.id]
          );
        }

        const hiddenPost = await postRepository.createPost({
          authorId: user.id,
          content: normalizedContent,
          imageUrl: normalizeText(imageUrl) || null,
          createdAt: clock(),
          aiStatus: 'hidden',
          aiLabel: harmonized.finalLabel,
          aiConfidence: harmonized.confidence,
          ...(heldModeration ? { imageModeration: heldModeration } : {}),
        });

        if (postRepository.pool && harmonized.notificationMessage) {
          const cleanPostId = Number(String(hiddenPost?.id || '').replace(/\D/g, '')) || null;
          try {
            await postRepository.pool.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
               VALUES ($1, $2, 'ai_moderation', $3, $4)`,
              [user.id, user.id, harmonized.notificationMessage, cleanPostId]
            );
          } catch (notifErr) {
            console.error('Lỗi gửi thông báo kiểm duyệt bài viết:', notifErr.message);
          }
        }

        const error = new Error('Nội dung vi phạm tiêu chuẩn bạo lực. Bài viết đã bị ẩn và bạn bị hạn chế đăng bài, bình luận trong 10 phút.');
        error.statusCode = 403;
        error.cooldown = {
          status: 'cooldown',
          cooldown_until: d.toISOString(),
          cooldown_reason: 'Vi phạm bạo lực trong bài viết',
        };
        error.post = hiddenPost;
        throw error;
      }

      const postInput = {
        authorId: user.id,
        content: normalizedContent,
        imageUrl: normalizeText(imageUrl) || null,
        createdAt: clock(),
      };
      if (harmonized.aiStatus && harmonized.aiStatus !== 'approved') {
        postInput.aiStatus = harmonized.aiStatus;
      }
      if (harmonized.finalLabel && harmonized.finalLabel !== 'Normal') {
        postInput.aiLabel = harmonized.finalLabel;
        postInput.aiConfidence = harmonized.confidence;
      }
      if (heldModeration) {
        postInput.imageModeration = heldModeration;
      }

      const post = await postRepository.createPost(postInput);

      // Tự động gửi thông báo kiểm duyệt về tài khoản khi bài viết bị ẩn do vi phạm
      if (postRepository.pool && harmonized.notificationMessage) {
        const cleanPostId = Number(String(post?.id || '').replace(/\D/g, '')) || null;
        try {
          await postRepository.pool.query(
            `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
             VALUES ($1, $2, 'ai_moderation', $3, $4)`,
            [user.id, user.id, harmonized.notificationMessage, cleanPostId]
          );
        } catch (notifErr) {
          console.error('Lỗi gửi thông báo kiểm duyệt bài viết:', notifErr.message);
        }
      }

      await moderationHook.afterPostCreated(post);
      return post;
    },

    async listVisiblePosts({ user }) {
      return postRepository.findVisiblePosts({ viewerId: user?.id || null });
    },

    async getVisiblePost({ user, postId }) {
      const post = await postRepository.findById(postId, user?.id || null);
      if (!post || (post.ai_status !== 'approved' && post.author_id !== user?.id)) {
        const error = new Error('Bài viết không tồn tại');
        error.statusCode = 404;
        throw error;
      }
      return post;
    },

    async editPost({ user, postId, content, imageUrl }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để tiếp tục');
        error.statusCode = 401;
        throw error;
      }

      const existingPost = await postRepository.findById(postId, user.id);
      if (!existingPost) {
        const error = new Error('Bài viết không tồn tại');
        error.statusCode = 404;
        throw error;
      }

      if (existingPost.author_id !== user.id) {
        const error = new Error('Bạn không có quyền chỉnh sửa bài viết này');
        error.statusCode = 403;
        throw error;
      }

      if (['rejected_admin', 'appeal_pending', 'rejected_final'].includes(existingPost.image_moderation_status)) {
        const error = new Error('Không thể chỉnh sửa nội dung đang trong quy trình duyệt');
        error.statusCode = 409;
        throw error;
      }

      if (existingPost.ai_status === 'hidden') {
        const error = new Error('Bài viết đang bị ẩn nên không thể chỉnh sửa');
        error.statusCode = 403;
        throw error;
      }
      if (existingPost.image_moderation_status === 'rejected_hold' && new Date(existingPost.moderation_expires_at) > clock()) {
        const error = new Error('Bài viết đang trong thời gian kháng cáo và không thể chỉnh sửa');
        error.statusCode = 409;
        throw error;
      }

      if (isRestrictedUser(user)) {
        const error = new Error('Tài khoản của bạn đang bị hạn chế');
        error.statusCode = 403;
        throw error;
      }

      const normalizedContent = normalizeText(content);
      if (!normalizedContent) {
        const error = new Error('Nội dung không được để trống');
        error.statusCode = 400;
        throw error;
      }

      const imageModeration = imageUrl && imageModerationClient
        ? await imageModerationClient(imageUrl)
        : null;
      const heldModeration = holdViolent(imageModeration);

      const post = await postRepository.updatePost({
        postId,
        authorId: user.id,
        content: normalizedContent,
        imageUrl: normalizeImageUrl(imageUrl),
        ...(heldModeration ? { imageModeration: heldModeration } : {}),
      });

      await moderationHook.afterPostEdited(post);
      return post;
    },

    async deletePost({ user, postId }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để tiếp tục');
        error.statusCode = 401;
        throw error;
      }

      const existingPost = await postRepository.findById(postId, user.id);
      if (!existingPost) {
        const error = new Error('Bài viết không tồn tại');
        error.statusCode = 404;
        throw error;
      }

      if (existingPost.author_id !== user.id) {
        const error = new Error('Bạn không có quyền xóa bài viết này');
        error.statusCode = 403;
        throw error;
      }

      await postRepository.deletePost({ postId, authorId: user.id });
      return { id: String(postId), imageModerationStatus: existingPost.image_moderation_status };
    },

    async sharePost({ user, originalPostId, content }) {
      // 1. Kiểm tra đăng nhập
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để chia sẻ bài viết');
        error.statusCode = 401;
        throw error;
      }

      // 2. Kiểm tra tài khoản không bị hạn chế
      if (isRestrictedUser(user)) {
        const error = new Error('Tài khoản của bạn đang bị hạn chế, không thể chia sẻ bài viết');
        error.statusCode = 403;
        throw error;
      }

      // 3. Kiểm tra bài gốc tồn tại và không bị ẩn
      const originalPost = await postRepository.findById(originalPostId, user.id);
      if (!originalPost) {
        const error = new Error('Bài viết gốc không tồn tại');
        error.statusCode = 404;
        throw error;
      }

      if (originalPost.ai_status === 'hidden' || ['rejected_admin', 'appeal_pending', 'rejected_final'].includes(originalPost.image_moderation_status)) {
        const error = new Error('Không thể chia sẻ bài viết đã bị ẩn');
        error.statusCode = 403;
        throw error;
      }

      // 4. Thực hiện chia sẻ
      const sharedPost = await postRepository.sharePost({
        sharerId: user.id,
        originalPostId,
        content: (content || '').trim(),
      });

      return sharedPost;
    },
  };
}

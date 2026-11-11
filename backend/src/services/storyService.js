import { calculateTrustDeduction, applyTrustPenalty } from './trustScoreService.js';
import { moderateTextContent } from '../utils/textModerator.js';
import { harmonizeModeration } from '../utils/moderationHarmonizer.js';
import { moderateStoryMedia } from './storyModerationService.js';
import { realtimeService } from './realtimeService.js';

export function createStoryService({
  storyRepository,
  imageModerationClient,
  clock = () => new Date(),
}) {
  const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

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
    async createStory({
      user,
      storyType = 'image',
      mediaUrl = null,
      textContent = null,
      backgroundStyle = null,
      privacy = 'public',
      forcePost = false,
    }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để đăng tin');
        error.statusCode = 401;
        throw error;
      }

      if (isRestrictedUser(user)) {
        const error = new Error('Tài khoản của bạn đang bị hạn chế đăng tin và bài viết');
        error.statusCode = 403;
        throw error;
      }

      const normalizedText = normalizeText(textContent);
      const normalizedMedia = normalizeText(mediaUrl);

      // Validate loại tin và nội dung đầu vào
      if (!['text', 'image', 'video'].includes(storyType)) {
        const error = new Error('Loại tin không hợp lệ (hỗ trợ: text, image, video)');
        error.statusCode = 400;
        throw error;
      }

      if (storyType === 'text' && !normalizedText) {
        const error = new Error('Nội dung văn bản là bắt buộc cho tin dạng chữ');
        error.statusCode = 400;
        throw error;
      }

      if ((storyType === 'image' || storyType === 'video') && !normalizedMedia) {
        const error = new Error(`Vui lòng tải lên tệp ${storyType === 'image' ? 'hình ảnh' : 'video'} cho tin`);
        error.statusCode = 400;
        throw error;
      }

      // 1. Kiểm duyệt ngôn từ văn bản bằng PhoBERT
      const textMod = normalizedText ? await moderateTextContent(normalizedText) : null;

      // 2. Kiểm duyệt hình ảnh hoặc trích xuất frame video bằng EfficientNet
      const mediaModeration = normalizedMedia
        ? await moderateStoryMedia({ mediaUrl: normalizedMedia, storyType, imageModerationClient })
        : null;

      // 3. Kết hợp hài hòa kiểm duyệt (Harmonize Moderation)
      const harmonized = harmonizeModeration({
        textMod,
        imageModeration: mediaModeration,
        contentType: 'story',
      });

      // 4. Nhắc nhở nhẹ nhàng (Friendly Nudge) nếu người dùng gõ từ ngữ tiêu cực/vi phạm
      const isTextViolation = textMod && ['Violence', 'Hate Speech', 'Toxic'].includes(textMod.label);
      const isViolationOrNegative = isTextViolation || harmonized.applyCooldown;

      if (isViolationOrNegative && !forcePost) {
        let nudgeMsg = 'Chúng tôi nhận thấy tin của bạn có thể chứa từ ngữ tiêu cực hoặc xúc phạm người khác. Bạn có muốn xem lại và chỉnh sửa trước khi đăng không?';
        let warningType = 'toxic';

        if (harmonized.finalLabel === 'Violence') {
          nudgeMsg = 'Chúng tôi nhận thấy tin của bạn có thể chứa hình ảnh/từ ngữ bạo lực. Bạn có muốn xem lại trước khi chia sẻ không?';
          warningType = 'violence';
        } else if (harmonized.finalLabel === 'Hate Speech') {
          nudgeMsg = 'Chúng tôi nhận thấy tin của bạn có thể chứa ngôn từ mang tính thù ghét hoặc kích động. Bạn có muốn xem lại trước khi chia sẻ không?';
          warningType = 'hate_speech';
        }

        return {
          nudge: true,
          warningType,
          predictedLabel: harmonized.finalLabel || textMod?.label || 'Toxic',
          message: nudgeMsg,
        };
      }

      // 5. Nếu vi phạm Bạo lực (Violence) và người dùng vẫn bấm "Vẫn tiếp tục đăng"
      if (harmonized.applyCooldown) {
        const cooldownEnd = new Date(clock().getTime() + harmonized.cooldownMinutes * 60 * 1000);

        if (storyRepository.pool) {
          await storyRepository.pool.query(
            `UPDATE users
             SET status = 'cooldown', cooldown_until = $1, cooldown_reason = 'Vi phạm bạo lực trong tin', cooldown_violation_text = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [cooldownEnd.toISOString(), normalizedText || `[${storyType} bạo lực]`, user.id]
          );
        }

        const hiddenStory = await storyRepository.createStory({
          authorId: user.id,
          storyType,
          mediaUrl: normalizedMedia || null,
          textContent: normalizedText || null,
          backgroundStyle,
          privacy,
          aiStatus: 'hidden',
          aiLabel: harmonized.finalLabel,
          aiConfidence: harmonized.confidence,
          mediaModeration,
          createdAt: clock(),
        });

        // Gửi thông báo kiểm duyệt vi phạm
        if (storyRepository.pool && harmonized.notificationMessage) {
          try {
            await storyRepository.pool.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content)
               VALUES ($1, $2, 'ai_moderation', $3)`,
              [user.id, null, harmonized.notificationMessage]
            );
          } catch (notifErr) {
            console.error('Lỗi gửi thông báo kiểm duyệt tin:', notifErr.message);
          }
        }

        // Trừ điểm uy tín
        const cpDeduction = calculateTrustDeduction(
          harmonized.finalLabel || textMod?.label || 'Violence',
          mediaModeration?.decision || 'rejected_hold'
        );
        if (cpDeduction > 0 && storyRepository.pool) {
          try {
            await applyTrustPenalty({
              pool: storyRepository.pool,
              userId: user.id,
              amount: cpDeduction,
              reason: `Đăng tin vi phạm bạo lực: ${harmonized.reason || harmonized.finalLabel}`,
              actionType: 'post_violation',
              contentId: hiddenStory?.id,
            });
          } catch (trustErr) {
            console.error('Lỗi trừ điểm uy tín:', trustErr.message);
          }
        }

        const error = new Error('Nội dung tin vi phạm tiêu chuẩn bạo lực. Tin đã bị ẩn và bạn bị hạn chế hoạt động trong 10 phút.');
        error.statusCode = 403;
        error.cooldown = {
          status: 'cooldown',
          cooldown_until: cooldownEnd.toISOString(),
          cooldown_reason: 'Vi phạm bạo lực trong tin',
        };
        error.story = hiddenStory;
        throw error;
      }

      // 6. Lưu trữ tin hợp lệ
      const storyInput = {
        authorId: user.id,
        storyType,
        mediaUrl: normalizedMedia || null,
        textContent: normalizedText || null,
        backgroundStyle,
        privacy,
        createdAt: clock(),
      };

      if (harmonized.aiStatus && harmonized.aiStatus !== 'approved') {
        storyInput.aiStatus = harmonized.aiStatus;
      } else if (harmonized.isSoftHidden) {
        storyInput.aiStatus = 'sensitive';
      }
      if (harmonized.finalLabel && harmonized.finalLabel !== 'Normal') {
        storyInput.aiLabel = harmonized.finalLabel;
        storyInput.aiConfidence = harmonized.confidence;
      }
      if (mediaModeration) {
        storyInput.mediaModeration = mediaModeration;
      }

      const createdStory = await storyRepository.createStory(storyInput);

      // Trừ điểm nếu có vi phạm nhẹ (Toxic / Hate Speech / Sensitive)
      const deduction = calculateTrustDeduction(
        harmonized.finalLabel || textMod?.label || 'Normal',
        mediaModeration?.decision || (harmonized.isImageNsfw ? 'sensitive' : 'safe')
      );
      if (deduction > 0 && storyRepository.pool) {
        try {
          await applyTrustPenalty({
            pool: storyRepository.pool,
            userId: user.id,
            amount: deduction,
            reason: `Đăng tin vi phạm tiêu chuẩn cộng đồng: ${harmonized.reason || harmonized.finalLabel}`,
            actionType: 'post_violation',
            contentId: createdStory?.id,
          });
        } catch (trustErr) {
          console.error('Lỗi trừ điểm uy tín:', trustErr.message);
        }
      }

      // Gửi thông báo kiểm duyệt nếu tin bị ẩn do Hate Speech
      if (storyRepository.pool && harmonized.notificationMessage && createdStory.ai_status === 'hidden') {
        try {
          await storyRepository.pool.query(
            `INSERT INTO notifications (recipient_id, actor_id, type, content)
             VALUES ($1, $2, 'ai_moderation', $3)`,
            [user.id, null, harmonized.notificationMessage]
          );
        } catch (notifErr) {
          console.error('Lỗi gửi thông báo kiểm duyệt tin:', notifErr.message);
        }
      }

      // Gửi thông báo kiểm duyệt nếu tin bị gắn nhãn nhạy cảm (Toxic / NSFW)
      if (storyRepository.pool && harmonized.isSoftHidden && createdStory.ai_status !== 'hidden') {
        try {
          const softMsg = `Tin của bạn đã được đăng nhưng bị gắn nhãn nhạy cảm (${harmonized.finalLabel === 'Toxic' ? 'Ngôn từ độc hại (Toxic)' : 'Hình ảnh nhạy cảm (NSFW)'}) và được che cảnh báo đối với người xem.`;
          await storyRepository.pool.query(
            `INSERT INTO notifications (recipient_id, actor_id, type, content)
             VALUES ($1, $2, 'ai_moderation', $3)`,
            [user.id, null, softMsg]
          );
        } catch (notifErr) {
          console.error('Lỗi gửi thông báo tin nhạy cảm:', notifErr.message);
        }
      }

      // Phát realtime SSE nếu tin không bị ẩn
      if (createdStory.ai_status !== 'hidden') {
        realtimeService.broadcast({
          type: 'STORY_CREATED',
          story: createdStory,
        });
      }

      return createdStory;
    },

    async listFeedStories({ user }) {
      return await storyRepository.listFeedStories({ viewerId: user?.id || null });
    },

    async getUserStories({ user, targetUserId }) {
      return await storyRepository.listUserStories({ targetUserId, viewerId: user?.id || null });
    },

    async listMyArchive({ user, limit = 50, offset = 0 }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để xem kho lưu trữ tin');
        error.statusCode = 401;
        throw error;
      }
      return await storyRepository.listUserArchiveStories({ authorId: user.id, limit, offset });
    },

    async getStoryById({ user, storyId }) {
      const story = await storyRepository.getStoryById(storyId, user?.id || null);
      if (!story) {
        const error = new Error('Tin không tồn tại hoặc đã bị xóa');
        error.statusCode = 404;
        throw error;
      }

      // Nếu tin bị ẩn và không phải chính tác giả/admin xem
      if (story.ai_status === 'hidden' && story.author_id !== user?.id && user?.role !== 'ADMIN') {
        const error = new Error('Tin này đã bị ẩn do vi phạm tiêu chuẩn cộng đồng');
        error.statusCode = 403;
        throw error;
      }

      return story;
    },

    async viewStory({ user, storyId }) {
      if (!user?.id) {
        return { success: false, message: 'Chưa đăng nhập' };
      }
      const recorded = await storyRepository.markStoryAsViewed({ storyId, viewerId: user.id });
      return { success: true, recorded };
    },

    async getStoryViewers({ user, storyId }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để xem danh sách người xem');
        error.statusCode = 401;
        throw error;
      }
      return await storyRepository.getStoryViewers({ storyId, authorId: user.id });
    },

    async reactToStory({ user, storyId, reactionType = 'like' }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để thả cảm xúc cho tin');
        error.statusCode = 401;
        throw error;
      }

      const story = await storyRepository.getStoryById(storyId, user.id);
      if (!story) {
        const error = new Error('Tin không tồn tại hoặc đã bị xóa');
        error.statusCode = 404;
        throw error;
      }

      const result = await storyRepository.reactToStory({ storyId, userId: user.id, reactionType });

      // Thông báo cho tác giả nếu không phải tự thả cảm xúc tin của chính mình
      if (String(story.author_id) !== String(user.id) && storyRepository.pool) {
        try {
          const actorName = user.name || user.full_name || 'Người dùng';
          const allReactions = result?.reactions || [reactionType];
          const distinctReactionTypes = [...new Set(allReactions)];

          const payloadObj = {
            storyId: String(storyId),
            reactionType,
            reactionTypes: distinctReactionTypes,
            actorId: user.id,
            actorName,
            isStory: true,
          };

          // Kiểm tra xem đã có thông báo cảm xúc của người này cho tin này chưa (tránh spam nhiều thông báo)
          const existingNotif = await storyRepository.pool.query(
            `SELECT id FROM notifications 
             WHERE recipient_id = $1 
               AND actor_id = $2 
               AND type = 'story_reaction' 
               AND payload->>'storyId' = $3
             ORDER BY created_at DESC
             LIMIT 1`,
            [story.author_id, user.id, String(storyId)]
          );

          if (existingNotif.rows.length > 0) {
            // Cập nhật thông báo đã có thay vì tạo thêm thông báo mới
            await storyRepository.pool.query(
              `UPDATE notifications 
               SET content = $1, payload = $2, is_read = FALSE, created_at = CURRENT_TIMESTAMP
               WHERE id = $3`,
              [
                `${actorName} đã bày tỏ cảm xúc về tin của bạn.`,
                JSON.stringify(payloadObj),
                existingNotif.rows[0].id,
              ]
            );
          } else {
            // Thêm mới nếu chưa từng có thông báo cho tin này
            await storyRepository.pool.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, payload)
               VALUES ($1, $2, 'story_reaction', $3, $4)`,
              [
                story.author_id,
                user.id,
                `${actorName} đã bày tỏ cảm xúc về tin của bạn.`,
                JSON.stringify(payloadObj),
              ]
            );
          }
        } catch (notifErr) {
          console.warn('Lỗi gửi notification thả reaction tin:', notifErr.message);
        }
      }

      realtimeService.broadcast({
        type: 'STORY_REACTION',
        storyId: String(storyId),
        userId: user.id,
        reactionType,
      });

      return result;
    },

    async deleteStory({ user, storyId }) {
      if (!user?.id) {
        const error = new Error('Bạn cần đăng nhập để xóa tin');
        error.statusCode = 401;
        throw error;
      }
      const isAdmin = user.role === 'ADMIN' || Boolean(user.isAdmin);
      const deleted = await storyRepository.deleteStory({ storyId, userId: user.id, isAdmin });
      if (!deleted) {
        const error = new Error('Tin không tồn tại hoặc đã bị xóa');
        error.statusCode = 404;
        throw error;
      }

      realtimeService.broadcast({
        type: 'STORY_DELETED',
        storyId: String(storyId),
      });

      return true;
    },
  };
}


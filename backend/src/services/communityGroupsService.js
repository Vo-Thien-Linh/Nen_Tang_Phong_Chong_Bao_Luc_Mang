import { calculateTrustDeduction } from './trustScoreService.js';
import { consumeCloudinaryCleanupTicket, verifyCloudinaryCleanupTicket } from '../utils/cloudinaryCleanupTicket.js';

export function createCommunityGroupsService({
  repository,
  moderateTextContent,
  moderateImageUrl,
  deleteUploadedImage = async () => {},
  realtimeService = null,
  cloudinaryCleanupSecret = process.env.CLOUDINARY_API_SECRET || process.env.JWT_SECRET,
}) {
  const allowedReactions = new Set(['like', 'love', 'haha', 'wow', 'sad', 'angry']);
  const fail = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  };
  const requireUser = (user) => {
    if (!user?.id) throw fail('Bạn cần đăng nhập để sử dụng nhóm', 401);
    if (user.status === 'banned') throw fail('Tài khoản của bạn đã bị khóa', 403);
    if (user.status === 'cooldown' && user.cooldown_until && new Date(user.cooldown_until) > new Date()) {
      throw fail('Bạn đang trong thời gian bị hạn chế đăng bài và bình luận', 403);
    }
  };
  const requireGroupId = (groupId) => {
    if (!/^\d+$/.test(String(groupId || '')) || Number(groupId) < 1) throw fail('Mã nhóm không hợp lệ', 400);
  };
  const requireUserId = (userId) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ''))) {
      throw fail('Mã thành viên không hợp lệ', 400);
    }
  };
  const requireGroup = async (groupId, viewerId) => {
    requireGroupId(groupId);
    const group = await repository.findGroup(groupId, viewerId);
    if (!group) throw fail('Không tìm thấy nhóm', 404);
    return group;
  };
  const isGroupModerator = (group) => ['owner', 'admin', 'moderator'].includes(group.currentRole);
  const requireGroupAdmin = (group) => {
    if (!['owner', 'admin'].includes(group.currentRole)) {
      throw fail('Chỉ chủ nhóm hoặc quản trị viên mới có quyền thực hiện thao tác này', 403);
    }
  };
  const requirePostId = (postId) => {
    if (!/^\d+$/.test(String(postId || '')) || Number(postId) < 1) throw fail('Mã bài viết không hợp lệ', 400);
  };
  const requireActiveGroupMember = (group) => {
    if (group.membershipStatus !== 'active') throw fail('Chỉ thành viên đang hoạt động mới có thể tương tác với bài viết nhóm', 403);
  };
  const requireApprovedPost = async ({ groupId, postId }) => {
    const post = await repository.findApprovedPost({ groupId, postId });
    if (!post) throw fail('Không tìm thấy bài viết đã được duyệt trong nhóm này', 404);
    return post;
  };
  const requireId = (id, label) => {
    if (!/^\d+$/.test(String(id || '')) || Number(id) < 1) throw fail(`${label} không hợp lệ`, 400);
  };
  const validateCloudinaryUrl = (requestedImageUrl) => {
    if (typeof requestedImageUrl !== 'string' || requestedImageUrl.length > 2048) {
      throw fail('Đường dẫn ảnh không hợp lệ', 400);
    }
    let parsedImageUrl;
    try {
      parsedImageUrl = new URL(requestedImageUrl);
    } catch {
      throw fail('Đường dẫn ảnh không hợp lệ', 400);
    }
    if (
      parsedImageUrl.protocol !== 'https:' ||
      parsedImageUrl.username ||
      parsedImageUrl.password ||
      (parsedImageUrl.port && parsedImageUrl.port !== '443') ||
      !(parsedImageUrl.hostname === 'cloudinary.com' || parsedImageUrl.hostname.endsWith('.cloudinary.com'))
    ) {
      throw fail('Ảnh phải được tải lên Cloudinary trước khi đăng', 400);
    }
    return parsedImageUrl.toString();
  };
  const runImageModeration = async (cleanImageUrl) => {
    let imageResult;
    try {
      imageResult = await moderateImageUrl(cleanImageUrl);
    } catch {
      throw fail('Không thể kiểm duyệt ảnh lúc này; vui lòng thử lại', 503);
    }
    const scores = imageResult?.scores;
    const scoreValues = scores && ['safe', 'nsfw', 'violence'].map((key) => scores[key]);
    const validScores = scoreValues?.every((score) => Number.isFinite(score) && score >= 0 && score <= 1)
      && Math.abs(scoreValues.reduce((sum, score) => sum + score, 0) - 1) <= 0.01;
    if (imageResult?.failed || !['safe', 'sensitive', 'pending_review', 'rejected'].includes(imageResult?.decision) || !validScores) {
      throw fail('Không thể kiểm duyệt ảnh lúc này; vui lòng thử lại', 503);
    }
    const confidenceKey = { safe: 'safe', sensitive: 'nsfw', rejected: 'violence' }[imageResult.decision];
    const confidenceClass = confidenceKey
      || Object.entries(scores).sort(([, left], [, right]) => right - left)[0][0];
    return {
      label: imageResult.decision,
      decision: imageResult.decision,
      confidence: scores[confidenceClass],
      confidenceLabel: { safe: 'An toàn', nsfw: 'Nhạy cảm', violence: 'Bạo lực' }[confidenceClass],
      scores,
      thresholds: imageResult.thresholds || {},
      source: imageResult.source || 'efficientnet-b1',
    };
  };
  const moderateGroupPostPayload = async ({ group, cleanContent, requestedImageUrl, existingImageUrl = null, existingImageModeration = null }) => {
    let suggestion = cleanContent
      ? { label: 'Review needed', confidence: null, action: 'review', source: 'unavailable' }
      : { label: 'No text', confidence: null, action: 'allow', source: 'not_applicable' };
    let moderationAvailable = !cleanContent;
    if (cleanContent) {
      try {
        const result = await moderateTextContent(cleanContent);
        moderationAvailable = result?.source === 'phobert';
        suggestion = {
          label: result?.label || 'Review needed',
          confidence: result?.confidence != null && Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : null,
          action: ['allow', 'warn', 'hide'].includes(result?.action) ? result.action : 'review',
          source: result?.source || 'unknown',
        };
      } catch {
        // AI không khả dụng không được phép tự động quyết định trạng thái bài viết.
      }
    }

    let cleanImageUrl = null;
    let imageModeration = null;
    if (requestedImageUrl != null && requestedImageUrl !== '') {
      cleanImageUrl = validateCloudinaryUrl(requestedImageUrl);
      if (existingImageUrl && cleanImageUrl === existingImageUrl && existingImageModeration) {
        imageModeration = existingImageModeration;
      } else {
        imageModeration = await runImageModeration(cleanImageUrl);
      }
    }

    const autoApproved = group.postApprovalMode === 'automatic'
      && moderationAvailable
      && ['Normal', 'No text'].includes(suggestion.label)
      && suggestion.action === 'allow'
      && (!cleanContent || suggestion.confidence >= 0.9)
      && (!imageModeration || imageModeration.decision === 'safe');

    const authorIsAdmin = ['owner', 'admin'].includes(group.currentRole);
    const totalViolationPenalty = calculateTrustDeduction(suggestion.label, imageModeration?.decision || 'safe');
    const authorTrustPenalty = authorIsAdmin ? totalViolationPenalty : 0;
    const adminPostRejected = authorIsAdmin
      && (['Hate Speech', 'Violence'].includes(suggestion.label) || imageModeration?.decision === 'rejected');
    const reviewStatus = authorIsAdmin
      ? (adminPostRejected ? 'rejected' : 'approved')
      : (autoApproved ? 'approved' : 'pending');
    const reviewNote = adminPostRejected
      ? 'AI tự động từ chối bài vi phạm nghiêm trọng do quản trị viên đăng.'
      : authorIsAdmin
        ? 'Bài của quản trị viên được đăng trực tiếp; AI vẫn kiểm tra nội dung.'
        : autoApproved
          ? 'Tự động duyệt: AI đánh giá nội dung an toàn với độ tin cậy cao.'
          : null;

    return { cleanImageUrl, imageModeration, suggestion, reviewStatus, reviewNote, authorTrustPenalty };
  };
  const withCloudinaryCleanup = async ({ userId, requestedImageUrl, imageCleanupToken }, work) => {
    const cleanupPublicId = verifyCloudinaryCleanupTicket({
      ticket: imageCleanupToken,
      userId,
      imageUrl: requestedImageUrl,
      secret: cloudinaryCleanupSecret,
    });
    try {
      const result = await work();
      if (cleanupPublicId) consumeCloudinaryCleanupTicket(imageCleanupToken);
      return result;
    } catch (error) {
      if (cleanupPublicId) {
        try {
          const cleanupResult = await deleteUploadedImage(cleanupPublicId);
          if (cleanupResult?.result === 'error') throw new Error('Cloudinary không xóa được ảnh');
          consumeCloudinaryCleanupTicket(imageCleanupToken);
        } catch (cleanupError) {
          console.error('Không thể xóa ảnh Cloudinary sau khi xử lý thất bại:', cleanupError.message);
        }
      }
      throw error;
    }
  };
  const emitGroupRealtime = async ({ type, groupId, groupPrivacy = null, payload }) => {
    if (!realtimeService?.broadcast) return;
    try {
      let audienceUserIds = null;
      if (groupPrivacy === 'private' && typeof repository.listActiveMemberIds === 'function') {
        audienceUserIds = await repository.listActiveMemberIds(groupId);
      }
      await realtimeService.broadcast({ type, groupId: String(groupId), audienceUserIds, ...payload });
    } catch (err) {
      console.warn('[Group Realtime] Broadcast failed:', err.message);
    }
  };

  return {
    listGroups({ user, search = '' } = {}) {
      return repository.listGroups({ viewerId: user?.id || null, search: String(search).trim().slice(0, 100) });
    },

    async listHomePosts({ user, search } = {}) {
      const normalizedSearch = String(search || '').trim().slice(0, 100);
      if (!user?.id && !normalizedSearch) return [];
      return repository.listHomePosts({
        viewerId: user?.id || null,
        search: normalizedSearch,
      });
    },

    async getGroup({ groupId, user }) {
      const group = await requireGroup(groupId, user?.id || null);
      if (!group.isDiscoverable && !['active', 'pending'].includes(group.membershipStatus)) {
        throw fail('Không tìm thấy nhóm', 404);
      }
      return group;
    },

    async createGroup({ user, name, description = '', rules = '', privacy = 'public', isDiscoverable = true, postApprovalMode = 'manual' }) {
      requireUser(user);
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName) throw fail('Tên nhóm là bắt buộc', 400);
      if (cleanName.length > 100) throw fail('Tên nhóm không được vượt quá 100 ký tự', 400);
      if (!['public', 'private'].includes(privacy)) throw fail('Quyền riêng tư không hợp lệ', 400);
      if (!['manual', 'automatic'].includes(postApprovalMode)) throw fail('Chế độ duyệt bài không hợp lệ', 400);
      return repository.createGroup({
        name: cleanName,
        description: String(description).trim().slice(0, 1000),
        rules: String(rules).trim().slice(0, 3000),
        privacy,
        isDiscoverable: privacy === 'public' || Boolean(isDiscoverable),
        postApprovalMode,
        creatorId: user.id,
      });
    },

    async updatePostApprovalMode({ groupId, user, postApprovalMode }) {
      requireUser(user);
      requireGroupId(groupId);
      if (!['manual', 'automatic'].includes(postApprovalMode)) throw fail('Chế độ duyệt bài không hợp lệ', 400);
      const group = await requireGroup(groupId, user.id);
      requireGroupAdmin(group);
      const updated = await repository.updatePostApprovalMode({ groupId, postApprovalMode, actorId: user.id });
      if (!updated) throw fail('Không thể cập nhật chế độ duyệt bài', 409);
      return updated;
    },

    async joinGroup({ groupId, user }) {
      requireUser(user);
      const group = await requireGroup(groupId, user.id);
      if (!group.isDiscoverable && !['active', 'pending'].includes(group.membershipStatus)) {
        throw fail('Không tìm thấy nhóm', 404);
      }
      const current = await repository.findMembership(groupId, user.id);
      if (current?.status === 'banned') throw fail('Bạn đã bị chặn khỏi nhóm này', 403);
      if (current && ['active', 'pending'].includes(current.status)) return current;
      const status = group.privacy === 'public' ? 'active' : 'pending';
      const membership = await repository.upsertMembership({ groupId, userId: user.id, status });
      if (!membership) throw fail('Không thể tham gia nhóm', 409);
      return membership;
    },

    async leaveGroup({ groupId, user }) {
      requireUser(user);
      await requireGroup(groupId, user.id);
      const membership = await repository.leaveGroup(groupId, user.id);
      if (!membership) throw fail('Chủ nhóm không thể rời nhóm; hãy chuyển quyền sở hữu trước', 409);
      return membership;
    },

    async listMembers({ groupId, user }) {
      const group = await requireGroup(groupId, user?.id || null);
      if (group.privacy === 'private' && group.membershipStatus !== 'active') {
        throw fail('Bạn cần là thành viên để xem danh sách thành viên', 403);
      }
      return repository.listMembers(groupId);
    },

    async listPosts({ groupId, user }) {
      const group = await requireGroup(groupId, user?.id || null);
      if (group.privacy === 'private' && group.membershipStatus !== 'active') {
        throw fail('Bài viết của nhóm riêng tư chỉ dành cho thành viên', 403);
      }
      return repository.listPosts({
        groupId,
        viewerId: user?.id || null,
      });
    },

    async listPostComments({ groupId, postId, user }) {
      requireGroupId(groupId);
      requirePostId(postId);
      const group = await requireGroup(groupId, user?.id || null);
      if (group.privacy === 'private' && group.membershipStatus !== 'active') {
        throw fail('Bình luận của nhóm riêng tư chỉ dành cho thành viên', 403);
      }
      await requireApprovedPost({ groupId, postId });
      return repository.listPostComments({ groupId, postId, viewerId: user?.id || null });
    },

    async listPostReactions({ groupId, postId, user }) {
      requireGroupId(groupId);
      requirePostId(postId);
      const group = await requireGroup(groupId, user?.id || null);
      if (group.privacy === 'private' && group.membershipStatus !== 'active') {
        throw fail('Cảm xúc của nhóm riêng tư chỉ dành cho thành viên', 403);
      }
      await requireApprovedPost({ groupId, postId });
      return repository.listPostReactions({ groupId, postId });
    },

    async setPostReaction({ groupId, postId, user, reactionType, action }) {
      requireUser(user);
      requireGroupId(groupId);
      requirePostId(postId);
      if (!['set', 'remove'].includes(action)) throw fail('Thao tác cảm xúc không hợp lệ', 400);
      if (action === 'set' && !allowedReactions.has(reactionType)) throw fail('Cảm xúc không hợp lệ', 400);
      const group = await requireGroup(groupId, user.id);
      requireActiveGroupMember(group);
      await requireApprovedPost({ groupId, postId });
      const result = await repository.setPostReaction({ groupId, postId, userId: user.id, reactionType, action });
      if (!result) throw fail('Không tìm thấy bài viết đã được duyệt trong nhóm này', 404);
      return result;
    },

    async setCommentReaction({ groupId, postId, commentId, user, reactionType, action }) {
      requireUser(user);
      requireGroupId(groupId);
      requirePostId(postId);
      requireId(commentId, 'Mã bình luận');
      if (!['set', 'remove'].includes(action)) throw fail('Thao tác cảm xúc không hợp lệ', 400);
      if (action === 'set' && !allowedReactions.has(reactionType)) throw fail('Cảm xúc không hợp lệ', 400);
      const group = await requireGroup(groupId, user.id);
      requireActiveGroupMember(group);
      await requireApprovedPost({ groupId, postId });
      const result = await repository.setCommentReaction({ groupId, postId, commentId, userId: user.id, reactionType, action });
      if (!result) throw fail('Không tìm thấy bình luận trong bài viết này', 404);
      return result;
    },

    async createPostComment({ groupId, postId, user, content = '', parentId = null, imageUrl: requestedImageUrl = null, imageCleanupToken = null }) {
      return withCloudinaryCleanup({ userId: user?.id, requestedImageUrl, imageCleanupToken }, async () => {
        requireUser(user);
        requireGroupId(groupId);
        requirePostId(postId);
        const cleanContent = typeof content === 'string' ? content.trim() : '';
        if (!cleanContent && !requestedImageUrl) throw fail('Nội dung bình luận không được để trống', 400);
        if (cleanContent.length > 2000) throw fail('Bình luận không được vượt quá 2.000 ký tự', 400);
        const group = await requireGroup(groupId, user.id);
        requireActiveGroupMember(group);
        await requireApprovedPost({ groupId, postId });

        let cleanParentId = null;
        if (parentId != null && parentId !== '') {
          requireId(parentId, 'Mã bình luận cha');
          if (typeof repository.findPostComment === 'function') {
            const parentComment = await repository.findPostComment({ groupId, postId, commentId: parentId });
            if (!parentComment) throw fail('Không tìm thấy bình luận gốc để trả lời', 404);
          }
          cleanParentId = parentId;
        }

        let moderation = { label: 'Normal', confidence: 1.0, action: 'allow', source: 'not_applicable' };
        if (cleanContent) {
          try {
            moderation = await moderateTextContent(cleanContent);
          } catch {
            throw fail('Không thể kiểm duyệt bình luận lúc này; vui lòng thử lại', 503);
          }
          if (moderation?.action === 'hide') throw fail('Bình luận không thể đăng do nội dung vi phạm tiêu chuẩn cộng đồng', 400);
        }

        let cleanImageUrl = null;
        let imageModeration = null;
        if (requestedImageUrl != null && requestedImageUrl !== '') {
          cleanImageUrl = validateCloudinaryUrl(requestedImageUrl);
          imageModeration = await runImageModeration(cleanImageUrl);
          if (imageModeration.decision === 'rejected') {
            throw fail('Hình ảnh bình luận vi phạm tiêu chuẩn cộng đồng và không thể đăng', 400);
          }
        }

        const comment = await repository.createPostComment({
          groupId,
          postId,
          authorId: user.id,
          content: cleanContent,
          parentId: cleanParentId,
          imageUrl: cleanImageUrl,
          imageModeration,
          aiLabel: moderation?.label || 'Normal',
          aiConfidence: moderation?.confidence ?? null,
          aiStatus: moderation?.action === 'warn' ? 'soft_hidden' : 'approved',
        });
        if (!comment) throw fail('Không tìm thấy bài viết đã được duyệt trong nhóm này', 404);
        await emitGroupRealtime({
          type: 'GROUP_COMMENT_CREATED',
          groupId,
          groupPrivacy: group.privacy,
          payload: { postId: String(postId), comment },
        });
        return comment;
      });
    },

    async shareGroupPost({ groupId, postId, user }) {
      requireUser(user);
      requireGroupId(groupId);
      requirePostId(postId);
      const group = await requireGroup(groupId, user.id);
      requireActiveGroupMember(group);
      await requireApprovedPost({ groupId, postId });
      const result = await repository.recordPostShare({ groupId, postId, userId: user.id });
      if (!result) throw fail('Không tìm thấy bài viết đã được duyệt trong nhóm này', 404);
      return result;
    },

    async toggleSavePost({ groupId, postId, user }) {
      requireUser(user);
      requireGroupId(groupId);
      requirePostId(postId);
      const group = await requireGroup(groupId, user.id);
      if (group.privacy === 'private' && group.membershipStatus !== 'active') {
        throw fail('Chỉ thành viên nhóm riêng tư mới có thể lưu bài viết này', 403);
      }
      await requireApprovedPost({ groupId, postId });
      return repository.toggleSavePost({ userId: user.id, groupId, postId });
    },

    async listSavedPosts({ user }) {
      requireUser(user);
      return repository.listSavedPosts({ userId: user.id });
    },

    async createPost({ groupId, user, content, imageUrl: requestedImageUrl = null, imageCleanupToken = null }) {
      return withCloudinaryCleanup({ userId: user?.id, requestedImageUrl, imageCleanupToken }, async () => {
        requireUser(user);
        const group = await requireGroup(groupId, user.id);
        if (group.membershipStatus !== 'active') throw fail('Chỉ thành viên đã được duyệt mới có thể đăng bài', 403);
        const cleanContent = typeof content === 'string' ? content.trim() : '';
        if (!cleanContent && !requestedImageUrl) throw fail('Nội dung bài viết hoặc ảnh là bắt buộc', 400);
        if (cleanContent.length > 10000) throw fail('Bài viết không được vượt quá 10.000 ký tự', 400);

        const moderated = await moderateGroupPostPayload({ group, cleanContent, requestedImageUrl });
        const post = await repository.createPost({
          groupId,
          authorId: user.id,
          content: cleanContent,
          imageUrl: moderated.cleanImageUrl,
          imageModeration: moderated.imageModeration,
          aiLabel: moderated.suggestion.label,
          aiConfidence: moderated.suggestion.confidence,
          aiAction: moderated.suggestion.action,
          aiSource: moderated.suggestion.source,
          reviewStatus: moderated.reviewStatus,
          reviewNote: moderated.reviewNote,
          authorTrustPenalty: moderated.authorTrustPenalty,
          moderatorTrustPenalty: 0,
        });
        if (!post) throw fail('Không thể lưu bài viết nhóm', 500);
        if (post.status === 'approved') {
          await emitGroupRealtime({
            type: 'GROUP_POST_CREATED',
            groupId,
            groupPrivacy: group.privacy,
            payload: { post: { ...post, groupName: group.name } },
          });
        }
        return { ...post, authorTrustPenalty: moderated.authorTrustPenalty };
      });
    },

    async editPost({ groupId, postId, user, content, imageUrl: requestedImageUrl = null, imageCleanupToken = null }) {
      return withCloudinaryCleanup({ userId: user?.id, requestedImageUrl, imageCleanupToken }, async () => {
        requireUser(user);
        requireGroupId(groupId);
        requirePostId(postId);
        const group = await requireGroup(groupId, user.id);
        requireActiveGroupMember(group);
        const existing = await repository.findPostById({ groupId, postId });
        if (!existing) throw fail('Không tìm thấy bài viết trong nhóm', 404);
        if (String(existing.authorId) !== String(user.id)) {
          throw fail('Chỉ tác giả mới có thể chỉnh sửa bài viết này', 403);
        }
        const cleanContent = typeof content === 'string' ? content.trim() : '';
        if (!cleanContent && !requestedImageUrl) throw fail('Nội dung bài viết hoặc ảnh là bắt buộc', 400);
        if (cleanContent.length > 10000) throw fail('Bài viết không được vượt quá 10.000 ký tự', 400);

        const moderated = await moderateGroupPostPayload({
          group,
          cleanContent,
          requestedImageUrl,
          existingImageUrl: existing.imageUrl,
          existingImageModeration: existing.imageModeration,
        });
        const updated = await repository.updatePost({
          groupId,
          postId,
          content: cleanContent,
          imageUrl: moderated.cleanImageUrl,
          imageModeration: moderated.imageModeration,
          aiLabel: moderated.suggestion.label,
          aiConfidence: moderated.suggestion.confidence,
          aiAction: moderated.suggestion.action,
          aiSource: moderated.suggestion.source,
          reviewStatus: moderated.reviewStatus,
          reviewNote: moderated.reviewNote,
          authorTrustPenalty: moderated.authorTrustPenalty,
        });
        if (!updated) throw fail('Không thể cập nhật bài viết nhóm', 500);
        await emitGroupRealtime({
          type: 'GROUP_POST_UPDATED',
          groupId,
          groupPrivacy: group.privacy,
          payload: { post: { ...updated, groupName: group.name } },
        });
        return { ...updated, authorTrustPenalty: moderated.authorTrustPenalty };
      });
    },

    async deletePost({ groupId, postId, user, reason = '' }) {
      requireUser(user);
      requireGroupId(groupId);
      requirePostId(postId);
      const group = await requireGroup(groupId, user.id);
      const existing = await repository.findPostById({ groupId, postId });
      if (!existing) throw fail('Không tìm thấy bài viết trong nhóm', 404);
      const isAuthor = String(existing.authorId) === String(user.id);
      const canModerate = isGroupModerator(group);
      if (!isAuthor && !canModerate) {
        throw fail('Bạn không có quyền xóa bài viết này', 403);
      }
      const deleted = await repository.deletePost({
        groupId,
        postId,
        actorId: user.id,
        logModeration: !isAuthor && canModerate,
        reason: String(reason).trim().slice(0, 500),
      });
      if (!deleted) throw fail('Không thể xóa bài viết nhóm', 404);
      await emitGroupRealtime({
        type: 'GROUP_POST_DELETED',
        groupId,
        groupPrivacy: group.privacy,
        payload: { postId: String(postId) },
      });
      return deleted;
    },

    async listReviewQueue({ groupId, user }) {
      requireUser(user);
      const group = await requireGroup(groupId, user.id);
      if (!isGroupModerator(group)) throw fail('Bạn không có quyền duyệt bài trong nhóm này', 403);
      return repository.listReviewQueue(groupId);
    },

    async reviewPost({ groupId, postId, user, decision, reason = '' }) {
      requireUser(user);
      requireGroupId(groupId);
      if (!/^\d+$/.test(String(postId || '')) || Number(postId) < 1) throw fail('Mã bài viết không hợp lệ', 400);
      if (!['approved', 'rejected'].includes(decision)) throw fail('Quyết định duyệt không hợp lệ', 400);
      const group = await requireGroup(groupId, user.id);
      if (!isGroupModerator(group)) throw fail('Bạn không có quyền duyệt bài trong nhóm này', 403);
      const candidate = await repository.findPostForReview({ groupId, postId });
      if (!candidate || candidate.status !== 'pending') {
        throw fail('Bài viết không còn chờ duyệt hoặc bạn không có quyền xử lý', 409);
      }
      const authorTrustPenalty = calculateTrustDeduction(candidate.aiLabel, candidate.imageModeration?.decision || 'safe');
      const moderatorTrustPenalty = decision === 'approved'
        && String(candidate.authorId) !== String(user.id)
        ? authorTrustPenalty
        : 0;
      const reviewed = await repository.reviewPost({
        groupId,
        postId,
        reviewerId: user.id,
        decision,
        reason: String(reason).trim().slice(0, 500),
        authorTrustPenalty,
        moderatorTrustPenalty,
      });
      if (!reviewed) throw fail('Bài viết không còn chờ duyệt hoặc bạn không có quyền xử lý', 409);
      if (reviewed.status === 'approved') {
        await emitGroupRealtime({
          type: 'GROUP_POST_UPDATED',
          groupId,
          groupPrivacy: group.privacy,
          payload: { post: { ...reviewed, groupName: group.name } },
        });
      }
      return {
        ...reviewed,
        authorTrustPenalty: reviewed.authorTrustPenalty ?? authorTrustPenalty,
        moderatorTrustPenalty: reviewed.moderatorTrustPenalty ?? moderatorTrustPenalty,
      };
    },

    async createReport({ groupId, user, targetType, targetId, parentPostId = null, reason, details = '' }) {
      requireUser(user);
      requireGroupId(groupId);
      if (!['post', 'comment'].includes(targetType)) throw fail('Loại nội dung báo cáo không hợp lệ', 400);
      requireId(targetId, 'Mã nội dung báo cáo');
      const cleanReason = String(reason || '').trim().slice(0, 50);
      if (!cleanReason) throw fail('Vui lòng chọn lý do báo cáo', 400);
      const group = await requireGroup(groupId, user.id);
      requireActiveGroupMember(group);

      let resolvedParentPostId = null;
      if (targetType === 'post') {
        const post = await repository.findPostById({ groupId, postId: targetId });
        if (!post || post.status !== 'approved') throw fail('Không tìm thấy bài viết để báo cáo', 404);
        if (String(post.authorId) === String(user.id)) throw fail('Bạn không thể báo cáo bài viết của chính mình', 400);
        resolvedParentPostId = post.id;
      } else {
        requirePostId(parentPostId);
        const comment = await repository.findPostComment({ groupId, postId: parentPostId, commentId: targetId });
        if (!comment) throw fail('Không tìm thấy bình luận để báo cáo', 404);
        if (String(comment.authorId) === String(user.id)) throw fail('Bạn không thể báo cáo bình luận của chính mình', 400);
        resolvedParentPostId = parentPostId;
      }

      try {
        return await repository.createReport({
          groupId,
          reporterId: user.id,
          targetType,
          targetId,
          parentPostId: resolvedParentPostId,
          reason: cleanReason,
          details: String(details || '').trim().slice(0, 1000),
        });
      } catch (err) {
        if (err?.code === '23505') {
          throw fail('Bạn đã báo cáo nội dung này trước đó rồi', 409);
        }
        throw err;
      }
    },

    async listReports({ groupId, user }) {
      requireUser(user);
      const group = await requireGroup(groupId, user.id);
      if (!isGroupModerator(group)) throw fail('Bạn không có quyền xem danh sách báo cáo của nhóm', 403);
      return repository.listReports(groupId);
    },

    async reviewReport({ groupId, reportId, user, decision, adminNotes = '' }) {
      requireUser(user);
      requireGroupId(groupId);
      requireId(reportId, 'Mã báo cáo');
      if (!['resolved_violation', 'dismissed'].includes(decision)) throw fail('Quyết định xử lý báo cáo không hợp lệ', 400);
      const group = await requireGroup(groupId, user.id);
      if (!isGroupModerator(group)) throw fail('Bạn không có quyền xử lý báo cáo của nhóm', 403);
      const report = await repository.findReportById({ groupId, reportId });
      if (!report || report.status !== 'pending') throw fail('Báo cáo không còn chờ xử lý', 409);
      const imgDecision = (report.targetType === 'post' ? report.postImageModeration?.decision : report.commentImageModeration?.decision) || 'safe';
      const authorTrustPenalty = decision === 'resolved_violation'
        ? Math.max(5, calculateTrustDeduction(report.aiLabel, imgDecision))
        : 0;
      const reviewed = await repository.reviewReport({
        groupId,
        reportId,
        reviewerId: user.id,
        status: decision,
        adminNotes: String(adminNotes || '').trim().slice(0, 500),
        authorTrustPenalty,
      });
      if (!reviewed) throw fail('Báo cáo không còn chờ xử lý', 409);
      if (decision === 'resolved_violation' && reviewed.targetType === 'post') {
        await emitGroupRealtime({
          type: 'GROUP_POST_DELETED',
          groupId,
          groupPrivacy: group.privacy,
          payload: { postId: String(reviewed.targetId) },
        });
      }
      return reviewed;
    },

    async createAppeal({ groupId, postId, user, appealReason }) {
      requireUser(user);
      requireGroupId(groupId);
      requirePostId(postId);
      const cleanReason = String(appealReason || '').trim();
      if (!cleanReason) throw fail('Vui lòng nhập lý do kháng cáo', 400);
      const group = await requireGroup(groupId, user.id);
      requireActiveGroupMember(group);
      const post = await repository.findPostById({ groupId, postId });
      if (!post) throw fail('Không tìm thấy bài viết trong nhóm', 404);
      if (String(post.authorId) !== String(user.id)) throw fail('Chỉ tác giả mới có thể gửi kháng cáo', 403);
      if (post.status !== 'rejected' && post.aiLabel === 'Normal') {
        throw fail('Bài viết này không ở trạng thái bị từ chối hoặc gắn nhãn vi phạm', 400);
      }
      try {
        return await repository.createAppeal({
          groupId,
          postId,
          userId: user.id,
          appealReason: cleanReason.slice(0, 1000),
        });
      } catch (err) {
        if (err?.code === '23505') {
          throw fail('Bạn đã gửi đơn kháng cáo cho bài viết này và đang chờ xử lý', 409);
        }
        throw err;
      }
    },

    async listAppeals({ groupId, user }) {
      requireUser(user);
      const group = await requireGroup(groupId, user.id);
      if (!isGroupModerator(group)) throw fail('Bạn không có quyền xem đơn kháng cáo của nhóm', 403);
      return repository.listAppeals(groupId);
    },

    async reviewAppeal({ groupId, appealId, user, decision, adminNotes = '' }) {
      requireUser(user);
      requireGroupId(groupId);
      requireId(appealId, 'Mã kháng cáo');
      if (!['approved', 'rejected'].includes(decision)) throw fail('Quyết định kháng cáo không hợp lệ', 400);
      const group = await requireGroup(groupId, user.id);
      if (!isGroupModerator(group)) throw fail('Bạn không có quyền xử lý kháng cáo của nhóm', 403);
      const reviewed = await repository.reviewAppeal({
        groupId,
        appealId,
        reviewerId: user.id,
        decision,
        adminNotes: String(adminNotes || '').trim().slice(0, 500),
      });
      if (!reviewed) throw fail('Đơn kháng cáo không còn chờ xử lý', 409);
      return reviewed;
    },

    async listMemberRequests({ groupId, user }) {
      requireUser(user);
      const group = await requireGroup(groupId, user.id);
      requireGroupAdmin(group);
      return repository.listMemberRequests(groupId);
    },

    async reviewMemberRequest({ groupId, targetUserId, user, decision }) {
      requireUser(user);
      requireUserId(targetUserId);
      if (!['active', 'rejected'].includes(decision)) throw fail('Quyết định thành viên không hợp lệ', 400);
      const group = await requireGroup(groupId, user.id);
      requireGroupAdmin(group);
      const reviewed = await repository.reviewMemberRequest({
        groupId,
        userId: targetUserId,
        reviewerId: user.id,
        decision,
      });
      if (!reviewed) throw fail('Yêu cầu tham gia không còn chờ duyệt hoặc bạn không có quyền xử lý', 409);
      return reviewed;
    },

    async updateMemberRole({ groupId, targetUserId, user, role }) {
      requireUser(user);
      requireUserId(targetUserId);
      if (!['admin', 'moderator', 'member'].includes(role)) throw fail('Vai trò không hợp lệ', 400);
      const group = await requireGroup(groupId, user.id);
      if (group.currentRole !== 'owner') throw fail('Chỉ chủ nhóm mới được thay đổi vai trò quản trị', 403);
      const updated = await repository.updateMemberRole({
        groupId,
        userId: targetUserId,
        role,
        actorId: user.id,
      });
      if (!updated) throw fail('Không tìm thấy thành viên đang hoạt động hoặc không thể đổi vai trò chủ nhóm', 404);
      return updated;
    },

    async removeMember({ groupId, targetUserId, user }) {
      requireUser(user);
      requireGroupId(groupId);
      requireUserId(targetUserId);
      if (String(user.id) === String(targetUserId)) {
        throw fail('Không thể tự xóa chính mình khỏi nhóm qua chức năng này, vui lòng chọn rời nhóm', 400);
      }
      const group = await requireGroup(groupId, user.id);
      if (!['owner', 'admin'].includes(group.currentRole)) {
        throw fail('Chỉ chủ nhóm hoặc quản trị viên mới có quyền xóa thành viên khỏi nhóm', 403);
      }
      const removed = await repository.removeMember({
        groupId,
        targetUserId,
        actorId: user.id,
      });
      if (!removed) throw fail('Không tìm thấy thành viên hoặc bạn không có đủ thẩm quyền xóa thành viên này', 404);
      await emitGroupRealtime({
        type: 'GROUP_MEMBER_REMOVED',
        groupId,
        groupPrivacy: group.privacy,
        payload: { userId: targetUserId },
      });
      return { success: true, message: 'Đã xóa thành viên khỏi nhóm' };
    },

    async updateGroupPrivacy({ groupId, user, privacy }) {
      requireUser(user);
      requireGroupId(groupId);
      if (!['public', 'private'].includes(privacy)) throw fail('Chế độ quyền riêng tư không hợp lệ', 400);
      const group = await requireGroup(groupId, user.id);
      if (!['owner', 'admin'].includes(group.currentRole)) {
        throw fail('Chỉ chủ nhóm hoặc quản trị viên mới có quyền thay đổi quyền riêng tư của nhóm', 403);
      }
      const updated = await repository.updateGroupPrivacy({
        groupId,
        privacy,
        actorId: user.id,
      });
      if (!updated) throw fail('Không thể cập nhật quyền riêng tư nhóm', 404);
      await emitGroupRealtime({
        type: 'GROUP_UPDATED',
        groupId,
        groupPrivacy: privacy,
        payload: { groupId, privacy },
      });
      return updated;
    },
  };
}

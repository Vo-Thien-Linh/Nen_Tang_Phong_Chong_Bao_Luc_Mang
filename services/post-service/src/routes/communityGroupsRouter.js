import express from 'express';
import { createAuthMiddleware } from '../../../../backend/src/middleware/auth.js';
import { createUserRepository } from '../../../../backend/src/repositories/userRepository.js';
import { moderateTextContent } from '../../../../backend/src/utils/textModerator.js';
import { moderateImageUrl } from '../../../../backend/src/services/imageModerationClient.js';
import cloudinary from '../../../../backend/src/config/cloudinary.js';
import { createCommunityGroupsRepository } from '../../../../backend/src/repositories/communityGroupsRepository.js';
import { createCommunityGroupsService } from '../../../../backend/src/services/communityGroupsService.js';

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res)).catch(next);
};

export function createCommunityGroupsRouter({ pool, realtimeService = null }) {
  const router = express.Router();
  const repository = createCommunityGroupsRepository({ pool });
  const service = createCommunityGroupsService({
    repository,
    moderateTextContent,
    moderateImageUrl,
    deleteUploadedImage: (publicId) => cloudinary.uploader.destroy(publicId),
    realtimeService,
  });
  const { requireAuth, optionalAuth } = createAuthMiddleware({ userRepository: createUserRepository({ pool }) });

  router.get('/', optionalAuth, asyncRoute(async (req, res) => {
    const data = await service.listGroups({ user: req.user, search: req.query.search });
    res.json({ success: true, data });
  }));

  router.post('/', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.createGroup({ ...req.body, user: req.user });
    res.status(201).json({ success: true, data });
  }));

  router.get('/feed', optionalAuth, asyncRoute(async (req, res) => {
    const data = await service.listHomePosts({ user: req.user, search: req.query.search });
    res.json({ success: true, data });
  }));

  router.get('/saved', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.listSavedPosts({ user: req.user });
    res.json({ success: true, data });
  }));

  router.get('/:groupId', optionalAuth, asyncRoute(async (req, res) => {
    const data = await service.getGroup({ groupId: req.params.groupId, user: req.user });
    res.json({ success: true, data });
  }));

  router.post('/:groupId/join', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.joinGroup({ groupId: req.params.groupId, user: req.user });
    res.json({ success: true, data });
  }));

  router.post('/:groupId/leave', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.leaveGroup({ groupId: req.params.groupId, user: req.user });
    res.json({ success: true, data });
  }));

  router.put('/:groupId/post-approval-mode', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.updatePostApprovalMode({
      groupId: req.params.groupId,
      user: req.user,
      postApprovalMode: req.body?.postApprovalMode,
    });
    res.json({ success: true, data });
  }));

  router.get('/:groupId/members', optionalAuth, asyncRoute(async (req, res) => {
    const data = await service.listMembers({ groupId: req.params.groupId, user: req.user });
    res.json({ success: true, data });
  }));

  router.get('/:groupId/posts', optionalAuth, asyncRoute(async (req, res) => {
    const data = await service.listPosts({ groupId: req.params.groupId, user: req.user });
    res.json({ success: true, data });
  }));

  router.post('/:groupId/posts', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.createPost({
      groupId: req.params.groupId,
      user: req.user,
      content: req.body?.content,
      imageUrl: req.body?.imageUrl,
      imageCleanupToken: req.body?.imageCleanupToken,
    });
    res.status(201).json({ success: true, data });
  }));

  router.put('/:groupId/posts/:postId', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.editPost({
      groupId: req.params.groupId,
      postId: req.params.postId,
      user: req.user,
      content: req.body?.content,
      imageUrl: req.body?.imageUrl,
      imageCleanupToken: req.body?.imageCleanupToken,
    });
    res.json({ success: true, data });
  }));

  router.delete('/:groupId/posts/:postId', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.deletePost({
      groupId: req.params.groupId,
      postId: req.params.postId,
      user: req.user,
      reason: req.body?.reason,
    });
    res.json({ success: true, data });
  }));

  router.post('/:groupId/posts/:postId/save', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.toggleSavePost({
      groupId: req.params.groupId,
      postId: req.params.postId,
      user: req.user,
    });
    res.json({ success: true, data });
  }));

  router.post('/:groupId/posts/:postId/appeal', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.createAppeal({
      groupId: req.params.groupId,
      postId: req.params.postId,
      user: req.user,
      appealReason: req.body?.appealReason,
    });
    res.status(201).json({ success: true, data });
  }));

  router.get('/:groupId/posts/:postId/comments', optionalAuth, asyncRoute(async (req, res) => {
    const data = await service.listPostComments({
      groupId: req.params.groupId,
      postId: req.params.postId,
      user: req.user,
    });
    res.json({ success: true, data });
  }));

  router.get('/:groupId/posts/:postId/reactions', optionalAuth, asyncRoute(async (req, res) => {
    const data = await service.listPostReactions({
      groupId: req.params.groupId,
      postId: req.params.postId,
      user: req.user,
    });
    res.json({ success: true, data });
  }));

  router.post('/:groupId/posts/:postId/comments', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.createPostComment({
      groupId: req.params.groupId,
      postId: req.params.postId,
      user: req.user,
      content: req.body?.content,
      parentId: req.body?.parentId,
      imageUrl: req.body?.imageUrl,
      imageCleanupToken: req.body?.imageCleanupToken,
    });
    res.status(201).json({ success: true, data });
  }));

  router.put('/:groupId/posts/:postId/reaction', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.setPostReaction({
      groupId: req.params.groupId,
      postId: req.params.postId,
      user: req.user,
      reactionType: req.body?.type,
      action: req.body?.action,
    });
    res.json({ success: true, data });
  }));

  router.put('/:groupId/posts/:postId/comments/:commentId/reaction', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.setCommentReaction({
      groupId: req.params.groupId,
      postId: req.params.postId,
      commentId: req.params.commentId,
      user: req.user,
      reactionType: req.body?.type,
      action: req.body?.action,
    });
    res.json({ success: true, data });
  }));

  router.post('/:groupId/posts/:postId/share', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.shareGroupPost({
      groupId: req.params.groupId,
      postId: req.params.postId,
      user: req.user,
    });
    res.json({ success: true, data });
  }));

  router.get('/:groupId/review-queue', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.listReviewQueue({ groupId: req.params.groupId, user: req.user });
    res.json({ success: true, data });
  }));

  router.post('/:groupId/posts/:postId/review', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.reviewPost({
      groupId: req.params.groupId,
      postId: req.params.postId,
      user: req.user,
      decision: req.body?.decision,
      reason: req.body?.reason,
    });
    res.json({ success: true, data });
  }));

  router.get('/:groupId/member-requests', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.listMemberRequests({ groupId: req.params.groupId, user: req.user });
    res.json({ success: true, data });
  }));

  router.post('/:groupId/member-requests/:userId/review', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.reviewMemberRequest({
      groupId: req.params.groupId,
      targetUserId: req.params.userId,
      user: req.user,
      decision: req.body?.decision,
    });
    res.json({ success: true, data });
  }));

  router.get('/:groupId/reports', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.listReports({ groupId: req.params.groupId, user: req.user });
    res.json({ success: true, data });
  }));

  router.post('/:groupId/reports', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.createReport({
      groupId: req.params.groupId,
      user: req.user,
      targetType: req.body?.targetType,
      targetId: req.body?.targetId,
      parentPostId: req.body?.parentPostId,
      reason: req.body?.reason,
      details: req.body?.details,
    });
    res.status(201).json({ success: true, data });
  }));

  router.post('/:groupId/reports/:reportId/review', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.reviewReport({
      groupId: req.params.groupId,
      reportId: req.params.reportId,
      user: req.user,
      decision: req.body?.decision,
      adminNotes: req.body?.adminNotes,
    });
    res.json({ success: true, data });
  }));

  router.get('/:groupId/appeals', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.listAppeals({ groupId: req.params.groupId, user: req.user });
    res.json({ success: true, data });
  }));

  router.post('/:groupId/appeals/:appealId/review', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.reviewAppeal({
      groupId: req.params.groupId,
      appealId: req.params.appealId,
      user: req.user,
      decision: req.body?.decision,
      adminNotes: req.body?.adminNotes,
    });
    res.json({ success: true, data });
  }));

  router.put('/:groupId/members/:userId/role', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.updateMemberRole({
      groupId: req.params.groupId,
      targetUserId: req.params.userId,
      user: req.user,
      role: req.body?.role,
    });
    res.json({ success: true, data });
  }));

  router.delete('/:groupId/members/:userId', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.removeMember({
      groupId: req.params.groupId,
      targetUserId: req.params.userId,
      user: req.user,
    });
    res.json({ success: true, data });
  }));

  router.put('/:groupId/privacy', requireAuth, asyncRoute(async (req, res) => {
    const data = await service.updateGroupPrivacy({
      groupId: req.params.groupId,
      user: req.user,
      privacy: req.body?.privacy,
    });
    res.json({ success: true, data });
  }));

  return router;
}

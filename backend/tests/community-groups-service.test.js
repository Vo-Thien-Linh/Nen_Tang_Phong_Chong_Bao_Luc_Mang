import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommunityGroupsRepository } from '../src/repositories/communityGroupsRepository.js';
import { createCommunityGroupsService } from '../src/services/communityGroupsService.js';
import { createCloudinaryCleanupTicket, verifyCloudinaryCleanupTicket } from '../src/utils/cloudinaryCleanupTicket.js';

function createHarness({ aiResult = { label: 'Normal', confidence: 0.98, action: 'allow' }, aiError = null, moderationSource = 'phobert', imageResult = null, imageError = null, createPostError = null, reviewImageModeration = null, reviewAuthorId = 'member' } = {}) {
  const groups = new Map([
    ['1', { id: '1', name: 'Cộng đồng công khai', privacy: 'public', isDiscoverable: true, postApprovalMode: 'manual' }],
    ['2', { id: '2', name: 'Nhóm kín', privacy: 'private', isDiscoverable: true, postApprovalMode: 'manual' }],
    ['3', { id: '3', name: 'Nhóm ẩn', privacy: 'private', isDiscoverable: false, postApprovalMode: 'manual' }],
  ]);
  const memberships = new Map([
    ['1:owner', { role: 'owner', status: 'active' }],
    ['1:admin', { role: 'admin', status: 'active' }],
    ['1:member', { role: 'member', status: 'active' }],
    ['2:owner', { role: 'owner', status: 'active' }],
    ['2:member', { role: 'member', status: 'active' }],
    ['3:owner', { role: 'owner', status: 'active' }],
  ]);
  const calls = { createdPosts: [], reviewedPosts: [], reviewContexts: [], homeFeedRequests: [], deletedImages: [], groupReactions: [], groupReactionPeople: [], groupComments: [], groupShares: [] };
  const repository = {
    async listGroups() { return []; },
    async findGroup(groupId, viewerId) {
      const group = groups.get(String(groupId));
      if (!group) return null;
      const membership = memberships.get(`${groupId}:${viewerId}`);
      return { ...group, currentRole: membership?.role || null, membershipStatus: membership?.status || null };
    },
    async createGroup(input) {
      const group = { id: '4', ...input, isDiscoverable: input.isDiscoverable, currentRole: 'owner', membershipStatus: 'active' };
      groups.set(group.id, group);
      memberships.set(`${group.id}:${input.creatorId}`, { role: 'owner', status: 'active' });
      return group;
    },
    async updatePostApprovalMode({ groupId, postApprovalMode, actorId }) {
      const group = groups.get(String(groupId));
      const membership = memberships.get(`${groupId}:${actorId}`);
      if (!group || !['owner', 'admin'].includes(membership?.role) || membership.status !== 'active') return null;
      group.postApprovalMode = postApprovalMode;
      return { id: group.id, postApprovalMode };
    },
    async findMembership(groupId, userId) { return memberships.get(`${groupId}:${userId}`) || null; },
    async upsertMembership(input) {
      const membership = { role: 'member', status: input.status };
      memberships.set(`${input.groupId}:${input.userId}`, membership);
      return membership;
    },
    async leaveGroup() { return { status: 'left' }; },
    async listMembers() { return []; },
    async listPosts() { return []; },
    async findApprovedPost({ groupId, postId }) {
      return String(groupId) === '1' && String(postId) === '42' ? { id: '42', groupId: '1' } : null;
    },
    async listPostComments() { return []; },
    async listPostReactions({ groupId, postId }) {
      calls.groupReactionPeople.push({ groupId, postId });
      return [{ userId: 'member', name: 'Thành viên', username: 'member', avatar: '/avatar.jpg', reactionType: 'love' }];
    },
    async setPostReaction(input) {
      calls.groupReactions.push(input);
      return { likesCount: 1, myReaction: input.action === 'remove' ? null : input.reactionType };
    },
    async createPostComment(input) {
      calls.groupComments.push(input);
      return { id: String(calls.groupComments.length), ...input, authorName: 'Thành viên' };
    },
    async recordPostShare(input) {
      calls.groupShares.push(input);
      return { sharesCount: calls.groupShares.length };
    },
    async listHomePosts(input) {
      calls.homeFeedRequests.push(input);
      return [{ id: 'group-post-1', groupId: '1' }];
    },
    async createPost(input) {
      calls.createdPosts.push(input);
      if (createPostError) throw createPostError;
      return { id: String(calls.createdPosts.length), ...input, status: input.reviewStatus };
    },
    async listReviewQueue() { return []; },
    async findPostForReview(input) {
      calls.reviewContexts.push(input);
      return { id: input.postId, authorId: reviewAuthorId, aiLabel: 'Violence', imageModeration: reviewImageModeration, status: 'pending' };
    },
    async reviewPost(input) {
      calls.reviewedPosts.push(input);
      return { id: input.postId, status: input.decision, ...input };
    },
    async listMemberRequests() { return []; },
    async reviewMemberRequest() { return { status: 'active' }; },
    async updateMemberRole() { return { role: 'moderator' }; },
  };
  const moderateTextContent = async () => {
    if (aiError) throw aiError;
    return { ...aiResult, source: moderationSource };
  };
  const moderateImageUrl = async () => {
    if (imageError) throw imageError;
    return imageResult;
  };
  return {
    service: createCommunityGroupsService({
      repository,
      moderateTextContent,
      moderateImageUrl,
      deleteUploadedImage: async (publicId) => calls.deletedImages.push(publicId),
      cloudinaryCleanupSecret: 'test-secret',
    }),
    calls,
  };
}

const user = (id, status = 'active') => ({ id, status });

function createTransactionalPool(handler) {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      return handler(sql, params);
    },
    release() {},
  };
  return { calls, connect: async () => client };
}

test('creates a private group as discoverable only when explicitly requested', async () => {
  const { service } = createHarness();
  const hidden = await service.createGroup({ user: user('owner'), name: '  Nhóm riêng  ', privacy: 'private', isDiscoverable: false });
  const discoverable = await service.createGroup({ user: user('owner'), name: 'Nhóm tìm thấy', privacy: 'private', isDiscoverable: true });

  assert.equal(hidden.name, 'Nhóm riêng');
  assert.equal(hidden.isDiscoverable, false);
  assert.equal(discoverable.isDiscoverable, true);
});

test('new groups default to manual review and can select automatic review', async () => {
  const { service } = createHarness();
  const manual = await service.createGroup({ user: user('owner'), name: 'Nhóm duyệt tay' });
  const automatic = await service.createGroup({ user: user('owner'), name: 'Nhóm duyệt tự động', postApprovalMode: 'automatic' });

  assert.equal(manual.postApprovalMode, 'manual');
  assert.equal(automatic.postApprovalMode, 'automatic');
});

test('only an active owner or admin can change a group post approval mode', async () => {
  const { service } = createHarness();
  const updated = await service.updatePostApprovalMode({ groupId: '1', user: user('admin'), postApprovalMode: 'automatic' });

  assert.equal(updated.postApprovalMode, 'automatic');
  await assert.rejects(
    service.updatePostApprovalMode({ groupId: '1', user: user('member'), postApprovalMode: 'manual' }),
    (error) => error.statusCode === 403
  );
  await assert.rejects(
    service.updatePostApprovalMode({ groupId: '1', user: user('admin'), postApprovalMode: 'invalid' }),
    (error) => error.statusCode === 400
  );
});

test('public join is immediate while private join waits for group admin approval', async () => {
  const { service } = createHarness();
  const publicMembership = await service.joinGroup({ groupId: '1', user: user('new-public') });
  const privateMembership = await service.joinGroup({ groupId: '2', user: user('new-private') });

  assert.equal(publicMembership.status, 'active');
  assert.equal(privateMembership.status, 'pending');
});

test('an undiscoverable group cannot be joined by guessing its ID', async () => {
  const { service } = createHarness();
  await assert.rejects(
    service.joinGroup({ groupId: '3', user: user('stranger') }),
    (error) => error.statusCode === 404
  );
});

test('AI recommendation never publishes or rejects a group post without admin review', async () => {
  const { service, calls } = createHarness({ aiResult: { label: 'Violence', confidence: 0.96, action: 'hide' } });
  const post = await service.createPost({ groupId: '1', user: user('member'), content: 'Nội dung cần xem xét' });

  assert.equal(post.reviewStatus, 'pending');
  assert.equal(calls.createdPosts[0].reviewStatus, 'pending');
  assert.equal(calls.createdPosts[0].aiLabel, 'Violence');
  assert.equal(calls.createdPosts[0].aiAction, 'hide');
  assert.equal(calls.createdPosts[0].authorTrustPenalty, 0);
});

test('AI outage still places group posts in the human review queue', async () => {
  const { service, calls } = createHarness({ aiError: new Error('model unavailable') });
  const post = await service.createPost({ groupId: '1', user: user('member'), content: 'Bài viết thử nghiệm' });

  assert.equal(post.reviewStatus, 'pending');
  assert.equal(calls.createdPosts[0].reviewStatus, 'pending');
  assert.equal(calls.createdPosts[0].aiLabel, 'Review needed');
  assert.equal(calls.createdPosts[0].aiAction, 'review');
});

test('automatic mode publishes only high-confidence AI allow results', async () => {
  const { service, calls } = createHarness();
  await service.updatePostApprovalMode({ groupId: '1', user: user('owner'), postApprovalMode: 'automatic' });
  const post = await service.createPost({ groupId: '1', user: user('member'), content: 'Bài viết an toàn' });

  assert.equal(post.status, 'approved');
  assert.equal(calls.createdPosts[0].reviewStatus, 'approved');
});

test('automatic mode does not treat fallback text classification as PhoBERT approval', async () => {
  const { service, calls } = createHarness({ moderationSource: 'fallback' });
  await service.updatePostApprovalMode({ groupId: '1', user: user('owner'), postApprovalMode: 'automatic' });
  const post = await service.createPost({ groupId: '1', user: user('member'), content: 'Bài viết dùng bộ dò dự phòng' });

  assert.equal(post.status, 'pending');
  assert.equal(calls.createdPosts[0].aiSource, 'fallback');
});

test('group image posts persist EfficientNet label and confidence and require review when uncertain', async () => {
  const imageResult = {
    decision: 'sensitive',
    scores: { safe: 0.12, nsfw: 0.78, violence: 0.1 },
    thresholds: { nsfw_blur: 0.7 },
    source: 'efficientnet-b1',
  };
  const { service, calls } = createHarness({ imageResult });
  await service.updatePostApprovalMode({ groupId: '1', user: user('owner'), postApprovalMode: 'automatic' });
  const post = await service.createPost({
    groupId: '1',
    user: user('member'),
    content: 'Bài có ảnh cần duyệt',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
  });

  assert.equal(post.status, 'pending');
  assert.equal(calls.createdPosts[0].imageModeration.label, 'sensitive');
  assert.equal(calls.createdPosts[0].imageModeration.confidence, 0.78);
  assert.equal(calls.createdPosts[0].imageModeration.source, 'efficientnet-b1');
});

test('safe image-only posts can auto-approve without reporting a nonexistent text prediction', async () => {
  const imageResult = {
    decision: 'safe',
    scores: { safe: 0.98, nsfw: 0.01, violence: 0.01 },
    thresholds: {},
    source: 'efficientnet-b1',
  };
  const { service, calls } = createHarness({ imageResult });
  await service.updatePostApprovalMode({ groupId: '1', user: user('owner'), postApprovalMode: 'automatic' });
  const post = await service.createPost({
    groupId: '1',
    user: user('member'),
    content: '',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
  });

  assert.equal(post.status, 'approved');
  assert.equal(calls.createdPosts[0].aiLabel, 'No text');
  assert.equal(calls.createdPosts[0].aiConfidence, null);
  assert.equal(calls.createdPosts[0].imageModeration.confidence, 0.98);
});

test('safe image above the model auto-approve threshold is stored as approved', async () => {
  const imageResult = {
    decision: 'safe',
    scores: { safe: 0.6531660, nsfw: 0.2, violence: 0.1468340 },
    thresholds: { auto_approve_safe: 0.60, auto_hide: 0.50 },
    source: 'efficientnet-b1',
  };
  const { service, calls } = createHarness({ imageResult });
  await service.updatePostApprovalMode({ groupId: '1', user: user('owner'), postApprovalMode: 'automatic' });

  const post = await service.createPost({
    groupId: '1',
    user: user('member'),
    content: '',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
  });

  assert.equal(post.status, 'approved');
  assert.equal(calls.createdPosts[0].reviewStatus, 'approved');
});

test('image moderation outages fail closed instead of storing an unmoderated image post', async () => {
  const { service, calls } = createHarness({ imageError: new Error('model unavailable') });
  await assert.rejects(
    service.createPost({
      groupId: '1',
      user: user('member'),
      content: 'Ảnh chưa được kiểm duyệt',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
    }),
    (error) => error.statusCode === 503
  );
  assert.equal(calls.createdPosts.length, 0);
});

test('cleanup tickets are bound to the uploading user, asset URL, and expiry', () => {
  const publicId = 'nexussocial_uploads/group-post';
  const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v123/nexussocial_uploads/group-post.jpg';
  const ticket = createCloudinaryCleanupTicket({ userId: 'member', publicId, secret: 'test-secret', now: 1000 });

  assert.equal(verifyCloudinaryCleanupTicket({ ticket, userId: 'member', imageUrl, secret: 'test-secret', now: 1001 }), publicId);
  assert.equal(verifyCloudinaryCleanupTicket({ ticket, userId: 'another-user', imageUrl, secret: 'test-secret', now: 1001 }), null);
  assert.equal(verifyCloudinaryCleanupTicket({ ticket, userId: 'member', imageUrl: imageUrl.replace('group-post.jpg', 'other.jpg'), secret: 'test-secret', now: 1001 }), null);
  assert.equal(verifyCloudinaryCleanupTicket({ ticket, userId: 'member', imageUrl, secret: 'test-secret', now: 901001 }), null);
});

test('failed image moderation deletes only the newly uploaded group image', async () => {
  const publicId = 'nexussocial_uploads/moderation-failure';
  const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v123/nexussocial_uploads/moderation-failure.jpg';
  const imageCleanupToken = createCloudinaryCleanupTicket({ userId: 'member', publicId, secret: 'test-secret' });
  const { service, calls } = createHarness({ imageError: new Error('model unavailable') });

  await assert.rejects(service.createPost({
    groupId: '1', user: user('member'), content: 'Ảnh chưa được kiểm duyệt', imageUrl, imageCleanupToken,
  }), (error) => error.statusCode === 503);

  assert.deepEqual(calls.deletedImages, [publicId]);
  assert.equal(calls.createdPosts.length, 0);
});

test('failed group post persistence deletes its uploaded image after successful moderation', async () => {
  const publicId = 'nexussocial_uploads/database-failure';
  const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v123/nexussocial_uploads/database-failure.jpg';
  const imageCleanupToken = createCloudinaryCleanupTicket({ userId: 'member', publicId, secret: 'test-secret' });
  const imageResult = { decision: 'safe', scores: { safe: 0.98, nsfw: 0.01, violence: 0.01 }, thresholds: {}, source: 'efficientnet-b1' };
  const { service, calls } = createHarness({ imageResult, createPostError: new Error('database unavailable') });

  await assert.rejects(service.createPost({
    groupId: '1', user: user('member'), content: 'Bài có ảnh', imageUrl, imageCleanupToken,
  }), /database unavailable/);

  assert.deepEqual(calls.deletedImages, [publicId]);
  assert.equal(calls.createdPosts.length, 1);
});

test('a successful group post consumes its cleanup ticket without deleting the image', async () => {
  const publicId = 'nexussocial_uploads/successful-post';
  const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v123/nexussocial_uploads/successful-post.jpg';
  const imageCleanupToken = createCloudinaryCleanupTicket({ userId: 'member', publicId, secret: 'test-secret' });
  const imageResult = { decision: 'safe', scores: { safe: 0.98, nsfw: 0.01, violence: 0.01 }, thresholds: {}, source: 'efficientnet-b1' };
  const { service, calls } = createHarness({ imageResult });

  await service.createPost({ groupId: '1', user: user('member'), content: 'Bài có ảnh', imageUrl, imageCleanupToken });

  assert.deepEqual(calls.deletedImages, []);
  assert.equal(verifyCloudinaryCleanupTicket({ ticket: imageCleanupToken, userId: 'member', imageUrl, secret: 'test-secret' }), null);
});

test('automatic mode sends flagged or low-confidence posts to human review', async () => {
  const { service: flaggedService, calls: flaggedCalls } = createHarness({ aiResult: { label: 'Violence', confidence: 0.96, action: 'hide' } });
  await flaggedService.updatePostApprovalMode({ groupId: '1', user: user('owner'), postApprovalMode: 'automatic' });
  const flagged = await flaggedService.createPost({ groupId: '1', user: user('member'), content: 'Nội dung cần xem xét' });

  const { service: uncertainService, calls: uncertainCalls } = createHarness({ aiResult: { label: 'Normal', confidence: 0.65, action: 'allow' } });
  await uncertainService.updatePostApprovalMode({ groupId: '1', user: user('owner'), postApprovalMode: 'automatic' });
  const uncertain = await uncertainService.createPost({ groupId: '1', user: user('member'), content: 'Nội dung chưa chắc chắn' });

  const { service: inconsistentService } = createHarness({ aiResult: { label: 'Toxic', confidence: 0.99, action: 'allow' } });
  await inconsistentService.updatePostApprovalMode({ groupId: '1', user: user('owner'), postApprovalMode: 'automatic' });
  const inconsistent = await inconsistentService.createPost({ groupId: '1', user: user('member'), content: 'Kết quả AI không nhất quán' });

  assert.equal(flagged.status, 'pending');
  assert.equal(flaggedCalls.createdPosts[0].reviewStatus, 'pending');
  assert.equal(uncertain.status, 'pending');
  assert.equal(uncertainCalls.createdPosts[0].reviewStatus, 'pending');
  assert.equal(inconsistent.status, 'pending');
});

test('group admins publish directly and carry only author penalties for their own violations', async () => {
  const { service, calls } = createHarness({ aiResult: { label: 'Violence', confidence: 0.96, action: 'hide' } });
  const post = await service.createPost({ groupId: '1', user: user('owner'), content: 'Bài của quản trị viên' });

  assert.equal(post.status, 'rejected');
  assert.equal(calls.createdPosts[0].reviewStatus, 'rejected');
  assert.equal(calls.createdPosts[0].authorTrustPenalty, 35);
  assert.equal(calls.createdPosts[0].moderatorTrustPenalty, 0);

  const { service: safeService, calls: safeCalls } = createHarness();
  const safePost = await safeService.createPost({ groupId: '1', user: user('owner'), content: 'Bài an toàn của quản trị viên' });
  assert.equal(safePost.status, 'approved');
  assert.equal(safeCalls.createdPosts[0].reviewStatus, 'approved');
});

test('approving a flagged member post deducts author trust and separate group moderator trust', async () => {
  const { service, calls } = createHarness();
  await service.reviewPost({ groupId: '1', postId: '10', user: user('admin'), decision: 'approved' });

  assert.equal(calls.reviewedPosts[0].authorTrustPenalty, 35);
  assert.equal(calls.reviewedPosts[0].moderatorTrustPenalty, 35);
});

test('reviewing a post flagged by both PhoBERT and EfficientNet combines the violation penalty', async () => {
  const { service, calls } = createHarness({
    reviewImageModeration: { decision: 'rejected' },
  });
  await service.reviewPost({ groupId: '1', postId: '12', user: user('admin'), decision: 'approved' });

  assert.equal(calls.reviewedPosts[0].authorTrustPenalty, 49);
  assert.equal(calls.reviewedPosts[0].moderatorTrustPenalty, 49);
});

test('rejecting a flagged member post deducts the author but does not penalize the reviewer', async () => {
  const { service, calls } = createHarness();
  await service.reviewPost({ groupId: '1', postId: '10', user: user('admin'), decision: 'rejected' });

  assert.equal(calls.reviewedPosts[0].authorTrustPenalty, 35);
  assert.equal(calls.reviewedPosts[0].moderatorTrustPenalty, 0);
});

test('a reviewer who approves their own legacy pending post is not penalized as a moderator', async () => {
  const { service, calls } = createHarness({ reviewAuthorId: 'admin' });
  const result = await service.reviewPost({ groupId: '1', postId: '10', user: user('admin'), decision: 'approved' });

  assert.equal(calls.reviewedPosts[0].authorTrustPenalty, 35);
  assert.equal(result.moderatorTrustPenalty, 0);
});

test('automatic mode does not treat rule fallback as an AI approval', async () => {
  const { service, calls } = createHarness({ moderationSource: 'rules' });
  await service.updatePostApprovalMode({ groupId: '1', user: user('owner'), postApprovalMode: 'automatic' });
  const post = await service.createPost({ groupId: '1', user: user('member'), content: 'Nội dung an toàn theo luật dự phòng' });

  assert.equal(post.status, 'pending');
  assert.equal(calls.createdPosts[0].reviewStatus, 'pending');
});

test('only an admin of the same group can review a post', async () => {
  const { service, calls } = createHarness();
  await assert.rejects(
    service.reviewPost({ groupId: '1', postId: '10', user: user('member'), decision: 'approved' }),
    (error) => error.statusCode === 403
  );
  const result = await service.reviewPost({ groupId: '1', postId: '10', user: user('admin'), decision: 'approved' });

  assert.equal(result.status, 'approved');
  assert.equal(calls.reviewedPosts.length, 1);
});

test('private group posts are not visible to non-members and hidden groups cannot be opened by ID', async () => {
  const { service } = createHarness();
  await assert.rejects(service.listPosts({ groupId: '2', user: null }), (error) => error.statusCode === 403);
  await assert.rejects(service.getGroup({ groupId: '3', user: null }), (error) => error.statusCode === 404);
});

test('group home feed is member-only while explicit public-group search is available to non-members', async () => {
  const { service, calls } = createHarness();

  assert.deepEqual(await service.listHomePosts({ user: null }), []);
  assert.deepEqual(await service.listHomePosts({ user: null, search: ' public ' }), [{ id: 'group-post-1', groupId: '1' }]);
  assert.deepEqual(await service.listHomePosts({ user: null, search: 'x'.repeat(120) }), [{ id: 'group-post-1', groupId: '1' }]);
  assert.deepEqual(await service.listHomePosts({ user: user('member') }), [{ id: 'group-post-1', groupId: '1' }]);
  assert.deepEqual(calls.homeFeedRequests, [
    { viewerId: null, search: 'public' },
    { viewerId: null, search: 'x'.repeat(100) },
    { viewerId: 'member', search: '' },
  ]);
});

test('group home feed repository limits regular feed to active memberships and permits public posts in explicit search', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{ id: '1', groupId: '2', groupName: 'Public group' }] };
    },
  };
  const repository = createCommunityGroupsRepository({ pool });

  const posts = await repository.listHomePosts({ viewerId: 'member', search: 'public' });
  const { sql: query, params } = calls[0];

  assert.deepEqual(params, ['member', 'public']);
  assert.deepEqual(posts, [{ id: '1', groupId: '2', groupName: 'Public group' }]);
  assert.match(query, /p\.review_status = 'approved'/);
  assert.match(query, /membership\.user_id = \$1/);
  assert.match(query, /membership\.status = 'active'/);
  assert.match(query, /g\.privacy = 'public'/);
  assert.match(query, /\$2 <> ''/);
  assert.match(query, /FALSE AS "canRecommend"/);
});

test('group post reactions, comments, and shares are limited to active group members', async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.setPostReaction({ groupId: '1', postId: '42', user: user('visitor'), reactionType: 'like', action: 'set' }),
    (error) => error.statusCode === 403
  );
  await assert.rejects(
    service.createPostComment({ groupId: '1', postId: '42', user: user('visitor'), content: 'Hello' }),
    (error) => error.statusCode === 403
  );
  await assert.rejects(
    service.shareGroupPost({ groupId: '1', postId: '42', user: user('visitor') }),
    (error) => error.statusCode === 403
  );
});

test('group post reactions and comments validate the target post and reject empty content', async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.setPostReaction({ groupId: '1', postId: '0', user: user('member'), reaction: 'like' }),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    service.setPostReaction({ groupId: '1', postId: '42', user: user('member'), reactionType: 'unknown', action: 'set' }),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    service.createPostComment({ groupId: '1', postId: '42', user: user('member'), content: '  ' }),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    service.createPostComment({ groupId: '1', postId: '42', user: user('member'), content: 'x'.repeat(2001) }),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    service.setPostReaction({ groupId: '1', postId: '999', user: user('member'), reactionType: 'like', action: 'set' }),
    (error) => error.statusCode === 404
  );
});

test('active members can react, read and add comments, and share approved group posts', async () => {
  const { service, calls } = createHarness();

  const reaction = await service.setPostReaction({ groupId: '1', postId: '42', user: user('member'), reactionType: 'love', action: 'set' });
  const comments = await service.listPostComments({ groupId: '1', postId: '42', user: null });
  const comment = await service.createPostComment({ groupId: '1', postId: '42', user: user('member'), content: '  Bình luận thật  ' });
  const share = await service.shareGroupPost({ groupId: '1', postId: '42', user: user('member') });

  assert.deepEqual(reaction, { likesCount: 1, myReaction: 'love' });
  assert.deepEqual(comments, []);
  assert.equal(comment.content, 'Bình luận thật');
  assert.deepEqual(share, { sharesCount: 1 });
  assert.deepEqual(calls.groupReactions[0], { groupId: '1', postId: '42', userId: 'member', reactionType: 'love', action: 'set' });
  assert.deepEqual(calls.groupShares[0], { groupId: '1', postId: '42', userId: 'member' });
});

test('group reaction list returns real reactors only for approved posts visible to the viewer', async () => {
  const { service, calls } = createHarness();

  const reactors = await service.listPostReactions({ groupId: '1', postId: '42', user: null });

  assert.deepEqual(reactors, [{ userId: 'member', name: 'Thành viên', username: 'member', avatar: '/avatar.jpg', reactionType: 'love' }]);
  assert.deepEqual(calls.groupReactionPeople, [{ groupId: '1', postId: '42' }]);
  await assert.rejects(
    service.listPostReactions({ groupId: '2', postId: '42', user: null }),
    (error) => error.statusCode === 403
  );
  await assert.rejects(
    service.listPostReactions({ groupId: '1', postId: '999', user: null }),
    (error) => error.statusCode === 404
  );
});

test('group interaction repository queries are scoped to approved posts and persist each interaction', async () => {
  const calls = [];
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('COUNT(r.user_id)::int AS "likesCount"')) return { rows: [{ likesCount: 2, myReaction: 'like', reactionCounts: { like: 1, love: 1 } }] };
      if (sql.includes('COUNT(s.id)::int AS "sharesCount"')) return { rows: [{ sharesCount: 3 }] };
      if (sql.includes('FROM community_group_posts')) return { rows: [{ id: '42', groupId: '1' }] };
      return { rows: [] };
    },
  };
  const repository = createCommunityGroupsRepository({ pool });

  await repository.findApprovedPost({ groupId: '1', postId: '42' });
  await repository.listPostComments({ groupId: '1', postId: '42' });
  const reactors = await repository.listPostReactions({ groupId: '1', postId: '42' });
  const reaction = await repository.setPostReaction({ groupId: '1', postId: '42', userId: 'member', reactionType: 'like', action: 'set' });
  await repository.createPostComment({ groupId: '1', postId: '42', authorId: 'member', content: 'A comment' });
  const share = await repository.recordPostShare({ groupId: '1', postId: '42', userId: 'member' });

  assert.match(calls[0].sql, /group_id = \$1 AND id = \$2 AND review_status = 'approved'/);
  assert.match(calls[1].sql, /p\.group_id = \$1 AND p\.review_status = 'approved'/);
  assert.match(calls[1].sql, /community_group_post_comments/);
  assert.match(calls[2].sql, /JOIN users u ON u\.id = r\.user_id/);
  assert.match(calls[2].sql, /p\.group_id = \$1 AND p\.id = \$2 AND p\.review_status = 'approved'/);
  assert.deepEqual(reactors, []);
  assert.match(calls[3].sql, /INSERT INTO community_group_post_reactions/);
  assert.deepEqual(reaction, { likesCount: 2, myReaction: 'like', reactionCounts: { like: 1, love: 1 } });
  assert.match(calls[4].sql, /jsonb_object_agg\(summary\.reaction_type, summary\.count\)/);
  assert.ok(calls.some(({ sql }) => sql.includes('INSERT INTO community_group_post_comments')));
  assert.ok(calls.some(({ sql }) => sql.includes('INSERT INTO community_group_post_shares')));
  assert.deepEqual(share, { sharesCount: 3 });
});

test('admin-authored group violations deduct only the author trust score transactionally', async () => {
  const pool = createTransactionalPool((sql) => {
    if (sql.includes('INSERT INTO community_group_posts')) {
      return { rows: [{ id: '77', groupId: '1', authorId: 'owner', status: 'rejected' }] };
    }
    if (sql.includes('UPDATE users')) return { rows: [{ trust_score: 65, status: 'active' }] };
    return { rows: [] };
  });
  const repository = createCommunityGroupsRepository({ pool });
  const imageUrl = 'https://res.cloudinary.com/demo/image/upload/test.jpg';
  const imageModeration = { decision: 'safe', confidence: 0.98, source: 'efficientnet-b1' };

  await repository.createPost({
    groupId: '1', authorId: 'owner', content: 'Nội dung bạo lực', imageUrl, imageModeration,
    aiLabel: 'Violence', aiConfidence: 0.96, aiAction: 'hide', aiSource: 'phobert', reviewStatus: 'rejected',
    authorTrustPenalty: 35, moderatorTrustPenalty: 0,
  });

  const insert = pool.calls.find((call) => call.sql.includes('INSERT INTO community_group_posts'));
  assert.equal(insert.params[3], imageUrl);
  assert.equal(insert.params[4], JSON.stringify(imageModeration));
  assert.equal(insert.params[8], 'phobert');
  assert.ok(pool.calls.some((call) => call.sql.includes('UPDATE users')));
  assert.ok(pool.calls.some((call) => call.sql.includes('INSERT INTO user_trust_logs')));
  assert.ok(!pool.calls.some((call) => call.sql.includes('UPDATE community_group_members')));
  assert.ok(pool.calls.some((call) => call.sql === 'COMMIT'));
});

test('manual approval records separate member and moderator deductions in the same transaction', async () => {
  const pool = createTransactionalPool((sql) => {
    if (sql.includes('UPDATE community_group_posts')) {
      return { rows: [{ id: '77', groupId: '1', authorId: 'member', content: 'Bạo lực', status: 'approved', aiLabel: 'Violence' }] };
    }
    if (sql.includes('UPDATE users')) return { rows: [{ trust_score: 65, status: 'active' }] };
    if (sql.includes('SELECT moderation_score')) return { rows: [{ score: 100 }] };
    if (sql.includes('UPDATE community_group_members')) return { rows: [{ score: 65 }] };
    return { rows: [] };
  });
  const repository = createCommunityGroupsRepository({ pool });

  const result = await repository.reviewPost({
    groupId: '1', postId: '77', reviewerId: 'admin', decision: 'approved', reason: '',
    authorTrustPenalty: 35, moderatorTrustPenalty: 35,
  });
  const auditLog = pool.calls.find((call) => call.sql.includes('INSERT INTO community_group_moderation_logs'));

  assert.equal(result.moderatorTrustScoreAfter, 65);
  assert.equal(result.moderatorTrustPenalty, 35);
  assert.deepEqual(auditLog.params.slice(5), [-35, -35, 65]);
  assert.ok(pool.calls.some((call) => call.sql === 'COMMIT'));
});

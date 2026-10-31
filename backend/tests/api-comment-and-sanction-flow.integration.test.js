import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostsController } from '../src/controllers/postsController.js';
import { createUserRepository } from '../src/repositories/userRepository.js';

test('INTEGRATION FLOW: Bình luận Toxic -> Cảnh báo Friendly Nudge -> Force Comment -> Trừ điểm & Tạo bình luận', async () => {
  const executedDbQueries = [];
  let userScore = 100;

  const mockPool = {
    async query(sql, params) {
      executedDbQueries.push({ sql, params });
      if (/UPDATE users[\s\S]*trust_score = GREATEST/i.test(sql)) {
        userScore = Math.max(0, userScore - params[0]);
        return { rows: [{ id: params[1], trust_score: userScore, status: 'active' }] };
      }
      return { rows: [] };
    },
  };

  const mockPostRepo = {
    pool: mockPool,
    async createComment(input) {
      return {
        id: 555,
        post_id: input.postId,
        author_id: input.authorId,
        content: input.content,
        ai_label: input.aiLabel,
        is_hidden: input.isHidden,
        is_soft_hidden: input.isSoftHidden,
        created_at: new Date(),
      };
    },
  };

  const controller = createPostsController({
    postService: {},
    postRepository: mockPostRepo,
  });

  const testUser = { id: 'user-commenter-1', role: 'user', status: 'active' };

  // 1. Lần 1: Người dùng gửi bình luận tiêu cực (chưa có forceComment)
  // Kết quả: Hệ thống chặn lại và trả về Friendly Nudge
  let nudgeResponse = null;
  const req1 = {
    params: { postId: '10' },
    user: testUser,
    body: { content: 'Đồ ngu ngốc thật là rác rưởi', forceComment: false },
  };
  const res1 = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      nudgeResponse = data;
      return this;
    },
  };

  await controller.createComment(req1, res1, () => {});
  assert.equal(res1.statusCode, 200);
  assert.equal(nudgeResponse.nudge, true);
  assert.ok(['toxic', 'hate_speech'].includes(nudgeResponse.warningType), 'Cảnh báo phải thuộc nhóm vi phạm ngôn từ');
  assert.equal(executedDbQueries.length, 0, 'Chưa được trừ điểm nếu người dùng chưa bấm gửi tiếp tục');

  // 2. Lần 2: Người dùng bấm [Vẫn tiếp tục gửi] -> forceComment: true
  // Kết quả: Bình luận được lưu và điểm uy tín bị trừ
  let finalResponse = null;
  const req2 = {
    params: { postId: '10' },
    user: testUser,
    body: { content: 'Đồ ngu ngốc thật là rác rưởi', forceComment: true },
  };
  const res2 = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      finalResponse = data;
      return this;
    },
  };

  await controller.createComment(req2, res2, () => {});
  assert.equal(res2.statusCode, 201);
  assert.equal(finalResponse.success, true);
  assert.equal(finalResponse.data.id, '555');

  // Xác minh điểm uy tín đã bị trừ trong mock pool
  const penaltyQuery = executedDbQueries.find(q => /UPDATE users[\s\S]*trust_score = GREATEST/i.test(q.sql));
  assert.ok(penaltyQuery, 'Lệnh trừ điểm uy tín phải được gọi khi forceComment');
  assert.ok([5, 20].includes(penaltyQuery.params[0]), 'Bình luận vi phạm phải bị trừ 5 (Toxic) hoặc 20 (Hate Speech)');
  assert.ok(userScore <= 95);
});

test('INTEGRATION FLOW: Admin xử phạt Khóa tài khoản (Ban) -> Chặn người dùng tương tác -> Gỡ phạt (Unban)', async () => {
  let targetUser = {
    id: 'user-violator',
    role: 'user',
    status: 'active',
    banned_until: null,
    ban_reason: null,
  };

  const mockPool = {
    async query(sql, params) {
      if (/UPDATE users[\s\S]*SET status =/i.test(sql)) {
        targetUser.status = params[0];
        targetUser.banned_until = params[1];
        targetUser.ban_reason = params[2];
        return { rows: [targetUser] };
      }
      return { rows: [] };
    },
  };

  const userRepo = createUserRepository({ pool: mockPool });
  userRepo.findById = async (id) => ({ ...targetUser, id });

  // 1. Admin thực hiện Khóa tài khoản 7 ngày
  const banRes = await userRepo.updateSanctionStatus({
    targetUserId: targetUser.id,
    action: 'ban',
    durationDays: 7,
    reason: 'Vi phạm nghiêm trọng chính sách cộng đồng',
    actorId: 'admin-super-id',
  });

  assert.equal(banRes.status, 'banned');
  assert.ok(banRes.banned_until !== null);
  assert.equal(banRes.ban_reason, 'Vi phạm nghiêm trọng chính sách cộng đồng');

  // 2. Admin thực hiện Mở khóa tài khoản (Unban)
  const unbanRes = await userRepo.updateSanctionStatus({
    targetUserId: targetUser.id,
    action: 'unban',
    actorId: 'admin-super-id',
  });

  assert.equal(unbanRes.status, 'active');
  assert.equal(unbanRes.banned_until, null);
  assert.equal(unbanRes.ban_reason, null);
});

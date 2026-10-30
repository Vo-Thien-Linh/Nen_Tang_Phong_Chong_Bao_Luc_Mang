import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTrustPenalty, refundTrustPoints, calculateTrustDeduction } from '../src/services/trustScoreService.js';

test('INTEGRATION FLOW: Báo cáo vi phạm -> Moderator duyệt phạt -> Tác giả kháng cáo -> Admin minh oan & hoàn điểm', async () => {
  const dbLogs = [];
  const dbNotifications = [];
  let userTrustScore = 100;
  let postStatus = 'approved';
  let postLabel = 'Normal';
  let userStatus = 'active';

  const mockPool = {
    async query(sql, params) {
      // 1. Cập nhật điểm uy tín khi bị phạt
      if (/UPDATE users[\s\S]*trust_score = GREATEST/i.test(sql)) {
        const amount = params[0];
        userTrustScore = Math.max(0, userTrustScore - amount);
        return { rows: [{ id: params[1], trust_score: userTrustScore, status: userStatus }] };
      }

      // 2. Cập nhật điểm uy tín khi được hoàn trả
      if (/UPDATE users[\s\S]*trust_score = LEAST/i.test(sql)) {
        const amount = params[0];
        userTrustScore = Math.min(100, userTrustScore + amount);
        return { rows: [{ id: params[1], trust_score: userTrustScore }] };
      }

      // 3. Ghi log vào user_trust_logs
      if (/INSERT INTO user_trust_logs/i.test(sql)) {
        dbLogs.push({
          sql,
          params,
          userId: params[0],
          changeAmount: params[1],
          newScore: params[2],
          reason: params[3],
          actionType: /'appeal_refund'/i.test(sql) ? 'appeal_refund' : params[4],
          contentId: /'appeal_refund'/i.test(sql) ? params[4] : params[5],
        });
        return { rows: [{ id: dbLogs.length }] };
      }

      // 4. Ghi thông báo vào notifications
      if (/INSERT INTO notifications/i.test(sql)) {
        dbNotifications.push({
          recipientId: params[0],
          content: params[2],
          targetPostId: params[3],
        });
        return { rows: [{ id: dbNotifications.length }] };
      }

      return { rows: [] };
    },
  };

  const authorId = 'user-author-uuid-1';
  const postId = 101;

  // -------------------------------------------------------------
  // GIAI ĐOẠN 1: Bài viết bị người khác báo cáo là Hate Speech
  // Moderator vào duyệt báo cáo -> Xác nhận vi phạm 'resolved_violation'
  // -------------------------------------------------------------
  const reportDeduction = calculateTrustDeduction('Hate Speech', 'safe');
  assert.equal(reportDeduction, 20, 'Hate speech phải bị trừ 20 điểm');

  // Áp dụng phạt khi moderator duyệt báo cáo vi phạm
  const penaltyRes = await applyTrustPenalty({
    pool: mockPool,
    userId: authorId,
    amount: reportDeduction,
    reason: 'Bị báo cáo vi phạm tiêu chuẩn cộng đồng (Hate Speech)',
    actionType: 'report_violation',
    contentId: postId,
  });

  postStatus = 'hidden';
  postLabel = 'Hate Speech';

  // Xác minh giai đoạn 1:
  assert.equal(penaltyRes.trustScore, 80, 'Điểm uy tín phải giảm từ 100 xuống 80');
  assert.equal(userTrustScore, 80);
  assert.equal(dbLogs.length, 1);
  assert.equal(dbLogs[0].changeAmount, -20);
  assert.equal(dbLogs[0].actionType, 'report_violation');
  assert.equal(dbNotifications.length, 1);
  assert.match(dbNotifications[0].content, /80\/100/);

  // -------------------------------------------------------------
  // GIAI ĐOẠN 2: Tác giả thấy bị phạt oan, gửi đơn khiếu nại (Appeal)
  // Quản trị viên (Admin) xem xét và CHẤP THUẬN khiếu nại (approved)
  // -------------------------------------------------------------
  const refundRes = await refundTrustPoints({
    pool: mockPool,
    userId: authorId,
    amount: 20,
    reason: 'Kháng cáo thành công, minh oan nội dung',
    contentId: postId,
  });

  postStatus = 'approved';
  postLabel = 'Normal';

  // Xác minh giai đoạn 2:
  assert.equal(refundRes.trustScore, 100, 'Điểm uy tín phải được phục hồi về 100');
  assert.equal(userTrustScore, 100);
  assert.equal(dbLogs.length, 2);
  assert.equal(dbLogs[1].changeAmount, 20);
  assert.equal(dbLogs[1].actionType, 'appeal_refund');
  assert.equal(dbNotifications.length, 2);
  assert.match(dbNotifications[1].content, /Kháng cáo thành công/);
  assert.equal(postStatus, 'approved', 'Bài viết được phục hồi hiển thị');
});

test('INTEGRATION FLOW: Vi phạm nhiều lần liên tiếp -> Điểm tụt dưới 30 -> Tự động kích hoạt hạn chế Cooldown', async () => {
  const executedUpdates = [];
  let currentScore = 50;

  const mockPool = {
    async query(sql, params) {
      if (/UPDATE users[\s\S]*trust_score = GREATEST/i.test(sql)) {
        currentScore = Math.max(0, currentScore - params[0]);
        return { rows: [{ id: params[1], trust_score: currentScore, status: 'active' }] };
      }
      if (/UPDATE users[\s\S]*SET status = 'cooldown'/i.test(sql)) {
        executedUpdates.push({ type: 'auto_cooldown', params });
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  await applyTrustPenalty({
    pool: mockPool,
    userId: 'user-spammer',
    amount: 25,
    reason: 'Tái phạm nhiều lần',
    actionType: 'post_violation',
    contentId: 202,
  });

  assert.equal(currentScore, 25);
  const cooldownAction = executedUpdates.find(u => u.type === 'auto_cooldown');
  assert.ok(cooldownAction, 'Phải tự động phạt cooldown khi điểm uy tín dưới 30');
  assert.equal(cooldownAction.params[1], 'user-spammer');
});

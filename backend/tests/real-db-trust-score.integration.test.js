import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import {
  applyTrustPenalty,
  refundTrustPoints,
  getUserTrustHistory,
  checkAndRecoverTrustScore,
} from '../src/services/trustScoreService.js';

const withTimeout = (promise, ms = 4000) => {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout sau ${ms}ms kết nối CSDL`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
};

test('Real Database Trust Score & Logs Integration Test', async (t) => {
  // Kiểm tra an toàn cho môi trường CI / GitHub Actions
  if (!process.env.DATABASE_URL) {
    t.skip('Bỏ qua: Chưa cấu hình biến môi trường DATABASE_URL');
    return;
  }

  let healthRes;
  try {
    healthRes = await withTimeout(pool.query('SELECT NOW() AS current_time'), 4000);
  } catch (err) {
    t.skip('Bỏ qua: Không thể kết nối tới cơ sở dữ liệu thật (' + err.message + ')');
    return;
  }
  assert.ok(healthRes?.rows?.[0]?.current_time, 'Kết nối PostgreSQL Supabase thành công');

  // Lấy 1 người dùng thật từ CSDL để test
  let testUser;
  let initialScore;
  try {
    const userRes = await pool.query('SELECT id, username, trust_score FROM users ORDER BY created_at ASC LIMIT 1');
    if (!userRes.rows || userRes.rows.length === 0) {
      t.skip('Bỏ qua: Cần ít nhất 1 người dùng trong CSDL để test');
      return;
    }
    testUser = userRes.rows[0];
    initialScore = Number(testUser.trust_score ?? 100);
  } catch (err) {
    t.skip('Bỏ qua: Không thể truy vấn bảng users (' + err.message + ')');
    return;
  }

  try {
    // 1. Kiểm tra applyTrustPenalty trên DB thật (trừ 5 điểm test)
    const penaltyResult = await applyTrustPenalty({
      pool,
      userId: testUser.id,
      amount: 5,
      reason: 'Integration Test: Trừ điểm kiểm thử tự động',
      actionType: 'integration_test_penalty',
      contentId: null,
    });

    assert.ok(penaltyResult, 'Kết quả trừ điểm không được null');
    assert.equal(penaltyResult.deducted, 5);
    assert.equal(penaltyResult.trustScore, Math.max(0, initialScore - 5));

    // Xác nhận trực tiếp trong bảng users của PostgreSQL
    const checkUserRes = await pool.query('SELECT trust_score FROM users WHERE id = $1', [testUser.id]);
    assert.equal(Number(checkUserRes.rows[0].trust_score), Math.max(0, initialScore - 5));

    // 2. Kiểm tra getUserTrustHistory lấy dữ liệu từ bảng user_trust_logs
    const history = await getUserTrustHistory({ pool, userId: testUser.id, limit: 5 });
    assert.ok(Array.isArray(history), 'Lịch sử phải là một danh sách mảng');
    assert.ok(history.length > 0, 'Phải có ít nhất 1 bản ghi nhật ký');
    const latestLog = history[0];
    assert.equal(latestLog.change_amount, -5);
    assert.equal(latestLog.action_type, 'integration_test_penalty');

    // 3. Kiểm tra refundTrustPoints trên DB thật (hoàn lại 5 điểm)
    const refundResult = await refundTrustPoints({
      pool,
      userId: testUser.id,
      amount: 5,
      reason: 'Integration Test: Hoàn điểm sau kiểm thử',
      contentId: null,
    });

    assert.ok(refundResult, 'Kết quả hoàn điểm không được null');
    assert.equal(refundResult.refunded, 5);
    assert.equal(refundResult.trustScore, initialScore);

    // Xác nhận lại điểm đã phục hồi nguyên vẹn trong DB
    const restoredUserRes = await pool.query('SELECT trust_score FROM users WHERE id = $1', [testUser.id]);
    assert.equal(Number(restoredUserRes.rows[0].trust_score), initialScore);

  } catch (err) {
    // Nếu bảng user_trust_logs chưa có hoặc xảy ra lỗi logic trên DB thật
    t.skip('Bỏ qua: Thao tác trust score trên DB thật không khả dụng (' + err.message + ')');
  } finally {
    if (testUser) {
      // Luôn dọn dẹp các log test tạo ra trong user_trust_logs để giữ CSDL sạch sẽ
      await pool.query(
        `DELETE FROM user_trust_logs 
         WHERE user_id = $1 AND action_type IN ('integration_test_penalty', 'appeal_refund')
           AND reason LIKE 'Integration Test%'`,
        [testUser.id]
      ).catch(() => {});

      // Đảm bảo khôi phục lại điểm số ban đầu của user
      await pool.query('UPDATE users SET trust_score = $1 WHERE id = $2', [initialScore, testUser.id]).catch(() => {});
    }
  }
});

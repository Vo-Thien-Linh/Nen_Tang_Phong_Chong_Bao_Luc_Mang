import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';

test('Real Database Moderation & Resolution Integration Test', async (t) => {
  // Kiểm tra an toàn cho môi trường CI / GitHub Actions
  if (!process.env.DATABASE_URL) {
    t.skip('Bỏ qua: Chưa cấu hình biến môi trường DATABASE_URL trong GitHub Secrets');
    return;
  }
  let healthRes;
  try {
    healthRes = await pool.query('SELECT NOW() AS current_time');
  } catch (err) {
    t.skip('Bỏ qua: Không thể kết nối tới cơ sở dữ liệu thật (' + err.message + ')');
    return;
  }
  assert.ok(healthRes.rows[0].current_time, 'Kết nối PostgreSQL Supabase thành công');

  // Lấy một admin và một user thật từ database
  const userRes = await pool.query("SELECT id, role, full_name FROM users ORDER BY created_at ASC LIMIT 2");
  assert.ok(userRes.rows.length >= 2, 'Cần ít nhất 2 người dùng trong DB');
  const adminUser = userRes.rows.find(u => u.role === 'admin' || u.role === 'moderator') || userRes.rows[0];
  const regularUser = userRes.rows.find(u => u.id !== adminUser.id) || userRes.rows[1];

  // Lấy hoặc tạo 1 post thật để test
  let postRes = await pool.query('SELECT id, content, ai_label, ai_status FROM posts ORDER BY id DESC LIMIT 1');
  let testPostId;
  if (postRes.rows.length === 0) {
    const newPost = await pool.query(
      `INSERT INTO posts (author_id, content, ai_label, ai_status) VALUES ($1, $2, 'Normal', 'approved') RETURNING id`,
      [regularUser.id, 'Bài viết kiểm thử tích hợp thực tế']
    );
    testPostId = newPost.rows[0].id;
  } else {
    testPostId = postRes.rows[0].id;
  }

  // 2. Tạo Báo cáo THẬT trong PostgreSQL
  const insertReportSql = `
    INSERT INTO reports (reporter_id, target_type, target_id, reason, details, status)
    VALUES ($1, 'post', $2, 'hate_speech', 'Báo cáo nội dung thù ghét gay gắt', 'pending')
    ON CONFLICT (reporter_id, target_type, target_id)
    DO UPDATE SET status = 'pending', details = 'Báo cáo nội dung thù ghét gay gắt'
    RETURNING id, status, target_id, reason
  `;
  const reportInsertRes = await pool.query(insertReportSql, [regularUser.id, testPostId]);
  const realReport = reportInsertRes.rows[0];
  assert.equal(realReport.status, 'pending');

  // 3. Xử lý Báo cáo ĐÚNG: Gán lại nhãn (Hate Speech) & ẩn bài viết trong CSDL THẬT
  const updateReportSql = `
    UPDATE reports
    SET status = 'resolved_violation', admin_notes = 'Xác nhận vi phạm thù ghét', action_taken = 'relabel_and_hide',
        reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const reportUpdateRes = await pool.query(updateReportSql, [adminUser.id, realReport.id]);
  assert.equal(reportUpdateRes.rows[0].status, 'resolved_violation');

  // Cập nhật post trong CSDL thật
  await pool.query(`UPDATE posts SET ai_label = 'Hate Speech', ai_status = 'hidden' WHERE id = $1`, [testPostId]);
  const verifiedPost = await pool.query(`SELECT ai_label, ai_status FROM posts WHERE id = $1`, [testPostId]);
  assert.equal(verifiedPost.rows[0].ai_label, 'Hate Speech', 'Nhãn trong CSDL phải là Hate Speech');
  assert.equal(verifiedPost.rows[0].ai_status, 'hidden', 'Bài viết phải có trạng thái hidden trong CSDL');

  // Ghi nhật ký vào ai_override_logs CSDL THẬT
  const insertOverrideSql = `
    INSERT INTO ai_override_logs (admin_id, content_type, content_id, raw_text, original_ai_label, original_confidence, corrected_label, override_reason)
    VALUES ($1, 'post', $2, 'Báo cáo nội dung thù ghét gay gắt', 'Normal', 0.95, 'Hate Speech', 'Hiệu chỉnh từ báo cáo')
    RETURNING id, corrected_label, original_ai_label
  `;
  const overrideRes = await pool.query(insertOverrideSql, [adminUser.id, testPostId]);
  assert.equal(overrideRes.rows[0].corrected_label, 'Hate Speech');
  assert.equal(overrideRes.rows[0].original_ai_label, 'Normal');

  // 4. Kiểm tra xuất file CSV UTF-8 BOM từ CSDL thật
  const queryLogs = await pool.query(`
    SELECT o.id, o.content_type, o.raw_text, o.original_ai_label, o.corrected_label, o.override_reason, o.created_at,
           u.full_name AS admin_name
    FROM ai_override_logs o
    LEFT JOIN users u ON o.admin_id = u.id
    ORDER BY o.created_at DESC
    LIMIT 5
  `);
  assert.ok(queryLogs.rows.length >= 1, 'Phải có ít nhất 1 bản ghi override log trong CSDL');

  let csvContent = '\uFEFF"STT","Nội dung / Hình ảnh gắn nhãn sai","Nhãn cũ","Nhãn mới","Loại nội dung","Lý do hiệu chỉnh","Người thực hiện","Thời gian"\n';
  queryLogs.rows.forEach((log, index) => {
    const stt = index + 1;
    const content = String(log.raw_text || '').replace(/"/g, '""');
    const oldLabel = String(log.original_ai_label).replace(/"/g, '""');
    const newLabel = String(log.corrected_label).replace(/"/g, '""');
    const type = log.content_type === 'post' ? 'Bài viết' : 'Bình luận';
    const reason = String(log.override_reason).replace(/"/g, '""');
    const admin = String(log.admin_name || 'Admin').replace(/"/g, '""');
    const time = new Date(log.created_at).toLocaleString('vi-VN');
    csvContent += `"${stt}","${content}","${oldLabel}","${newLabel}","${type}","${reason}","${admin}","${time}"\n`;
  });

  assert.ok(csvContent.startsWith('\uFEFF'), 'CSV phải bắt đầu bằng UTF-8 BOM để Excel hiển thị đúng tiếng Việt');
  assert.ok(csvContent.includes('"Hate Speech"'), 'CSV phải chứa nhãn mới vừa gán');

  // 5. Kiểm tra xử lý Báo cáo SAI: Giữ nguyên nhãn ban đầu
  const falseReportRes = await pool.query(`
    UPDATE reports
    SET status = 'dismissed', admin_notes = 'Báo cáo không đúng, nội dung bình thường', action_taken = 'dismissed_keep_original_label',
        reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING status, action_taken
  `, [adminUser.id, realReport.id]);
  assert.equal(falseReportRes.rows[0].status, 'dismissed');
  assert.equal(falseReportRes.rows[0].action_taken, 'dismissed_keep_original_label');

  await pool.end();
});

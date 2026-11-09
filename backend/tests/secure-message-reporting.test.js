import test from 'node:test';
import assert from 'node:assert/strict';
import { maskSensitiveData, hasSensitiveData } from '../src/utils/privacyMask.js';
import { createReportRepository } from '../src/repositories/reportRepository.js';

test('PII Masking: masks phone numbers in various formats while keeping context', () => {
  const text1 = 'Liên hệ với tôi qua số 0912345678 để giải quyết nhé';
  const masked1 = maskSensitiveData(text1);
  assert.ok(!masked1.includes('0912345678'), 'Không được để lộ số điện thoại gốc');
  assert.ok(masked1.includes('091****78'), 'Số điện thoại phải được che dấu sao ở giữa');
  assert.ok(masked1.includes('Liên hệ với tôi qua số'), 'Phần ngữ cảnh thông thường phải giữ nguyên');

  const text2 = 'Gọi số +84987654321 hoặc 038.999.8888 ngay';
  const masked2 = maskSensitiveData(text2);
  assert.ok(!masked2.includes('987654321'));
  assert.ok(!masked2.includes('999.8888'));
  assert.ok(hasSensitiveData(text2), 'hasSensitiveData phải phát hiện có SĐT');
});

test('PII Masking: masks email addresses cleanly', () => {
  const text = 'Gửi tài liệu nhạy cảm vào email phamconduc@gmail.com ngay đi';
  const masked = maskSensitiveData(text);
  assert.ok(!masked.includes('phamconduc@gmail.com'), 'Email gốc không được xuất hiện');
  assert.ok(masked.includes('ph***@gmail.com'), 'Email phải được che bằng ***');
  assert.ok(hasSensitiveData(text), 'hasSensitiveData phải trả về true');
});

test('PII Masking: masks bank credit card and CCCD numbers', () => {
  const text = 'Số thẻ của tao là 9704 1234 5678 9999, cccd 001099123456';
  const masked = maskSensitiveData(text);
  assert.ok(!masked.includes('9704 1234 5678 9999'));
  assert.ok(masked.includes('****-****-****-9999'));
  assert.ok(!masked.includes('001099123456'));
  assert.ok(masked.includes('0010****56'));
});

test('Secure Message Report: createReport automatically redacts PII and predicts AI label', async () => {
  const repo = createReportRepository({ pool: null });

  const rawMessage = 'Mày chuyển tiền vào tài khoản thẻ 9704 1234 5678 8888 hoặc gọi 0987654321 tao sẽ đập chết mày';
  const result = await repo.createReport({
    reporterId: 'reporter-uuid-1',
    reporter: { id: 'reporter-uuid-1', name: 'Người báo cáo' },
    targetType: 'message',
    targetId: 'msg-501',
    targetAuthor: { name: 'Người gửi đe dọa' },
    contentExcerpt: rawMessage,
    reason: 'violence',
    reasonLabel: 'Bạo lực / Đe dọa',
    details: 'Đe dọa tống tiền qua tin nhắn riêng',
    targetModality: 'text'
  });

  const rep = result.data;
  assert.equal(rep.targetType, 'message');
  assert.ok(!rep.contentExcerpt.includes('0987654321'), 'Excerpt không được chứa số điện thoại thật');
  assert.ok(!rep.contentExcerpt.includes('9704 1234 5678 8888'), 'Excerpt không được chứa số thẻ');
  assert.ok(rep.contentExcerpt.includes('tao sẽ đập chết mày'), 'Nội dung vi phạm được bảo toàn để kiểm duyệt');
  assert.equal(rep.aiStatus.label, 'Violence', 'AI phải tự động nhận diện vi phạm bạo lực trong tin nhắn');
});

test('Secure Message Report: updateReportStatus recalls violating message and penalizes author', async () => {
  const executedQueries = [];
  const mockPool = {
    async query(sql, params) {
      executedQueries.push({ sql, params });

      // SELECT sender_id AS author_id FROM messages WHERE id = $1
      if (/SELECT sender_id AS author_id FROM messages/i.test(sql)) {
        return { rows: [{ author_id: 'bad-sender-uuid' }] };
      }

      // UPDATE reports RETURNING *
      if (/UPDATE reports[\s\S]*SET status = \$1/i.test(sql)) {
        return {
          rows: [{
            id: 1,
            target_type: 'message',
            target_id: 105,
            status: params[0],
            admin_notes: params[1],
            action_taken: params[2],
            reporter_id: 'reporter-uuid'
          }]
        };
      }

      // UPDATE users SET trust_score
      if (/UPDATE users[\s\S]*trust_score/i.test(sql)) {
        return { rows: [{ id: 'bad-sender-uuid', trust_score: 65, status: 'cooldown' }] };
      }

      return { rows: [] };
    }
  };

  const repo = createReportRepository({ pool: mockPool });

  const resolution = await repo.updateReportStatus({
    id: 1,
    status: 'resolved_violation',
    adminNotes: 'Xác nhận tin nhắn đe dọa bạo lực, thu hồi tin nhắn và phạt tài khoản',
    newLabel: 'Violence',
    oldLabel: 'Normal',
    reviewerId: 'moderator-uuid',
    rawText: 'Nội dung bạo lực đã được che thông tin cá nhân'
  });

  assert.equal(resolution.report.status, 'resolved_violation');

  // Kiểm tra lệnh thu hồi tin nhắn trong DB (UPDATE messages SET is_recalled = TRUE)
  const recallQuery = executedQueries.find(q => /UPDATE messages[\s\S]*is_recalled\s*=\s*TRUE/i.test(q.sql));
  assert.ok(recallQuery, 'Hệ thống phải phát lệnh thu hồi tin nhắn vi phạm trong bảng messages');

  // Kiểm tra lệnh phạt điểm uy tín
  const penaltyQuery = executedQueries.find(q => /UPDATE users[\s\S]*trust_score/i.test(q.sql));
  assert.ok(penaltyQuery, 'Hệ thống phải trừ điểm uy tín của tác giả gửi tin nhắn');
});

test('Secure Message Report: dismissing report applies no penalty and does not recall message', async () => {
  const executedQueries = [];
  const mockPool = {
    async query(sql, params) {
      executedQueries.push({ sql, params });
      if (/SELECT sender_id AS author_id FROM messages/i.test(sql)) {
        return { rows: [{ author_id: 'sender-uuid' }] };
      }
      if (/UPDATE reports[\s\S]*SET status = \$1/i.test(sql)) {
        return {
          rows: [{
            id: 2,
            target_type: 'message',
            target_id: 106,
            status: params[0],
            admin_notes: params[1],
            action_taken: params[2],
            reporter_id: 'reporter-uuid'
          }]
        };
      }
      return { rows: [] };
    }
  };

  const repo = createReportRepository({ pool: mockPool });

  const resolution = await repo.updateReportStatus({
    id: 2,
    status: 'dismissed',
    adminNotes: 'Trò chuyện bạn bè bình thường, không vi phạm',
    newLabel: 'Normal',
    oldLabel: 'Normal',
    reviewerId: 'moderator-uuid'
  });

  assert.equal(resolution.report.status, 'dismissed');

  // Xác nhận không có truy vấn nào thu hồi tin nhắn hoặc trừ điểm
  const recallQuery = executedQueries.find(q => /UPDATE messages[\s\S]*is_recalled\s*=\s*TRUE/i.test(q.sql));
  assert.equal(recallQuery, undefined, 'Báo cáo sai không được thu hồi tin nhắn');

  const penaltyQuery = executedQueries.find(q => /UPDATE users[\s\S]*trust_score/i.test(q.sql));
  assert.equal(penaltyQuery, undefined, 'Báo cáo sai không được trừ điểm người gửi');
});


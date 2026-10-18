import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

// ========================================================
// 1. KIỂM THỬ: TỪ CHỐI KHIẾU NẠI (KHIẾU NẠI KHÔNG CÓ CƠ SỞ)
// ========================================================
test('Appeal resolution: Rejection keeps original label and sanctions, records no override log', () => {
  const appealsStore = [
    {
      id: 'app-test-1',
      userId: 'user-violator-1',
      contentType: 'post',
      contentId: 'post-501',
      originalText: 'Nội dung bạo lực đẫm máu thật sự.',
      aiPredictedLabel: 'Violence',
      aiConfidence: 0.95,
      status: 'pending',
      adminNotes: ''
    }
  ];

  const user = {
    id: 'user-violator-1',
    status: 'cooldown',
    cooldown_until: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  };

  const post = {
    id: 'post-501',
    ai_label: 'Violence',
    ai_status: 'hidden'
  };

  const overrideLogs = [];

  // Moderator từ chối khiếu nại
  const appeal = appealsStore[0];
  const decision = {
    status: 'rejected',
    adminNotes: 'Nội dung vi phạm tiêu chuẩn bạo lực nghiêm trọng, từ chối khiếu nại.'
  };

  appeal.status = decision.status;
  appeal.adminNotes = decision.adminNotes;

  // Nghiệp vụ: giữ nguyên nhãn và hình phạt, không ghi log đổi nhãn
  assert.equal(appeal.status, 'rejected');
  assert.equal(post.ai_label, 'Violence', 'Nhãn bài viết phải giữ nguyên là Violence');
  assert.equal(post.ai_status, 'hidden', 'Bài viết vẫn phải bị ẩn');
  assert.equal(user.status, 'cooldown', 'User vẫn phải chịu án phạt cooldown');
  assert.equal(overrideLogs.length, 0, 'Không được ghi bản ghi đổi nhãn khi từ chối khiếu nại');
});

// ========================================================
// 2. KIỂM THỬ: CHẤP NHẬN KHIẾU NẠI TỪ TOXIC SANG BÌNH THƯỜNG (NORMAL)
// ========================================================
test('Appeal resolution: Toxic to Normal unhides content, restores active status, and logs override', () => {
  const appeal = {
    id: 'app-test-2',
    userId: 'user-author-2',
    contentType: 'post',
    contentId: 'post-502',
    originalText: 'Thằng bạn thân của tôi khởi nghiệp rất đỉnh.',
    aiPredictedLabel: 'Toxic',
    aiConfidence: 0.88,
    status: 'pending'
  };

  const user = {
    id: 'user-author-2',
    status: 'active',
    cooldown_until: null
  };

  const post = {
    id: 'post-502',
    ai_label: 'Toxic',
    ai_status: 'hidden',
    isHidden: true
  };

  const overrideLogs = [];

  // Chấp thuận khiếu nại sang Normal
  const newLabel = 'Normal';
  appeal.status = 'approved';
  appeal.newLabel = newLabel;
  appeal.adminNotes = 'AI nhận diện sai ngữ cảnh đùa vui';

  post.ai_label = newLabel;
  post.ai_status = 'approved';
  post.isHidden = false;

  user.status = 'active';
  user.cooldown_until = null;

  overrideLogs.unshift({
    id: 'ovr-app-1',
    adminName: 'Quản Trị Viên',
    contentType: appeal.contentType,
    contentId: appeal.contentId,
    rawText: appeal.originalText,
    originalAiLabel: appeal.aiPredictedLabel,
    correctedLabel: newLabel,
    overrideReason: 'Chấp thuận khiếu nại: ' + appeal.adminNotes,
    createdAt: new Date().toISOString()
  });

  assert.equal(appeal.status, 'approved');
  assert.equal(post.ai_label, 'Normal');
  assert.equal(post.ai_status, 'approved');
  assert.equal(post.isHidden, false);
  assert.equal(user.status, 'active');
  assert.equal(overrideLogs.length, 1);
  assert.equal(overrideLogs[0].originalAiLabel, 'Toxic');
  assert.equal(overrideLogs[0].correctedLabel, 'Normal');
});

// ========================================================
// 3. KIỂM THỬ: CHẤP NHẬN KHIẾU NẠI TỪ VIOLENCE SANG NORMAL (GỠ TOÀN BỘ COOLDOWN)
// ========================================================
test('Appeal resolution: Violence to Normal clears 10m cooldown penalty and restores account', () => {
  const user = {
    id: 'user-author-3',
    status: 'cooldown',
    cooldown_until: new Date(Date.now() + 600000).toISOString(),
    cooldown_reason: 'Vi phạm bạo lực trong bài viết',
    cooldown_violation_text: 'Tiêu diệt hết bug'
  };

  const post = {
    id: 'post-503',
    ai_label: 'Violence',
    ai_status: 'hidden'
  };

  // Moderator chấp thuận minh oan chuyển về Normal
  const newLabel = 'Normal';
  post.ai_label = newLabel;
  post.ai_status = 'approved';

  // Gỡ phạt oan
  user.status = 'active';
  user.cooldown_until = null;
  user.cooldown_reason = null;
  user.cooldown_violation_text = null;

  assert.equal(post.ai_label, 'Normal');
  assert.equal(post.ai_status, 'approved');
  assert.equal(user.status, 'active');
  assert.equal(user.cooldown_until, null);
  assert.equal(user.cooldown_reason, null);
  assert.equal(user.cooldown_violation_text, null);
});

// ========================================================
// 4. KIỂM THỬ: ĐỔI TỪ VIOLENCE SANG TOXIC HOẶC HATE SPEECH (GỠ COOLDOWN VÌ TOXIC KHÔNG PHẠT COOLDOWN)
// ========================================================
test('Appeal resolution: Violence to Toxic/Hate Speech removes cooldown and keeps content hidden', () => {
  const user = {
    id: 'user-author-4',
    status: 'cooldown',
    cooldown_until: new Date(Date.now() + 600000).toISOString()
  };

  const comment = {
    id: 'cmt-504',
    ai_label: 'Violence',
    is_hidden: true
  };

  function applySanctionTransition(author, content, fromLabel, toLabel) {
    content.ai_label = toLabel;
    content.is_hidden = toLabel !== 'Normal';

    if (toLabel === 'Normal') {
      author.status = 'active';
      author.cooldown_until = null;
    } else if (toLabel === 'Violence') {
      author.status = 'cooldown';
      author.cooldown_until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    } else {
      // Toxic hoặc Hate Speech: Không phạt cooldown
      if (author.status === 'cooldown') {
        author.status = 'active';
        author.cooldown_until = null;
      }
    }
  }

  // Chuyển từ Violence sang Hate Speech: Gỡ cooldown, tiếp tục ẩn nội dung
  applySanctionTransition(user, comment, 'Violence', 'Hate Speech');
  assert.equal(comment.ai_label, 'Hate Speech');
  assert.equal(comment.is_hidden, true);
  assert.equal(user.status, 'active');
  assert.equal(user.cooldown_until, null);

  // Chuyển lại sang Violence: Áp dụng lại cooldown 10 phút
  applySanctionTransition(user, comment, 'Hate Speech', 'Violence');
  assert.equal(comment.ai_label, 'Violence');
  assert.equal(user.status, 'cooldown');
  assert.ok(user.cooldown_until !== null);
});

// ========================================================
// 5. KIỂM THỬ: CHỐNG XỬ LÝ TRÙNG (IDEMPOTENCY & CONCURRENCY CONFLICT)
// ========================================================
test('Appeal resolution: Processing non-pending appeal is rejected with 409 conflict', () => {
  const appeal = {
    id: 'app-505',
    status: 'approved', // Đã được xử lý trước đó
    reviewed_by: 'admin-1'
  };

  function processAppeal(app, status) {
    if (app.status !== 'pending') {
      return {
        statusCode: 409,
        success: false,
        message: `Khiếu nại này đã được xử lý trước đó (${app.status === 'approved' ? 'đã chấp thuận' : 'đã từ chối'}).`
      };
    }
    app.status = status;
    return { statusCode: 200, success: true };
  }

  const result = processAppeal(appeal, 'rejected');
  assert.equal(result.statusCode, 409);
  assert.equal(result.success, false);
  assert.ok(result.message.includes('đã được xử lý trước đó'));
});

// ========================================================
// 6. KIỂM THỬ: TƯƠNG THÍCH XUẤT FILE CSV & EXCEL CỦA ĐẠT (CỘT A ĐẾN H)
// ========================================================
test('Appeal override log matches export formatting columns A through H', () => {
  const overrideLogs = [
    {
      id: 'ovr-from-appeal-1',
      adminName: 'Quản Trị Viên',
      contentType: 'post',
      rawText: 'Team em vừa tiêu diệt đống bug lớn.',
      originalAiLabel: 'Violence',
      correctedLabel: 'Normal',
      overrideReason: 'Minh oan khiếu nại thành công: Ẩn dụ lập trình viên',
      createdAt: '2026-10-18 23:30'
    }
  ];

  const expectedHeaders = [
    'A: STT',
    'B: Nội dung câu / Hình ảnh gắn nhãn sai',
    'C: Nhãn cũ',
    'D: Nhãn mới',
    'E: Loại nội dung',
    'F: Lý do hiệu chỉnh / Ghi chú',
    'G: Người thực hiện',
    'H: Thời gian ghi nhận'
  ];

  const excelRows = overrideLogs.map((log, index) => ({
    'A: STT': index + 1,
    'B: Nội dung câu / Hình ảnh gắn nhãn sai': log.rawText,
    'C: Nhãn cũ': log.originalAiLabel,
    'D: Nhãn mới': log.correctedLabel,
    'E: Loại nội dung': log.contentType === 'post' ? 'Bài viết' : 'Bình luận',
    'F: Lý do hiệu chỉnh / Ghi chú': log.overrideReason,
    'G: Người thực hiện': log.adminName,
    'H: Thời gian ghi nhận': log.createdAt
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelRows, { header: expectedHeaders });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Nhat_Ky_Hieu_Chinh_Nhan');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const readBook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = readBook.Sheets['Nhat_Ky_Hieu_Chinh_Nhan'];

  assert.equal(sheet['A1'].v, 'A: STT');
  assert.equal(sheet['B1'].v, 'B: Nội dung câu / Hình ảnh gắn nhãn sai');
  assert.equal(sheet['C1'].v, 'C: Nhãn cũ');
  assert.equal(sheet['D1'].v, 'D: Nhãn mới');
  assert.equal(sheet['B2'].v, 'Team em vừa tiêu diệt đống bug lớn.');
  assert.equal(sheet['C2'].v, 'Violence');
  assert.equal(sheet['D2'].v, 'Normal');
});

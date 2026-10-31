import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

test('Report resolution: False report keeps original label and does not override', () => {
  const reportsStore = [
    {
      id: 'rep-test-1',
      targetType: 'post',
      targetId: 'post-100',
      contentExcerpt: 'Một câu nói bình thường không vi phạm.',
      aiStatus: { label: 'Normal', confidence: 0.99 },
      status: 'pending'
    }
  ];

  const report = reportsStore[0];
  const resolution = {
    status: 'dismissed',
    adminNotes: 'Báo cáo không có căn cứ. Nội dung hợp lệ.'
  };

  // Áp dụng logic xử lý báo cáo sai
  report.status = resolution.status;
  report.adminNotes = resolution.adminNotes;
  report.actionTaken = 'dismissed_keep_original_label';

  assert.equal(report.status, 'dismissed');
  assert.equal(report.aiStatus.label, 'Normal', 'Nhãn cũ phải được giữ nguyên là Normal');
  assert.equal(report.actionTaken, 'dismissed_keep_original_label');
});

test('Report resolution: True report reassigns label (Toxic, Hate Speech, Violence) and creates override log', () => {
  const reportsStore = [
    {
      id: 'rep-test-2',
      targetType: 'post',
      targetId: 'post-101',
      contentExcerpt: 'Câu nói chứa từ ngữ thù ghét gay gắt.',
      aiStatus: { label: 'Normal', confidence: 0.60 },
      status: 'pending'
    }
  ];
  const overrideLogs = [];

  const report = reportsStore[0];
  const newLabel = 'Hate Speech';
  const oldLabel = report.aiStatus.label;

  // Áp dụng logic xử lý báo cáo đúng
  report.status = 'resolved_violation';
  report.newLabel = newLabel;
  report.oldLabel = oldLabel;
  report.actionTaken = 'relabel_and_hide';

  const newLog = {
    id: 'ovr-test-1',
    adminName: 'Admin Moderator',
    contentType: report.targetType,
    contentId: report.targetId,
    rawText: report.contentExcerpt,
    originalAiLabel: oldLabel,
    correctedLabel: newLabel,
    overrideReason: 'Xác nhận vi phạm thù ghét: Gán lại nhãn Hate Speech',
    createdAt: new Date().toISOString()
  };
  overrideLogs.unshift(newLog);

  assert.equal(report.status, 'resolved_violation');
  assert.equal(report.newLabel, 'Hate Speech');
  assert.equal(overrideLogs.length, 1);
  assert.equal(overrideLogs[0].originalAiLabel, 'Normal');
  assert.equal(overrideLogs[0].correctedLabel, 'Hate Speech');
  assert.equal(overrideLogs[0].rawText, 'Câu nói chứa từ ngữ thù ghét gay gắt.');
});

test('CSV & Excel Export formatting: builds valid files with columns A through H', () => {
  const overrideLogs = [
    {
      rawText: 'Mày là đồ rác rưởi ngu ngốc',
      originalAiLabel: 'Normal',
      correctedLabel: 'Toxic',
      contentType: 'comment',
      overrideReason: 'Người dùng báo cáo độc hại chính xác',
      adminName: 'Quản Trị Viên',
      createdAt: '2026-10-18 20:30'
    },
    {
      imageUrl: 'https://res.cloudinary.com/demo/violence.jpg',
      originalAiLabel: 'Safe',
      correctedLabel: 'Violence',
      contentType: 'post',
      overrideReason: 'Hình ảnh bạo lực đẫm máu',
      adminName: 'Quản Trị Viên',
      createdAt: '2026-10-18 20:35'
    }
  ];

  // 1. Kiểm tra định dạng CSV chuẩn cột A -> H
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

  let csvContent = '\uFEFF"' + expectedHeaders.join('","') + '"\n';
  overrideLogs.forEach((log, index) => {
    const stt = index + 1;
    const content = String(log.rawText || log.imageUrl || '').replace(/"/g, '""');
    const oldLabel = String(log.originalAiLabel || 'Normal').replace(/"/g, '""');
    const newLabel = String(log.correctedLabel || 'Normal').replace(/"/g, '""');
    const type = (log.contentType === 'post' ? 'Bài viết' : 'Bình luận').replace(/"/g, '""');
    const reason = String(log.overrideReason || '').replace(/"/g, '""');
    const admin = String(log.adminName || 'Admin').replace(/"/g, '""');
    const time = String(log.createdAt || '').replace(/"/g, '""');
    csvContent += `"${stt}","${content}","${oldLabel}","${newLabel}","${type}","${reason}","${admin}","${time}"\n`;
  });

  assert.ok(csvContent.startsWith('\uFEFF'), 'File CSV phải bắt đầu bằng UTF-8 BOM');
  assert.ok(csvContent.includes('"A: STT","B: Nội dung câu / Hình ảnh gắn nhãn sai"'), 'Phải chứa các cột A, B tiêu đề chuẩn');
  assert.ok(csvContent.includes('"G: Người thực hiện","H: Thời gian ghi nhận"'), 'Phải chứa các cột G, H tiêu đề chuẩn');
  assert.ok(csvContent.includes('"1","Mày là đồ rác rưởi ngu ngốc","Normal","Toxic"'), 'Dòng 1 phải có STT 1 và đúng nhãn cũ/mới');

  // 2. Kiểm tra xuất file Excel (.xlsx) với SheetJS
  const excelData = overrideLogs.map((log, index) => ({
    'A: STT': index + 1,
    'B: Nội dung câu / Hình ảnh gắn nhãn sai': log.rawText || log.imageUrl,
    'C: Nhãn cũ': log.originalAiLabel,
    'D: Nhãn mới': log.correctedLabel,
    'E: Loại nội dung': log.contentType === 'post' ? 'Bài viết' : 'Bình luận',
    'F: Lý do hiệu chỉnh / Ghi chú': log.overrideReason,
    'G: Người thực hiện': log.adminName,
    'H: Thời gian ghi nhận': log.createdAt
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData, { header: expectedHeaders });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Nhat_Ky_Hieu_Chinh_Nhan');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  assert.ok(Buffer.isBuffer(buffer), 'Phải tạo thành công buffer Excel binary');
  assert.ok(buffer.length > 1000, 'Kích thước file Excel phải hợp lệ (> 1KB)');

  // Đọc lại workbook từ buffer để xác nhận cấu trúc sheet và cột A -> H
  const readWorkbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = readWorkbook.Sheets['Nhat_Ky_Hieu_Chinh_Nhan'];
  assert.ok(sheet, 'Workbook phải chứa sheet Nhat_Ky_Hieu_Chinh_Nhan');
  assert.equal(sheet['A1'].v, 'A: STT');
  assert.equal(sheet['B1'].v, 'B: Nội dung câu / Hình ảnh gắn nhãn sai');
  assert.equal(sheet['C1'].v, 'C: Nhãn cũ');
  assert.equal(sheet['D1'].v, 'D: Nhãn mới');
  assert.equal(sheet['E1'].v, 'E: Loại nội dung');
  assert.equal(sheet['F1'].v, 'F: Lý do hiệu chỉnh / Ghi chú');
  assert.equal(sheet['G1'].v, 'G: Người thực hiện');
  assert.equal(sheet['H1'].v, 'H: Thời gian ghi nhận');
  assert.equal(sheet['A2'].v, 1);
  assert.equal(sheet['B2'].v, 'Mày là đồ rác rưởi ngu ngốc');
});

test('Business rules per label: Transition to Normal clears all author sanctions and unhides content', () => {
  const user = {
    id: 'user-violence-penalized',
    status: 'cooldown',
    cooldown_until: new Date(Date.now() + 600000).toISOString(),
    cooldown_reason: 'Vi phạm bạo lực trong bài viết',
    cooldown_violation_text: 'Bắn chết hết đi'
  };

  const post = {
    id: 'post-105',
    author_id: user.id,
    ai_label: 'Violence',
    ai_status: 'hidden',
    isHidden: true
  };

  // Moderator xác định đây là hiểu lầm / chuyển về nhãn Normal
  const newLabel = 'Normal';

  if (newLabel === 'Normal') {
    post.ai_label = 'Normal';
    post.ai_status = 'approved';
    post.isHidden = false;

    // Gỡ toàn bộ án phạt cho tác giả
    user.status = 'active';
    user.cooldown_until = null;
    user.cooldown_reason = null;
    user.cooldown_violation_text = null;
  }

  assert.equal(post.ai_label, 'Normal');
  assert.equal(post.ai_status, 'approved');
  assert.equal(post.isHidden, false);
  assert.equal(user.status, 'active', 'User status phải khôi phục về active');
  assert.equal(user.cooldown_until, null, 'cooldown_until phải là null');
  assert.equal(user.cooldown_reason, null, 'cooldown_reason phải là null');
  assert.equal(user.cooldown_violation_text, null, 'cooldown_violation_text phải là null');
});

test('Business rules per label: Violence applies 10-minute cooldown; Hate Speech and Toxic do not apply cooldown', () => {
  const user = {
    id: 'author-test-2',
    status: 'active',
    cooldown_until: null
  };

  function applySanctionForLabel(author, label) {
    if (label === 'Violence') {
      author.status = 'cooldown';
      author.cooldown_until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    } else {
      // Toxic hoặc Hate Speech hoặc Normal: Không có án phạt cooldown
      if (author.status === 'cooldown') {
        author.status = 'active';
        author.cooldown_until = null;
      }
    }
  }

  // 1. Gán Violence -> Phạt cooldown 10 phút
  applySanctionForLabel(user, 'Violence');
  assert.equal(user.status, 'cooldown');
  assert.ok(user.cooldown_until !== null);

  // 2. Chuyển từ Violence sang Hate Speech -> Gỡ cooldown vì Hate Speech không phạt cooldown
  applySanctionForLabel(user, 'Hate Speech');
  assert.equal(user.status, 'active');
  assert.equal(user.cooldown_until, null);

  // 3. Gán Violence lại -> Phạt cooldown
  applySanctionForLabel(user, 'Violence');
  assert.equal(user.status, 'cooldown');

  // 4. Chuyển sang Normal -> Gỡ toàn bộ án phạt
  applySanctionForLabel(user, 'Normal');
  assert.equal(user.status, 'active');
  assert.equal(user.cooldown_until, null);
});
test('Multimodal report moderation: Rule 1 - blocking true report when no labels are changed', () => {
  const initialText = 'Normal';
  const initialImage = 'Clean';
  const hasImage = true;

  function validateResolution(decision, selectedText, selectedImage) {
    const isTextChanged = selectedText !== initialText;
    const isImageChanged = hasImage ? (selectedImage !== initialImage) : false;
    const isAnyChanged = isTextChanged || isImageChanged;
    if (decision === 'resolved_violation' && !isAnyChanged) {
      return { allowed: false, error: 'Chưa có nhãn nào được thay đổi' };
    }
    return { allowed: true };
  }

  // Cố tình chọn resolved_violation nhưng giữ nguyên cả text lẫn ảnh -> Bị chặn để tránh sai sót
  const noChangeRes = validateResolution('resolved_violation', 'Normal', 'Clean');
  assert.equal(noChangeRes.allowed, false);

  // Đổi text sang Toxic, ảnh giữ nguyên -> Cho phép
  const textChangeRes = validateResolution('resolved_violation', 'Toxic', 'Clean');
  assert.equal(textChangeRes.allowed, true);

  // Text giữ nguyên, đổi ảnh sang NSFW -> Cho phép
  const imageChangeRes = validateResolution('resolved_violation', 'Normal', 'NSFW');
  assert.equal(imageChangeRes.allowed, true);

  // Báo cáo sai (dismissed) giữ nguyên -> Luôn cho phép
  const dismissedRes = validateResolution('dismissed', 'Normal', 'Clean');
  assert.equal(dismissedRes.allowed, true);
});

test('Multimodal report moderation: Rule 2 - record override logs only for changed modality', async () => {
  const { createReportRepository } = await import('../src/repositories/reportRepository.js');
  const mockQueries = [];
  const mockPool = {
    async query(sql, params) {
      mockQueries.push({ sql, params });
      if (/UPDATE reports/i.test(sql)) {
        return {
          rows: [{
            id: 123,
            reporter_id: 'u-rep',
            target_type: 'post',
            target_id: 456,
            reason: 'toxic',
            status: 'resolved_violation',
            admin_notes: 'Xử lý vi phạm văn bản',
            action_taken: 'relabel_and_hide'
          }]
        };
      }
      if (/SELECT author_id FROM posts/i.test(sql)) {
        return { rows: [{ author_id: 'u-author' }] };
      }
      return { rows: [] };
    }
  };

  const repo = createReportRepository({ pool: mockPool });

  // 1. Chỉ đổi nhãn Text: Normal -> Toxic, Ảnh giữ nguyên Clean -> Clean
  mockQueries.length = 0;
  await repo.updateReportStatus({
    id: 123,
    status: 'resolved_violation',
    textAction: { oldLabel: 'Normal', newLabel: 'Toxic', changed: true },
    imageAction: { oldLabel: 'Clean', newLabel: 'Clean', changed: false },
    newLabel: 'Toxic',
    oldLabel: 'Normal',
    newImageLabel: 'Clean',
    oldImageLabel: 'Clean',
    reviewerId: 'admin-mod-1',
    rawText: 'Nội dung xúc phạm'
  });

  const textOverrideInserts = mockQueries.filter(q => /INSERT INTO ai_override_logs/i.test(q.sql));
  assert.equal(textOverrideInserts.length, 1, 'Chỉ được ghi 1 log override cho phần Text');
  assert.equal(textOverrideInserts[0].params[4], 'Normal'); // old
  assert.equal(textOverrideInserts[0].params[6], 'Toxic');  // new

  // 2. Chỉ đổi nhãn Image: Clean -> NSFW, Text giữ nguyên Normal
  mockQueries.length = 0;
  await repo.updateReportStatus({
    id: 123,
    status: 'resolved_violation',
    textAction: { oldLabel: 'Normal', newLabel: 'Normal', changed: false },
    imageAction: { oldLabel: 'Clean', newLabel: 'NSFW', changed: true },
    newLabel: 'Normal',
    oldLabel: 'Normal',
    newImageLabel: 'NSFW',
    oldImageLabel: 'Clean',
    reviewerId: 'admin-mod-1',
    rawText: 'Nội dung bình thường'
  });

  const imageOverrideInserts = mockQueries.filter(q => /INSERT INTO ai_override_logs/i.test(q.sql));
  assert.equal(imageOverrideInserts.length, 1, 'Chỉ được ghi 1 log override cho phần Image');
  assert.equal(imageOverrideInserts[0].params[4], 'Clean'); // old
  assert.equal(imageOverrideInserts[0].params[6], 'NSFW');  // new

  // 3. Đổi cả hai: Text Normal -> Toxic, Image Clean -> Violence
  mockQueries.length = 0;
  await repo.updateReportStatus({
    id: 123,
    status: 'resolved_violation',
    textAction: { oldLabel: 'Normal', newLabel: 'Toxic', changed: true },
    imageAction: { oldLabel: 'Clean', newLabel: 'Violence', changed: true },
    newLabel: 'Toxic',
    oldLabel: 'Normal',
    newImageLabel: 'Violence',
    oldImageLabel: 'Clean',
    reviewerId: 'admin-mod-1',
    rawText: 'Nội dung bạo lực cả text và ảnh'
  });

  const bothOverrideInserts = mockQueries.filter(q => /INSERT INTO ai_override_logs/i.test(q.sql));
  assert.equal(bothOverrideInserts.length, 2, 'Phải ghi đúng 2 logs override khi cả text và ảnh đều thay đổi');
});

test('Multimodal report moderation: Target modality stored and retrieved', async () => {
  const { createReportRepository } = await import('../src/repositories/reportRepository.js');
  const mockQueries = [];
  const mockPool = {
    async query(sql, params) {
      mockQueries.push({ sql, params });
      if (/INSERT INTO reports/i.test(sql)) {
        return {
          rows: [{
            id: 999,
            reporter_id: 'user-1',
            target_type: 'post',
            target_id: 100,
            reason: 'toxic',
            details: 'Chửi bới và đăng ảnh xấu',
            status: 'pending',
            target_modality: params[5] || 'both'
          }]
        };
      }
      return { rows: [] };
    }
  };

  const repo = createReportRepository({ pool: mockPool });
  const result = await repo.createReport({
    reporterId: 'user-1',
    targetType: 'post',
    targetId: 100,
    targetModality: 'image',
    reason: 'toxic',
    details: 'Báo cáo phần ảnh'
  });

  assert.equal(result.fromDb, true);
  assert.equal(result.data.targetModality, 'image');
  assert.equal(mockQueries[0].params[5], 'image');
});

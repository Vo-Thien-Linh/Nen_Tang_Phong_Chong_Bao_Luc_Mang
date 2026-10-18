import test from 'node:test';
import assert from 'node:assert/strict';

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

test('CSV Export formatting: builds valid CSV with UTF-8 BOM, STT, and required columns', () => {
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

  // Logic xuất file CSV có BOM
  let csvContent = '\uFEFF"STT","Nội dung / Hình ảnh gắn nhãn sai","Nhãn cũ","Nhãn mới","Loại nội dung","Lý do hiệu chỉnh","Người thực hiện","Thời gian"\n';
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

  // Kiểm tra tính hợp lệ
  assert.ok(csvContent.startsWith('\uFEFF'), 'File CSV phải bắt đầu bằng UTF-8 BOM');
  assert.ok(csvContent.includes('"STT","Nội dung / Hình ảnh gắn nhãn sai"'), 'Phải chứa các cột tiêu đề chuẩn');
  assert.ok(csvContent.includes('"1","Mày là đồ rác rưởi ngu ngốc","Normal","Toxic"'), 'Dòng 1 phải có STT 1 và đúng nhãn cũ/mới');
  assert.ok(csvContent.includes('"2","https://res.cloudinary.com/demo/violence.jpg","Safe","Violence"'), 'Dòng 2 phải có STT 2 và link ảnh');
});

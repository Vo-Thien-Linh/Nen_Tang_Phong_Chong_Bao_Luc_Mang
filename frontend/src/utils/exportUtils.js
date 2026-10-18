/**
 * Utility hỗ trợ xuất dữ liệu báo cáo & nhật ký hiệu chỉnh nhãn AI
 * Xuất file chuẩn định dạng CSV có UTF-8 BOM (\uFEFF)
 * Tương thích 100% với Microsoft Excel, Google Sheets, LibreOffice trên Windows/Mac
 */

/**
 * Xuất danh sách nhật ký hiệu chỉnh nhãn AI ra file CSV / Excel
 * @param {Array} logs - Danh sách nhật ký nhãn
 * @param {string} customFileName - Tên file tùy chọn
 */
export function exportOverrideLogsToCSV(logs = [], customFileName) {
  if (!Array.isArray(logs) || logs.length === 0) {
    alert('Không có dữ liệu nhật ký hiệu chỉnh nhãn để xuất!');
    return false;
  }

  // Tiêu đề các cột chuẩn theo yêu cầu nghiệp vụ
  const headers = [
    'STT',
    'Nội dung câu / Hình ảnh gắn nhãn sai',
    'Nhãn cũ',
    'Nhãn mới',
    'Loại nội dung',
    'Lý do hiệu chỉnh / Ghi chú',
    'Người thực hiện',
    'Thời gian'
  ];

  // Hàm escape các ký tự đặc biệt trong CSV
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // Dựng các dòng dữ liệu
  const rows = logs.map((log, index) => {
    const stt = index + 1;
    const content = log.rawText || log.imageUrl || log.content || log.contentExcerpt || '(Không có nội dung)';
    const oldLabel = log.originalAiLabel || log.oldLabel || 'Normal';
    const newLabel = log.correctedLabel || log.newLabel || 'Normal';
    
    let typeName = 'Nội dung khác';
    if (log.contentType === 'post') typeName = 'Bài viết';
    else if (log.contentType === 'comment') typeName = 'Bình luận';
    else if (log.contentType === 'message') typeName = 'Tin nhắn';
    else if (log.imageUrl) typeName = 'Hình ảnh';

    const reason = log.overrideReason || log.adminNotes || 'Xử lý báo cáo vi phạm';
    const admin = log.adminName || log.reviewedBy || 'Điều Hành Viên';
    const time = log.createdAt || new Date().toLocaleString('vi-VN');

    return [
      escapeCsv(stt),
      escapeCsv(content),
      escapeCsv(oldLabel),
      escapeCsv(newLabel),
      escapeCsv(typeName),
      escapeCsv(reason),
      escapeCsv(admin),
      escapeCsv(time)
    ].join(',');
  });

  // Ký tự \uFEFF là UTF-8 BOM, bắt buộc để Microsoft Excel hiển thị đúng tiếng Việt có dấu
  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');

  // Tạo Blob và liên kết tải về trực tiếp
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  link.setAttribute('href', url);
  link.setAttribute('download', customFileName || `Danh_sach_hieu_chinh_nhan_AI_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}

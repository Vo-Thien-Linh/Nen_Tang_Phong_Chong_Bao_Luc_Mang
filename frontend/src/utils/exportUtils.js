import * as XLSX from 'xlsx';

/**
 * Utility hỗ trợ xuất dữ liệu báo cáo & nhật ký hiệu chỉnh nhãn AI
 * Định dạng chuẩn theo bảng chữ cái A -> H theo quy định:
 * Cột A: STT
 * Cột B: Nội dung câu / Hình ảnh gắn nhãn sai
 * Cột C: Nhãn cũ
 * Cột D: Nhãn mới
 * Cột E: Loại nội dung
 * Cột F: Lý do hiệu chỉnh / Ghi chú
 * Cột G: Người thực hiện
 * Cột H: Thời gian ghi nhận
 */

// Danh sách tiêu đề cột chuẩn bảng chữ cái A -> H
export const EXCEL_OVERRIDE_COLUMNS = [
  'A: STT',
  'B: Nội dung câu / Hình ảnh gắn nhãn sai',
  'C: Nhãn cũ',
  'D: Nhãn mới',
  'E: Loại nội dung',
  'F: Lý do hiệu chỉnh / Ghi chú',
  'G: Người thực hiện',
  'H: Thời gian ghi nhận'
];

/**
 * Chuyển đổi dữ liệu nhật ký sang mảng đối tượng theo các cột A -> H
 */
export function formatOverrideLogsForExport(logs = []) {
  return logs.map((log, index) => {
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
    const admin = log.adminName || log.reviewedBy || 'Điều Hành Viên Hệ Thống';
    const time = log.createdAt || new Date().toLocaleString('vi-VN');

    return {
      'A: STT': stt,
      'B: Nội dung câu / Hình ảnh gắn nhãn sai': content,
      'C: Nhãn cũ': oldLabel,
      'D: Nhãn mới': newLabel,
      'E: Loại nội dung': typeName,
      'F: Lý do hiệu chỉnh / Ghi chú': reason,
      'G: Người thực hiện': admin,
      'H: Thời gian ghi nhận': time
    };
  });
}

/**
 * Xuất danh sách nhật ký hiệu chỉnh nhãn ra file Microsoft Excel (.xlsx) chuẩn
 * @param {Array} logs - Danh sách nhật ký nhãn
 * @param {string} customFileName - Tên file tùy chọn
 */
export function exportOverrideLogsToExcel(logs = [], customFileName) {
  if (!Array.isArray(logs) || logs.length === 0) {
    alert('Không có dữ liệu nhật ký hiệu chỉnh nhãn để xuất!');
    return false;
  }

  try {
    const dataRows = formatOverrideLogsForExport(logs);
    
    // Tạo workbook và worksheet từ mảng dữ liệu
    const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: EXCEL_OVERRIDE_COLUMNS });

    // Thiết lập độ rộng cột tối ưu cho từng cột A -> H
    worksheet['!cols'] = [
      { wch: 10 }, // A: STT
      { wch: 45 }, // B: Nội dung câu / Hình ảnh gắn nhãn sai
      { wch: 16 }, // C: Nhãn cũ
      { wch: 16 }, // D: Nhãn mới
      { wch: 18 }, // E: Loại nội dung
      { wch: 35 }, // F: Lý do hiệu chỉnh / Ghi chú
      { wch: 24 }, // G: Người thực hiện
      { wch: 22 }  // H: Thời gian ghi nhận
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Nhat_Ky_Hieu_Chinh_Nhan');

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fileName = customFileName || `Danh_sach_hieu_chinh_nhan_AI_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    return true;
  } catch (err) {
    console.error('Lỗi xuất Excel (.xlsx), fallback sang CSV:', err);
    return exportOverrideLogsToCSV(logs, customFileName?.replace('.xlsx', '.csv'));
  }
}

/**
 * Xuất danh sách nhật ký hiệu chỉnh nhãn ra file CSV UTF-8 BOM
 * Tương thích Microsoft Excel với các cột A: STT -> H: Thời gian ghi nhận
 * @param {Array} logs - Danh sách nhật ký nhãn
 * @param {string} customFileName - Tên file tùy chọn
 */
export function exportOverrideLogsToCSV(logs = [], customFileName) {
  if (!Array.isArray(logs) || logs.length === 0) {
    alert('Không có dữ liệu nhật ký hiệu chỉnh nhãn để xuất!');
    return false;
  }

  // Tiêu đề các cột chuẩn theo bảng chữ cái A -> H
  const headers = EXCEL_OVERRIDE_COLUMNS;

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
    const admin = log.adminName || log.reviewedBy || 'Điều Hành Viên Hệ Thống';
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

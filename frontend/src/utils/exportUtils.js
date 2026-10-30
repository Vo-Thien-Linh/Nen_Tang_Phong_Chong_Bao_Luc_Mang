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

export const COLUMN_WIDTH_MAP = {
  'A: STT': 10,
  'B: Nội dung câu / Hình ảnh gắn nhãn sai': 45,
  'C: Nhãn cũ': 16,
  'D: Nhãn mới': 16,
  'E: Loại nội dung': 18,
  'F: Lý do hiệu chỉnh / Ghi chú': 35,
  'G: Người thực hiện': 24,
  'H: Thời gian ghi nhận': 22,
};

/**
 * Chuyển đổi dữ liệu nhật ký sang mảng đối tượng theo các cột A -> H
 * Hỗ trợ chọn lọc cột hiển thị nếu có selectedColumns
 */
export function formatOverrideLogsForExport(logs = [], selectedColumns = null) {
  const activeCols = Array.isArray(selectedColumns) && selectedColumns.length > 0
    ? selectedColumns
    : EXCEL_OVERRIDE_COLUMNS;

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

    const fullRow = {
      'A: STT': stt,
      'B: Nội dung câu / Hình ảnh gắn nhãn sai': content,
      'C: Nhãn cũ': oldLabel,
      'D: Nhãn mới': newLabel,
      'E: Loại nội dung': typeName,
      'F: Lý do hiệu chỉnh / Ghi chú': reason,
      'G: Người thực hiện': admin,
      'H: Thời gian ghi nhận': time
    };

    if (activeCols.length === EXCEL_OVERRIDE_COLUMNS.length) {
      return fullRow;
    }

    const filteredRow = {};
    activeCols.forEach(col => {
      if (fullRow[col] !== undefined) {
        filteredRow[col] = fullRow[col];
      }
    });
    return filteredRow;
  });
}

/**
 * Xuất danh sách nhật ký hiệu chỉnh nhãn ra file Microsoft Excel (.xlsx) chuẩn
 * @param {Array} logs - Danh sách nhật ký nhãn
 * @param {string} customFileName - Tên file tùy chọn
 * @param {Array} selectedColumns - Mảng các cột được chọn (tùy chọn)
 */
export function exportOverrideLogsToExcel(logs = [], customFileName, selectedColumns = null) {
  if (!Array.isArray(logs) || logs.length === 0) {
    alert('Không có dữ liệu nhật ký hiệu chỉnh nhãn để xuất!');
    return false;
  }

  const activeCols = Array.isArray(selectedColumns) && selectedColumns.length > 0
    ? selectedColumns
    : EXCEL_OVERRIDE_COLUMNS;

  try {
    const dataRows = formatOverrideLogsForExport(logs, activeCols);
    
    // Tạo workbook và worksheet từ mảng dữ liệu
    const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: activeCols });

    // Thiết lập độ rộng cột tối ưu cho các cột được chọn
    worksheet['!cols'] = activeCols.map(col => ({ wch: COLUMN_WIDTH_MAP[col] || 20 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Nhat_Ky_Hieu_Chinh_Nhan');

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fileName = customFileName || `Danh_sach_hieu_chinh_nhan_AI_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    return true;
  } catch (err) {
    console.error('Lỗi xuất Excel (.xlsx), fallback sang CSV:', err);
    return exportOverrideLogsToCSV(logs, customFileName?.replace('.xlsx', '.csv'), selectedColumns);
  }
}

/**
 * Xuất danh sách nhật ký hiệu chỉnh nhãn ra file CSV UTF-8 BOM
 * Tương thích Microsoft Excel với các cột A: STT -> H: Thời gian ghi nhận
 * @param {Array} logs - Danh sách nhật ký nhãn
 * @param {string} customFileName - Tên file tùy chọn
 * @param {Array} selectedColumns - Mảng các cột được chọn (tùy chọn)
 */
export function exportOverrideLogsToCSV(logs = [], customFileName, selectedColumns = null) {
  if (!Array.isArray(logs) || logs.length === 0) {
    alert('Không có dữ liệu nhật ký hiệu chỉnh nhãn để xuất!');
    return false;
  }

  // Tiêu đề các cột được chọn
  const headers = Array.isArray(selectedColumns) && selectedColumns.length > 0
    ? selectedColumns
    : EXCEL_OVERRIDE_COLUMNS;

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

    const fullRowMap = {
      'A: STT': stt,
      'B: Nội dung câu / Hình ảnh gắn nhãn sai': content,
      'C: Nhãn cũ': oldLabel,
      'D: Nhãn mới': newLabel,
      'E: Loại nội dung': typeName,
      'F: Lý do hiệu chỉnh / Ghi chú': reason,
      'G: Người thực hiện': admin,
      'H: Thời gian ghi nhận': time
    };

    return headers.map(col => escapeCsv(fullRowMap[col])).join(',');
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

// -------------------------------------------------------------
// Xuất danh sách Báo cáo vi phạm (Reports)
// -------------------------------------------------------------
export const EXCEL_REPORT_COLUMNS = [
  'A: Mã báo cáo',
  'B: Người báo cáo',
  'C: Tác giả bị báo cáo',
  'D: Loại nội dung',
  'E: Trích dẫn nội dung vi phạm',
  'F: Lý do báo cáo',
  'G: Trạng thái xử lý',
  'H: Ghi chú của Admin',
  'I: Thời gian gửi'
];

export function formatReportsForExport(reports = []) {
  return reports.map(rep => ({
    'A: Mã báo cáo': rep.id,
    'B: Người báo cáo': rep.reporter?.name || 'Người dùng',
    'C: Tác giả bị báo cáo': rep.targetAuthor?.name || rep.targetAuthor?.username || 'Chưa xác định',
    'D: Loại nội dung': rep.targetType === 'post' ? 'Bài viết' : rep.targetType === 'comment' ? 'Bình luận' : 'Tin nhắn',
    'E: Trích dẫn nội dung vi phạm': rep.contentExcerpt || rep.targetExcerpt || rep.details || '(Không có nội dung)',
    'F: Lý do báo cáo': rep.reasonLabel || rep.reason || 'Khác',
    'G: Trạng thái xử lý': rep.status === 'resolved_violation' ? 'Đã duyệt vi phạm' : rep.status === 'dismissed' ? 'Đã bác bỏ' : 'Chờ xử lý',
    'H: Ghi chú của Admin': rep.adminNotes || '',
    'I: Thời gian gửi': rep.createdAt || ''
  }));
}

export function exportReportsToExcel(reports = [], customFileName) {
  if (!Array.isArray(reports) || reports.length === 0) {
    alert('Không có dữ liệu báo cáo để xuất!');
    return false;
  }

  try {
    const dataRows = formatReportsForExport(reports);
    const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: EXCEL_REPORT_COLUMNS });
    worksheet['!cols'] = [
      { wch: 15 }, { wch: 20 }, { wch: 22 }, { wch: 15 }, { wch: 40 },
      { wch: 22 }, { wch: 18 }, { wch: 30 }, { wch: 20 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bao_Cao_Vi_Pham');

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fileName = customFileName || `Danh_sach_bao_cao_vi_pham_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    return true;
  } catch (err) {
    console.error('Lỗi xuất Excel báo cáo:', err);
    return false;
  }
}

// -------------------------------------------------------------
// Xuất danh sách Khiếu nại (Appeals)
// -------------------------------------------------------------
export const EXCEL_APPEAL_COLUMNS = [
  'A: Mã khiếu nại',
  'B: Người gửi khiếu nại',
  'C: Loại nội dung',
  'D: Nội dung gốc bị AI phạt',
  'E: Nhãn AI dự đoán',
  'F: Độ tin cậy AI',
  'G: Lý do khiếu nại của tác giả',
  'H: Trạng thái xử lý',
  'I: Ghi chú của Admin',
  'J: Thời gian gửi'
];

export function formatAppealsForExport(appeals = []) {
  return appeals.map(app => ({
    'A: Mã khiếu nại': app.id,
    'B: Người gửi khiếu nại': app.user?.name || app.user?.username || 'Người dùng',
    'C: Loại nội dung': app.contentType === 'post' ? 'Bài viết' : app.contentType === 'comment' ? 'Bình luận' : 'Tin nhắn',
    'D: Nội dung gốc bị AI phạt': app.originalText || '(Không có nội dung)',
    'E: Nhãn AI dự đoán': app.aiPredictedLabel || 'Normal',
    'F: Độ tin cậy AI': app.aiConfidence ? `${(Number(app.aiConfidence) * 100).toFixed(1)}%` : '90%',
    'G: Lý do khiếu nại của tác giả': app.appealReason || '',
    'H: Trạng thái xử lý': app.status === 'approved' ? 'Chấp thuận (Minh oan)' : app.status === 'rejected' ? 'Từ chối' : 'Chờ xử lý',
    'I: Ghi chú của Admin': app.adminNotes || '',
    'J: Thời gian gửi': app.createdAt || ''
  }));
}

export function exportAppealsToExcel(appeals = [], customFileName) {
  if (!Array.isArray(appeals) || appeals.length === 0) {
    alert('Không có dữ liệu khiếu nại để xuất!');
    return false;
  }

  try {
    const dataRows = formatAppealsForExport(appeals);
    const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: EXCEL_APPEAL_COLUMNS });
    worksheet['!cols'] = [
      { wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 40 }, { wch: 18 },
      { wch: 15 }, { wch: 35 }, { wch: 22 }, { wch: 30 }, { wch: 20 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Khieu_Nai_Nguoi_Dung');

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fileName = customFileName || `Danh_sach_khieu_nai_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    return true;
  } catch (err) {
    console.error('Lỗi xuất Excel khiếu nại:', err);
    return false;
  }
}

// -------------------------------------------------------------
// Xuất danh sách Ảnh phân vân (Pending Review Images)
// -------------------------------------------------------------
export function exportUncertainItemsToExcel(items = [], customFileName) {
  if (!Array.isArray(items) || items.length === 0) {
    alert('Không có ảnh phân vân nào trong danh sách để xuất!');
    return false;
  }

  try {
    const columns = [
      'STT',
      'Loại nội dung',
      'Tác giả',
      'Nội dung văn bản',
      'URL Hình ảnh phân vân',
      'Nhãn AI dự đoán',
      'Điểm An toàn (Safe)',
      'Điểm Nhạy cảm (NSFW)',
      'Điểm Bạo lực (Violence)',
      'Trạng thái',
      'Thời gian ghi nhận'
    ];

    const dataRows = items.map((item, index) => {
      const scores = item.modelScores || {};
      return {
        'STT': index + 1,
        'Loại nội dung': item.type === 'comment' ? 'Bình luận' : 'Bài viết',
        'Tác giả': item.author?.name || 'Người dùng',
        'Nội dung văn bản': item.text || item.content || '(Không có văn bản)',
        'URL Hình ảnh phân vân': item.imageUrl || '',
        'Nhãn AI dự đoán': item.modelLabel || 'Chưa rõ',
        'Điểm An toàn (Safe)': scores.safe != null ? Number(scores.safe).toFixed(4) : '',
        'Điểm Nhạy cảm (NSFW)': scores.nsfw != null ? Number(scores.nsfw).toFixed(4) : '',
        'Điểm Bạo lực (Violence)': scores.violence != null ? Number(scores.violence).toFixed(4) : '',
        'Trạng thái': 'Phân vân (Pending Review)',
        'Thời gian ghi nhận': item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: columns });
    worksheet['!cols'] = [
      { wch: 8 }, { wch: 15 }, { wch: 22 }, { wch: 35 }, { wch: 45 },
      { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 25 }, { wch: 22 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Anh_Phan_Van_De_Train');

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fileName = customFileName || `Danh_sach_anh_phan_van_retrain_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    return true;
  } catch (err) {
    console.error('Lỗi xuất Excel ảnh phân vân:', err);
    return exportUncertainItemsToCSV(items, customFileName?.replace('.xlsx', '.csv'));
  }
}

export function exportUncertainItemsToCSV(items = [], customFileName) {
  if (!Array.isArray(items) || items.length === 0) {
    alert('Không có ảnh phân vân nào trong danh sách để xuất!');
    return false;
  }

  const headers = [
    'STT',
    'Loại nội dung',
    'Tác giả',
    'Nội dung văn bản',
    'URL Hình ảnh phân vân',
    'Nhãn AI dự đoán',
    'Điểm An toàn (Safe)',
    'Điểm Nhạy cảm (NSFW)',
    'Điểm Bạo lực (Violence)',
    'Trạng thái',
    'Thời gian ghi nhận'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = items.map((item, index) => {
    const scores = item.modelScores || {};
    return [
      escapeCsv(index + 1),
      escapeCsv(item.type === 'comment' ? 'Bình luận' : 'Bài viết'),
      escapeCsv(item.author?.name || 'Người dùng'),
      escapeCsv(item.text || item.content || '(Không có văn bản)'),
      escapeCsv(item.imageUrl || ''),
      escapeCsv(item.modelLabel || 'Chưa rõ'),
      escapeCsv(scores.safe != null ? Number(scores.safe).toFixed(4) : ''),
      escapeCsv(scores.nsfw != null ? Number(scores.nsfw).toFixed(4) : ''),
      escapeCsv(scores.violence != null ? Number(scores.violence).toFixed(4) : ''),
      escapeCsv('Phân vân (Pending Review)'),
      escapeCsv(item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '')
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  link.setAttribute('href', url);
  link.setAttribute('download', customFileName || `Danh_sach_anh_phan_van_retrain_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}

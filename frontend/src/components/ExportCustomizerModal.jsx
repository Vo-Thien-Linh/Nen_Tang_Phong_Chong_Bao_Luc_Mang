import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  Search,
  Filter,
  Check,
  X,
  Trash2,
  RotateCcw,
  Sparkles,
  Download
} from 'lucide-react';
import {
  EXCEL_OVERRIDE_COLUMNS,
  exportOverrideLogsToExcel,
  exportOverrideLogsToCSV,
} from '../utils/exportUtils';

export function ExportCustomizerModal({ isOpen, onClose, logs = [] }) {
  if (!isOpen) return null;

  // 1. Quản lý danh sách logs có thể chỉnh sửa cục bộ (Local Editable State)
  const [editableLogs, setEditableLogs] = useState(() => {
    return logs.map((item, idx) => ({
      ...item,
      _tempId: item.id || `log-${idx}-${Date.now()}`,
      _selected: true, // Mặc định chọn tất cả
    }));
  });

  // 2. Quản lý các cột muốn xuất (Cột A -> H)
  const [selectedColumns, setSelectedColumns] = useState(() => [...EXCEL_OVERRIDE_COLUMNS]);

  // 3. Bộ lọc & tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLabel, setFilterLabel] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // 4. Tên file tùy chỉnh
  const [customFileName, setCustomFileName] = useState('');

  // Lọc danh sách hiển thị theo điều kiện tìm kiếm và bộ lọc
  const filteredLogs = useMemo(() => {
    return editableLogs.filter((item) => {
      // Tìm kiếm từ khóa
      const text = `${item.rawText || item.content || ''} ${item.overrideReason || item.adminNotes || ''} ${item.adminName || ''}`.toLowerCase();
      const matchesSearch = !searchTerm || text.includes(searchTerm.toLowerCase());

      // Lọc theo nhãn (khớp cả nhãn mới và nhãn cũ không phân biệt hoa thường)
      const curLabel = (item.correctedLabel || item.newLabel || '').trim().toLowerCase();
      const oldLabel = (item.originalAiLabel || item.oldLabel || '').trim().toLowerCase();
      const targetLabel = filterLabel.trim().toLowerCase();
      const matchesLabel = targetLabel === 'all' || curLabel === targetLabel || oldLabel === targetLabel;

      // Lọc loại nội dung
      const type = item.contentType || 'post';
      const matchesType = filterType === 'all' || type === filterType;

      return matchesSearch && matchesLabel && matchesType;
    });
  }, [editableLogs, searchTerm, filterLabel, filterType]);

  // Số lượng đang được tích chọn xuất
  const selectedCount = editableLogs.filter((l) => l._selected).length;

  // Xử lý bật/tắt checkbox từng dòng
  const toggleRowSelect = (tempId) => {
    setEditableLogs((prev) =>
      prev.map((item) =>
        item._tempId === tempId ? { ...item, _selected: !item._selected } : item
      )
    );
  };

  // Chọn tất cả / Bỏ chọn tất cả các dòng đang được lọc
  const toggleSelectAllFiltered = (selectAll) => {
    const filteredTempIds = new Set(filteredLogs.map((l) => l._tempId));
    setEditableLogs((prev) =>
      prev.map((item) =>
        filteredTempIds.has(item._tempId) ? { ...item, _selected: selectAll } : item
      )
    );
  };

  // Xóa / Bỏ một dòng khỏi danh sách xuất
  const removeRow = (tempId) => {
    setEditableLogs((prev) => prev.filter((item) => item._tempId !== tempId));
  };

  // Chỉnh sửa trực tiếp một trường của dòng (rawText, correctedLabel, overrideReason)
  const updateRowField = (tempId, field, value) => {
    setEditableLogs((prev) =>
      prev.map((item) =>
        item._tempId === tempId ? { ...item, [field]: value } : item
      )
    );
  };

  // Bật/tắt cột xuất
  const toggleColumn = (colName) => {
    setSelectedColumns((prev) =>
      prev.includes(colName)
        ? prev.length > 1
          ? prev.filter((c) => c !== colName)
          : prev // Giữ ít nhất 1 cột
        : [...prev, colName]
    );
  };

  // Reset về trạng thái ban đầu
  const handleReset = () => {
    setEditableLogs(
      logs.map((item, idx) => ({
        ...item,
        _tempId: item.id || `log-${idx}-${Date.now()}`,
        _selected: true,
      }))
    );
    setSelectedColumns([...EXCEL_OVERRIDE_COLUMNS]);
    setSearchTerm('');
    setFilterLabel('all');
    setFilterType('all');
  };

  // Thực hiện xuất Excel
  const handleExportExcel = () => {
    const logsToExport = editableLogs.filter((l) => l._selected);
    if (logsToExport.length === 0) {
      alert('Vui lòng chọn ít nhất một mục để xuất file!');
      return;
    }
    const fileName = customFileName.trim()
      ? customFileName.endsWith('.xlsx')
        ? customFileName
        : `${customFileName}.xlsx`
      : undefined;

    const ok = exportOverrideLogsToExcel(logsToExport, fileName, selectedColumns);
    if (ok) onClose();
  };

  // Thực hiện xuất CSV
  const handleExportCSV = () => {
    const logsToExport = editableLogs.filter((l) => l._selected);
    if (logsToExport.length === 0) {
      alert('Vui lòng chọn ít nhất một mục để xuất file!');
      return;
    }
    const fileName = customFileName.trim()
      ? customFileName.endsWith('.csv')
        ? customFileName
        : `${customFileName}.csv`
      : undefined;

    const ok = exportOverrideLogsToCSV(logsToExport, fileName, selectedColumns);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Tùy chỉnh Dữ liệu &amp; Xuất File (Excel / CSV)
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {selectedCount} / {editableLogs.length} mục đã chọn
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Lọc bỏ các câu không cần thiết, chọn cột dữ liệu và chỉnh sửa nhanh trước khi tải file.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTROLS SECTION */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          
          {/* 1. CHỌN CỘT DỮ LIỆU */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                Các cột dữ liệu xuất ra (Click để bật/tắt):
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedColumns([...EXCEL_OVERRIDE_COLUMNS])}
                  className="text-[11px] text-emerald-700 hover:underline font-semibold cursor-pointer"
                >
                  Chọn tất cả cột
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Đặt lại mặc định
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXCEL_OVERRIDE_COLUMNS.map((col) => {
                const isSelected = selectedColumns.includes(col);
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => toggleColumn(col)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs font-semibold'
                        : 'bg-white border-slate-200 text-slate-400 line-through hover:border-slate-300 hover:text-slate-600'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full flex items-center justify-center text-[10px]">
                      {isSelected ? '✓' : '✕'}
                    </span>
                    <span>{col}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. TÌM KIẾM & BỘ LỌC DÒNG */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm từ khóa câu văn, lý do, người sửa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <select
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
              className="py-1.5 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 cursor-pointer"
            >
              <option value="all">Tất cả nhãn mới</option>
              <option value="Normal">Normal (An toàn)</option>
              <option value="Toxic">Toxic (Độc hại)</option>
              <option value="Hate Speech">Hate Speech (Thù ghét)</option>
              <option value="Violence">Violence (Bạo lực)</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="py-1.5 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 cursor-pointer"
            >
              <option value="all">Tất cả loại nội dung</option>
              <option value="post">Bài viết</option>
              <option value="comment">Bình luận</option>
              <option value="message">Tin nhắn</option>
            </select>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => toggleSelectAllFiltered(true)}
                className="px-2.5 py-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={() => toggleSelectAllFiltered(false)}
                className="px-2.5 py-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer"
              >
                Bỏ chọn tất cả
              </button>
            </div>
          </div>
        </div>

        {/* 3. BẢNG DỮ LIỆU ĐIỀU CHỈNH & XEM TRƯỚC */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">Không tìm thấy mục nào khớp với bộ lọc</p>
              <p className="text-xs text-slate-400 mt-1">Hãy thử xóa bộ lọc tìm kiếm hoặc nhấn đặt lại.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold sticky top-0">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredLogs.length > 0 && filteredLogs.every((l) => l._selected)}
                        onChange={(e) => toggleSelectAllFiltered(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-2 w-12 text-center">STT</th>
                    <th className="py-2.5 px-3 min-w-[260px]">Nội dung câu / Hình ảnh (Có thể chỉnh sửa)</th>
                    <th className="py-2.5 px-3 w-28">Nhãn cũ</th>
                    <th className="py-2.5 px-3 w-32">Nhãn mới (Điều chỉnh)</th>
                    <th className="py-2.5 px-3 w-24">Loại</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Lý do hiệu chỉnh / Ghi chú</th>
                    <th className="py-2.5 px-3 w-28">Người duyệt</th>
                    <th className="py-2.5 px-2 w-12 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredLogs.map((item, index) => {
                    const isChecked = Boolean(item._selected);
                    return (
                      <tr
                        key={item._tempId}
                        className={`transition ${
                          isChecked ? 'hover:bg-slate-50' : 'bg-slate-50/60 opacity-50'
                        }`}
                      >
                        {/* Checkbox chọn */}
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRowSelect(item._tempId)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>

                        {/* STT */}
                        <td className="py-2.5 px-2 text-center font-medium text-slate-400">
                          {index + 1}
                        </td>

                        {/* Nội dung câu (Inline Edit) */}
                        <td className="py-2.5 px-3">
                          <textarea
                            value={item.rawText || item.content || ''}
                            onChange={(e) => updateRowField(item._tempId, 'rawText', e.target.value)}
                            rows={2}
                            placeholder="Nhập nội dung câu cần gán nhãn..."
                            className="w-full p-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-hidden resize-y font-mono"
                          />
                          {item.imageUrl && (
                            <span className="text-[10px] text-blue-600 block mt-0.5 truncate">
                              [Ảnh: {item.imageUrl}]
                            </span>
                          )}
                        </td>

                        {/* Nhãn cũ */}
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {item.originalAiLabel || item.oldLabel || 'Normal'}
                          </span>
                        </td>

                        {/* Nhãn mới (Dropdown Edit) */}
                        <td className="py-2.5 px-3">
                          <select
                            value={item.correctedLabel || item.newLabel || 'Normal'}
                            onChange={(e) => updateRowField(item._tempId, 'correctedLabel', e.target.value)}
                            className="py-1 px-2 border border-slate-200 rounded text-xs font-semibold bg-white text-slate-800 cursor-pointer focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="Normal">Normal</option>
                            <option value="Toxic">Toxic</option>
                            <option value="Hate Speech">Hate Speech</option>
                            <option value="Violence">Violence</option>
                          </select>
                        </td>

                        {/* Loại nội dung */}
                        <td className="py-2.5 px-3 text-slate-600 font-medium">
                          {item.contentType === 'post'
                            ? 'Bài viết'
                            : item.contentType === 'comment'
                            ? 'Bình luận'
                            : item.contentType === 'message'
                            ? 'Tin nhắn'
                            : 'Hình ảnh'}
                        </td>

                        {/* Lý do hiệu chỉnh (Inline Edit) */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={item.overrideReason || item.adminNotes || ''}
                            onChange={(e) => updateRowField(item._tempId, 'overrideReason', e.target.value)}
                            placeholder="Lý do hiệu chỉnh..."
                            className="w-full px-2 py-1 text-xs text-slate-700 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </td>

                        {/* Người thực hiện */}
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[110px]">
                          {item.adminName || item.reviewedBy || 'Admin'}
                        </td>

                        {/* Nút xóa bỏ khỏi danh sách xuất */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(item._tempId)}
                            title="Bỏ dòng này khỏi danh sách xuất"
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-medium text-slate-600 shrink-0">Tên file xuất:</span>
            <input
              type="text"
              placeholder="Để trống để dùng tên mặc định..."
              value={customFileName}
              onChange={(e) => setCustomFileName(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs w-full sm:w-64 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={selectedCount === 0}
              className="px-3.5 py-2 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Xuất file định dạng CSV UTF-8 BOM"
            >
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>Xuất {selectedCount} mục (CSV)</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={selectedCount === 0}
              className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Xuất file Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất {selectedCount} mục (Excel .xlsx)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}


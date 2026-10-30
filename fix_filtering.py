import io

# 1. FIX ModeratorView.jsx
file_path = r'D:\BTL_Project1\frontend\src\components\ModeratorView.jsx'

with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update React import to include useMemo
old_react_import = "import { useEffect, useState } from 'react';"
if old_react_import in content:
    content = content.replace(old_react_import, "import { useEffect, useState, useMemo } from 'react';", 1)

# Fix appeal label filtering in Tab 2
old_appeal_filter = "if (appealLabelFilter !== 'all' && a.aiPredictedLabel !== appealLabelFilter) return false;"
new_appeal_filter = """if (appealLabelFilter !== 'all') {
      const predLabel = (a.aiPredictedLabel || a.ai_predicted_label || a.newLabel || '').trim().toLowerCase();
      if (predLabel !== appealLabelFilter.trim().toLowerCase()) return false;
    }"""
if '\r\n' in content:
    new_appeal_filter = new_appeal_filter.replace('\n', '\r\n')
if old_appeal_filter in content:
    content = content.replace(old_appeal_filter, new_appeal_filter, 1)

# Add useMemo for filteredOverrides
state_target = "const [overrideLabelFilter, setOverrideLabelFilter] = useState('all');"
new_memo = """const [overrideLabelFilter, setOverrideLabelFilter] = useState('all');

  // Lọc danh sách nhật ký hiệu chỉnh theo nhãn và từ khóa
  const filteredOverrides = useMemo(() => {
    return aiOverrides.filter((log) => {
      // 1. Lọc theo nhãn (so sánh không phân biệt hoa thường với cả nhãn mới và nhãn cũ)
      if (overrideLabelFilter !== 'all') {
        const target = overrideLabelFilter.trim().toLowerCase();
        const curLabel = (log.correctedLabel || log.newLabel || '').trim().toLowerCase();
        const oldLabel = (log.originalAiLabel || log.oldLabel || '').trim().toLowerCase();
        if (curLabel !== target && oldLabel !== target) {
          return false;
        }
      }

      // 2. Lọc theo từ khóa tìm kiếm
      if (overrideSearchText.trim()) {
        const q = overrideSearchText.trim().toLowerCase();
        const text = (log.rawText || log.content || log.contentExcerpt || '').toLowerCase();
        const reason = (log.overrideReason || log.adminNotes || '').toLowerCase();
        const admin = (log.adminName || '').toLowerCase();
        if (!text.includes(q) && !reason.includes(q) && !admin.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [aiOverrides, overrideLabelFilter, overrideSearchText]);"""

if '\r\n' in content:
    new_memo = new_memo.replace('\n', '\r\n')

if state_target in content:
    content = content.replace(state_target, new_memo, 1)

# In Tab 4 table: replace aiOverrides.map with filteredOverrides.map and update counters
old_export_excel_btn = """                <button
                  type="button"
                  onClick={() => {
                    const toExport = selectedOverrideIndices.size > 0
                      ? aiOverrides.filter((_, idx) => selectedOverrideIndices.has(idx))
                      : aiOverrides;
                    exportOverrideLogsToExcel(toExport);
                  }}
                  className="h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-2"
                  title="Xuất trực tiếp file Excel (.xlsx) chuẩn cột A -> H"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Xuất Excel {selectedOverrideIndices.size > 0 ? `(${selectedOverrideIndices.size})` : ''}</span>
                </button>"""

new_export_excel_btn = """                <button
                  type="button"
                  onClick={() => {
                    const toExport = selectedOverrideIndices.size > 0
                      ? aiOverrides.filter((_, idx) => selectedOverrideIndices.has(idx))
                      : filteredOverrides;
                    exportOverrideLogsToExcel(toExport);
                  }}
                  className="h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-2"
                  title="Xuất trực tiếp file Excel (.xlsx) chuẩn cột A -> H"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Xuất Excel {selectedOverrideIndices.size > 0 ? `(${selectedOverrideIndices.size})` : `(${filteredOverrides.length})`}</span>
                </button>"""

if '\r\n' in content:
    old_export_excel_btn = old_export_excel_btn.replace('\n', '\r\n')
    new_export_excel_btn = new_export_excel_btn.replace('\n', '\r\n')

if old_export_excel_btn in content:
    content = content.replace(old_export_excel_btn, new_export_excel_btn, 1)

# Update CSV button to use filteredOverrides
old_export_csv_btn = """                <button
                  type="button"
                  onClick={() => {
                    const toExport = selectedOverrideIndices.size > 0
                      ? aiOverrides.filter((_, idx) => selectedOverrideIndices.has(idx))
                      : aiOverrides;
                    exportOverrideLogsToCSV(toExport);
                  }}
                  className="h-9 px-3 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  title="Xuất file định dạng CSV UTF-8 BOM"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Xuất CSV {selectedOverrideIndices.size > 0 ? `(${selectedOverrideIndices.size})` : ''}</span>
                </button>"""

new_export_csv_btn = """                <button
                  type="button"
                  onClick={() => {
                    const toExport = selectedOverrideIndices.size > 0
                      ? aiOverrides.filter((_, idx) => selectedOverrideIndices.has(idx))
                      : filteredOverrides;
                    exportOverrideLogsToCSV(toExport);
                  }}
                  className="h-9 px-3 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  title="Xuất file định dạng CSV UTF-8 BOM"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Xuất CSV {selectedOverrideIndices.size > 0 ? `(${selectedOverrideIndices.size})` : `(${filteredOverrides.length})`}</span>
                </button>"""

if '\r\n' in content:
    old_export_csv_btn = old_export_csv_btn.replace('\n', '\r\n')
    new_export_csv_btn = new_export_csv_btn.replace('\n', '\r\n')

if old_export_csv_btn in content:
    content = content.replace(old_export_csv_btn, new_export_csv_btn, 1)

# Update select all in filter bar
old_filter_bar_counter = """              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">
                  Đã chọn: <strong className="text-slate-900">{selectedOverrideIndices.size}</strong> / {aiOverrides.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedOverrideIndices.size === aiOverrides.length) {
                      setSelectedOverrideIndices(new Set());
                    } else {
                      setSelectedOverrideIndices(new Set(aiOverrides.map((_, i) => i)));
                    }
                  }}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  {selectedOverrideIndices.size === aiOverrides.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>"""

new_filter_bar_counter = """              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">
                  Hiển thị: <strong className="text-emerald-700">{filteredOverrides.length}</strong> / {aiOverrides.length} mục
                  {selectedOverrideIndices.size > 0 && (
                    <span className="ml-1 text-slate-700 font-bold">
                      (Đã chọn {selectedOverrideIndices.size})
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const filteredIndices = filteredOverrides.map((log) => aiOverrides.indexOf(log)).filter(i => i >= 0);
                    const allFilteredSelected = filteredIndices.length > 0 && filteredIndices.every(i => selectedOverrideIndices.has(i));
                    if (allFilteredSelected) {
                      const next = new Set(selectedOverrideIndices);
                      filteredIndices.forEach(i => next.delete(i));
                      setSelectedOverrideIndices(next);
                    } else {
                      const next = new Set(selectedOverrideIndices);
                      filteredIndices.forEach(i => next.add(i));
                      setSelectedOverrideIndices(next);
                    }
                  }}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  {filteredOverrides.length > 0 && filteredOverrides.every((log) => selectedOverrideIndices.has(aiOverrides.indexOf(log))) ? 'Bỏ chọn đang lọc' : 'Chọn tất cả đang lọc'}
                </button>
              </div>"""

if '\r\n' in content:
    old_filter_bar_counter = old_filter_bar_counter.replace('\n', '\r\n')
    new_filter_bar_counter = new_filter_bar_counter.replace('\n', '\r\n')

if old_filter_bar_counter in content:
    content = content.replace(old_filter_bar_counter, new_filter_bar_counter, 1)

# Replace table header checkbox
old_th_checkbox = """                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={aiOverrides.length > 0 && selectedOverrideIndices.size === aiOverrides.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOverrideIndices(new Set(aiOverrides.map((_, i) => i)));
                            } else {
                              setSelectedOverrideIndices(new Set());
                            }
                          }}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </th>"""

new_th_checkbox = """                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredOverrides.length > 0 && filteredOverrides.every((log) => selectedOverrideIndices.has(aiOverrides.indexOf(log)))}
                          onChange={(e) => {
                            const next = new Set(selectedOverrideIndices);
                            filteredOverrides.forEach((log) => {
                              const origIdx = aiOverrides.indexOf(log);
                              if (origIdx >= 0) {
                                if (e.target.checked) next.add(origIdx);
                                else next.delete(origIdx);
                              }
                            });
                            setSelectedOverrideIndices(next);
                          }}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </th>"""

if '\r\n' in content:
    old_th_checkbox = old_th_checkbox.replace('\n', '\r\n')
    new_th_checkbox = new_th_checkbox.replace('\n', '\r\n')

if old_th_checkbox in content:
    content = content.replace(old_th_checkbox, new_th_checkbox, 1)

# Replace table body loop with filteredOverrides.map
old_tbody = """                  <tbody className="divide-y divide-slate-100">
                    {aiOverrides.map((log, index) => (
                      <tr key={log.id || index} className={`transition ${selectedOverrideIndices.has(index) ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-slate-50/70'}`}>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedOverrideIndices.has(index)}
                            onChange={() => {
                              const next = new Set(selectedOverrideIndices);
                              if (next.has(index)) next.delete(index);
                              else next.add(index);
                              setSelectedOverrideIndices(next);
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>"""

new_tbody = """                  <tbody className="divide-y divide-slate-100">
                    {filteredOverrides.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-400">
                          <p className="text-sm font-semibold text-slate-600">Không tìm thấy bản ghi nào khớp với điều kiện lọc</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Thử chọn nhãn khác hoặc xóa từ khóa tìm kiếm "{overrideSearchText}".
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredOverrides.map((log, index) => {
                        const originalIndex = aiOverrides.indexOf(log);
                        const isChecked = selectedOverrideIndices.has(originalIndex >= 0 ? originalIndex : index);
                        return (
                          <tr key={log.id || index} className={`transition ${isChecked ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-slate-50/70'}`}>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const targetIdx = originalIndex >= 0 ? originalIndex : index;
                                  const next = new Set(selectedOverrideIndices);
                                  if (next.has(targetIdx)) next.delete(targetIdx);
                                  else next.add(targetIdx);
                                  setSelectedOverrideIndices(next);
                                }}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>"""

if '\r\n' in content:
    old_tbody = old_tbody.replace('\n', '\r\n')
    new_tbody = new_tbody.replace('\n', '\r\n')

if old_tbody in content:
    content = content.replace(old_tbody, new_tbody, 1)

# Close map properly: replace `))}</tbody>` with `); })}</tbody>`
old_tbody_end = """                    ))}
                  </tbody>"""

new_tbody_end = """                        );
                      })
                    )}
                  </tbody>"""

if '\r\n' in content:
    old_tbody_end = old_tbody_end.replace('\n', '\r\n')
    new_tbody_end = new_tbody_end.replace('\n', '\r\n')

if old_tbody_end in content:
    content = content.replace(old_tbody_end, new_tbody_end, 1)

with io.open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed ModeratorView.jsx filtering completely")


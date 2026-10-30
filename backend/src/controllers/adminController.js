import * as XLSX from 'xlsx';

export function createAdminController({ adminRepository }) {
  return {
    /**
     * GET /api/admin/stats
     * Thống kê KPI Tổng quan
     */
    async getStats(req, res, next) {
      try {
        const stats = await adminRepository.getStats();
        res.json({ success: true, data: stats });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/admin/override-ai-label
     * Hiệu chỉnh nhãn AI thủ công
     */
    async createAiOverride(req, res, next) {
      try {
        const { contentType, contentId, rawText, originalAiLabel, correctedLabel, overrideReason } = req.body;
        const adminId = req.user?.id || null;
        const adminName = req.user?.full_name || 'Điều Hành Viên Hệ Thống';

        const data = await adminRepository.createAiOverride({
          adminId,
          adminName,
          contentType,
          contentId,
          rawText,
          originalAiLabel,
          correctedLabel,
          overrideReason,
        });

        res.json({
          success: true,
          message: 'Đã hiệu chỉnh nhãn AI và ghi nhật ký huấn luyện lại vào CSDL!',
          data,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/admin/ai-overrides
     * Danh sách logs hiệu chỉnh AI
     */
    async listAiOverrides(req, res, next) {
      try {
        const data = await adminRepository.findAllAiOverrides();
        res.json({ success: true, data });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/admin/ai-overrides/export
     * Xuất file CSV UTF-8 BOM chuẩn tiếng Việt (Hỗ trợ lọc ids, label, contentType, search)
     */
    async exportAiOverridesCsv(req, res, next) {
      try {
        const { ids, label, contentType, search } = req.query;
        const idList = ids ? ids.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean) : null;
        const listToExport = await adminRepository.findAiOverridesForExport({ ids: idList, label, contentType, search });

        let csvContent = '\uFEFF"A: STT","B: Nội dung câu / Hình ảnh gắn nhãn sai","C: Nhãn cũ","D: Nhãn mới","E: Loại nội dung","F: Lý do hiệu chỉnh / Ghi chú","G: Người thực hiện","H: Thời gian ghi nhận"\n';
        listToExport.forEach((log, index) => {
          const stt = index + 1;
          const content = String(log.rawText || log.imageUrl || '').replace(/"/g, '""');
          const oldLabel = String(log.originalAiLabel || 'Normal').replace(/"/g, '""');
          const newLabel = String(log.correctedLabel || 'Normal').replace(/"/g, '""');
          const type = (log.contentType === 'post' ? 'Bài viết' : log.contentType === 'comment' ? 'Bình luận' : 'Hình ảnh / Khác').replace(/"/g, '""');
          const reason = String(log.overrideReason || '').replace(/"/g, '""');
          const admin = String(log.adminName || 'Điều Hành Viên Hệ Thống').replace(/"/g, '""');
          const time = String(log.createdAt || '').replace(/"/g, '""');
          csvContent += `"${stt}","${content}","${oldLabel}","${newLabel}","${type}","${reason}","${admin}","${time}"\n`;
        });

        const dateStr = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="Danh_sach_hieu_chinh_nhan_AI_${dateStr}.csv"`);
        res.send(csvContent);
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/admin/ai-overrides/export-excel
     * Xuất file Excel (.xlsx) danh sách gắn nhãn sai chuẩn các cột A -> H (Hỗ trợ lọc ids, label, contentType, search)
     */
    async exportAiOverridesExcel(req, res, next) {
      try {
        const { ids, label, contentType, search } = req.query;
        const idList = ids ? ids.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean) : null;
        const listToExport = await adminRepository.findAiOverridesForExport({ ids: idList, label, contentType, search });

        const columns = [
          'A: STT',
          'B: Nội dung câu / Hình ảnh gắn nhãn sai',
          'C: Nhãn cũ',
          'D: Nhãn mới',
          'E: Loại nội dung',
          'F: Lý do hiệu chỉnh / Ghi chú',
          'G: Người thực hiện',
          'H: Thời gian ghi nhận',
        ];

        const dataRows = listToExport.map((log, index) => {
          const type = log.contentType === 'post' ? 'Bài viết' : log.contentType === 'comment' ? 'Bình luận' : 'Hình ảnh / Khác';
          return {
            'A: STT': index + 1,
            'B: Nội dung câu / Hình ảnh gắn nhãn sai': log.rawText || log.imageUrl || '',
            'C: Nhãn cũ': log.originalAiLabel || 'Normal',
            'D: Nhãn mới': log.correctedLabel || 'Normal',
            'E: Loại nội dung': type,
            'F: Lý do hiệu chỉnh / Ghi chú': log.overrideReason || '',
            'G: Người thực hiện': log.adminName || 'Điều Hành Viên Hệ Thống',
            'H: Thời gian ghi nhận': log.createdAt || '',
          };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: columns });
        worksheet['!cols'] = [
          { wch: 10 },
          { wch: 45 },
          { wch: 16 },
          { wch: 16 },
          { wch: 18 },
          { wch: 35 },
          { wch: 24 },
          { wch: 22 },
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Nhat_Ky_Hieu_Chinh_Nhan');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const dateStr = new Date().toISOString().slice(0, 10);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Danh_sach_hieu_chinh_nhan_AI_${dateStr}.xlsx"`);
        res.send(buffer);
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/admin/moderation/export-uncertain-excel
     * Xuất file Excel ảnh phân vân (pending_review)
     */
    async exportUncertainExcel(req, res, next) {
      try {
        const items = await adminRepository.findUncertainImages();

        const columns = [
          'STT',
          'Loại nội dung',
          'Tác giả',
          'Nội dung văn bản',
          'URL Hình ảnh phân vân',
          'Điểm An toàn (Safe)',
          'Điểm Nhạy cảm (NSFW)',
          'Điểm Bạo lực (Violence)',
          'Trạng thái',
          'Thời gian đăng',
        ];

        const dataRows = items.map((item, index) => ({
          'STT': index + 1,
          'Loại nội dung': item.content_type === 'post' ? 'Bài viết' : 'Bình luận',
          'Tác giả': item.author_name || 'Người dùng',
          'Nội dung văn bản': item.content || '(Không có nội dung)',
          'URL Hình ảnh phân vân': item.image_url || '',
          'Điểm An toàn (Safe)': Number(item.image_moderation_safe ?? 0).toFixed(4),
          'Điểm Nhạy cảm (NSFW)': Number(item.image_moderation_nsfw ?? 0).toFixed(4),
          'Điểm Bạo lực (Violence)': Number(item.image_moderation_violence ?? 0).toFixed(4),
          'Trạng thái': 'Phân vân (Pending Review)',
          'Thời gian đăng': new Date(item.created_at).toLocaleString('vi-VN'),
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: columns });
        worksheet['!cols'] = [
          { wch: 8 },
          { wch: 16 },
          { wch: 22 },
          { wch: 35 },
          { wch: 50 },
          { wch: 22 },
          { wch: 22 },
          { wch: 22 },
          { wch: 25 },
          { wch: 22 },
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Anh_Phan_Van_De_Train');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const dateStr = new Date().toISOString().slice(0, 10);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Danh_sach_anh_phan_van_retrain_${dateStr}.xlsx"`);
        res.send(buffer);
      } catch (err) {
        next(err);
      }
    },
  };
}

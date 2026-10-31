export function createReportsController({ reportRepository }) {
  return {
    /**
     * GET /api/reports
     * Lấy danh sách báo cáo
     */
    async listReports(req, res, next) {
      try {
        const reports = await reportRepository.findAllReports();
        res.json({ success: true, data: reports });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/reports
     * Gửi báo cáo người dùng mới
     */
    async createReport(req, res, next) {
      try {
        const { reporter, targetType, targetId, targetAuthor, contentExcerpt, reason, reasonLabel, details } = req.body;
        const reporterId = req.user?.id || reporter?.id;

        const result = await reportRepository.createReport({
          reporterId,
          reporter,
          targetType,
          targetId,
          targetAuthor,
          contentExcerpt,
          reason,
          reasonLabel,
          details,
        });

        const message = result.fromDb
          ? 'Đã lưu báo cáo thành công vào CSDL PostgreSQL!'
          : 'Đã gửi báo cáo thành công!';

        res.json({
          success: true,
          message,
          data: result.data,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * PATCH /api/reports/:id
     * Xử lý giải quyết báo cáo
     */
    async resolveReport(req, res, next) {
      try {
        const { id } = req.params;
        const { status, adminNotes, newLabel, oldLabel, rawText } = req.body;
        const reviewerId = req.user?.id || null;

        const { report, overrideLog, finalNewLabel } = await reportRepository.updateReportStatus({
          id,
          status,
          adminNotes,
          newLabel,
          oldLabel,
          reviewerId,
          rawText,
        });

        if (status === 'resolved_violation') {
          if (overrideLog && req.user?.full_name) {
            overrideLog.adminName = req.user.full_name;
          }
          return res.json({
            success: true,
            message: `Xác nhận vi phạm: Đã gán lại nhãn "${finalNewLabel}" và lưu nhật ký vào CSDL PostgreSQL thành công!`,
            data: report,
            overrideLog,
          });
        } else {
          return res.json({
            success: true,
            message: 'Báo cáo sai / không vi phạm: Đã bác bỏ báo cáo và giữ nguyên nhãn ban đầu!',
            data: report,
          });
        }
      } catch (err) {
        next(err);
      }
    },
  };
}


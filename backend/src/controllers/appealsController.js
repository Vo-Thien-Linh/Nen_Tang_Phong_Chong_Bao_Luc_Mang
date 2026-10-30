export function createAppealsController({ appealRepository }) {
  return {
    /**
     * GET /api/appeals
     * Lấy danh sách toàn bộ khiếu nại
     */
    async listAppeals(req, res, next) {
      try {
        const data = await appealRepository.findAllAppeals();
        res.json({ success: true, data });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/appeals
     * Gửi khiếu nại AI gắn nhãn sai
     */
    async createAppeal(req, res, next) {
      try {
        const { user, contentType, contentId, originalText, aiPredictedLabel, aiConfidence, aiActionTaken, appealReason } = req.body;
        const userId = req.user?.id || user?.id;

        const result = await appealRepository.createAppeal({
          userId,
          user,
          contentType,
          contentId,
          originalText,
          aiPredictedLabel,
          aiConfidence,
          aiActionTaken,
          appealReason,
        });

        const message = result.fromDb
          ? 'Đã gửi khiếu nại thành công đến Quản trị viên (lưu vào CSDL PostgreSQL)!'
          : 'Đã gửi khiếu nại thành công đến Quản trị viên!';

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
     * PATCH /api/appeals/:id
     * Xử lý khiếu nại (chấp thuận hoặc từ chối)
     */
    async resolveAppeal(req, res, next) {
      try {
        const { id } = req.params;
        const { status, adminNotes, newLabel } = req.body;
        const reviewerId = req.user?.id || null;
        const reviewerName = req.user?.full_name || 'Điều Hành Viên Hệ Thống';

        // 1. Kiểm tra tính hợp lệ của status
        if (!['approved', 'rejected'].includes(status)) {
          return res.status(400).json({
            success: false,
            message: "Trạng thái xử lý không hợp lệ. Chỉ chấp nhận 'approved' hoặc 'rejected'.",
          });
        }

        // 2. Kiểm tra tính hợp lệ của newLabel khi approved
        const VALID_LABELS = ['Normal', 'Toxic', 'Hate Speech', 'Violence'];
        const finalNewLabel = status === 'approved' ? (newLabel || 'Normal') : null;
        if (status === 'approved' && !VALID_LABELS.includes(finalNewLabel)) {
          return res.status(400).json({
            success: false,
            message: `Nhãn mới không hợp lệ. Danh sách nhãn hợp lệ: ${VALID_LABELS.join(', ')}.`,
          });
        }

        const { appeal, createdOverrideLog } = await appealRepository.resolveAppeal({
          id,
          status,
          adminNotes,
          newLabel: finalNewLabel,
          reviewerId,
          reviewerName,
        });

        return res.json({
          success: true,
          message: status === 'approved'
            ? `Đã chấp thuận khiếu nại: Đổi nhãn sang "${finalNewLabel}" thành công!`
            : 'Đã từ chối khiếu nại và giữ nguyên nhãn ban đầu!',
          data: appeal,
          overrideLog: createdOverrideLog,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}


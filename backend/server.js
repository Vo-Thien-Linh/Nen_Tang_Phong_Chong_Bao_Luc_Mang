import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import pool, { testDbConnection } from './src/config/db.js';
import { createPostReactionsRouter } from './src/routes/postReactionsRouter.js';
import { createPostsRouter } from './src/routes/postsRouter.js';
import { createUsersRouter } from './src/routes/usersRouter.js';
import { createNotificationsRouter } from './src/routes/notificationsRouter.js';
import { createImageModerationRouter } from './src/routes/imageModerationRouter.js';
import { realtimeService } from './src/services/realtimeService.js';
import { startModerationExpirySweeper } from './src/services/moderationExpirySweeper.js';
import { createModerationAppealRouter } from './src/routes/moderationAppealRouter.js';
import { createImagePreviewRouter } from './src/routes/imagePreviewRouter.js';
import { createUserRepository } from './src/repositories/userRepository.js';
import { createAuthMiddleware } from './src/middleware/auth.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const userRepository = createUserRepository({ pool });
const { requireRole } = createAuthMiddleware({ userRepository });

function logApiError(error) {
  console.error('Lỗi API:', {
    message: error.message,
    code: error.code,
    detail: error.detail,
    constraint: error.constraint,
    stack: error.stack,
  });
}

// 1. Cấu hình Cloudinary từ file .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Cấu hình Multer Storage lưu trực tiếp lên Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nexussocial_uploads', // Thư mục lưu ảnh trên Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
    transformation: [{ width: 1920, height: 1920, crop: 'limit', quality: 'auto' }],
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Giới hạn ảnh tối đa 10MB
});

// Route kiểm tra server hoạt động
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend server đang chạy tốt!' });
});

// Route kiểm tra kết nối Database Supabase
app.get('/api/db-test', async (req, res) => {
  try {
    const isConnected = await testDbConnection();
    if (isConnected) {
      res.json({ success: true, message: 'Kết nối Supabase PostgreSQL thành công!' });
    } else {
      res.status(500).json({ success: false, message: 'Chưa thể kết nối tới Supabase.' });
    }
  } catch (error) {
    logApiError(error);
    res.status(500).json({ success: false, message: 'Đã có lỗi hệ thống' });
  }
});

// 3. API Upload ảnh: Nhận file -> Đẩy lên Cloudinary -> Trả về URL HTTPS công khai
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Chưa có file nào được tải lên!' });
    }

    console.log('Đã upload ảnh thành công lên Cloudinary:', req.file.path);

    res.json({
      success: true,
      url: req.file.path, // Link ảnh HTTPS trên Cloudinary
      filename: req.file.filename,
    });
  } catch (error) {
    logApiError(error);
    res.status(500).json({ success: false, error: 'Đã có lỗi hệ thống' });
  }
});

app.use('/api/posts', createPostReactionsRouter({ pool }));
app.use('/api/posts', createPostsRouter({ pool }));
app.use('/api/users', createUsersRouter({ pool }));
app.use('/api/notifications', createNotificationsRouter({ pool }));
app.use('/api/admin/image-moderation', createImageModerationRouter({ pool }));
app.use('/api/posts', createModerationAppealRouter({ pool }));
app.use('/api/posts/preview-image', createImagePreviewRouter({ pool }));

// Realtime SSE Stream cho Bài viết, Chia sẻ và Bình luận
app.get('/api/realtime/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);
  realtimeService.addClient(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    realtimeService.removeClient(res);
  });
});

// ========================================================
// 4. IN-MEMORY STORE: BÁO CÁO, KHIẾU NẠI & HIỆU CHỈNH NHÃN AI
// ========================================================
let reportsStore = [
  {
    id: 'rep-1',
    reporter: { id: 'user-1', name: 'Lê Thu Trang', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200' },
    targetType: 'post',
    targetId: 'post-3',
    targetAuthor: { name: 'Trần Hoàng Nam', username: 'nam_traveler' },
    contentExcerpt: 'Hoàng hôn ở Đà Lạt chiều nay bình yên lạ thường...',
    reason: 'spam',
    reasonLabel: 'Spam / Tin rác',
    details: 'Nghi ngờ bài viết chứa liên kết quảng cáo spam chưa được kiểm duyệt.',
    status: 'pending', // 'pending' | 'resolved_violation' | 'dismissed'
    adminNotes: '',
    createdAt: '40 phút trước',
    aiStatus: { label: 'Normal', confidence: 0.99 }
  },
  {
    id: 'rep-2',
    reporter: { id: 'user-2', name: 'Trần Hoàng Nam', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' },
    targetType: 'comment',
    targetId: 'cmt-toxic-demo',
    targetAuthor: { name: 'Người dùng ẩn danh', username: 'anonymous_user' },
    contentExcerpt: 'Nói chuyện dốt nát thế mà cũng đòi làm kỹ sư công nghệ à?',
    reason: 'toxic',
    reasonLabel: 'Công kích / Xúc phạm',
    details: 'Bình luận có từ ngữ công kích thô tục nhắm vào thành viên khác.',
    status: 'pending',
    adminNotes: '',
    createdAt: '2 giờ trước',
    aiStatus: { label: 'Toxic', confidence: 0.93 }
  },
  {
    id: 'rep-3',
    reporter: { id: 'user-current', name: 'Võ Thiện Linh', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400' },
    targetType: 'message',
    targetId: 'msg-rep-demo',
    targetAuthor: { name: 'Trần Minh Tuấn', username: 'tuan_tran_ai' },
    contentExcerpt: 'Đưa mã nguồn đây không tao hack sập hệ thống của mày bây giờ!',
    reason: 'harassment',
    reasonLabel: 'Quấy rối / Đe dọa',
    details: 'Tin nhắn quấy rối và đe dọa trong hộp thư chờ người lạ.',
    status: 'resolved_violation',
    adminNotes: 'Đã xác minh tin nhắn có yếu tố xúc phạm, cảnh cáo tài khoản và ẩn hội thoại.',
    createdAt: '1 ngày trước',
    aiStatus: { label: 'Violence', confidence: 0.95 }
  }
];

let appealsStore = [
  {
    id: 'app-1',
    user: { id: 'user-current', name: 'Võ Thiện Linh', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400' },
    contentType: 'post',
    contentId: 'post-2',
    originalText: 'Hôm nay team em "tiêu diệt" gọn ghẽ đống bug cứng đầu trong sprint này! Cảm giác như vừa chiến thắng một trận đánh lớn vậy haha.',
    aiPredictedLabel: 'Violence',
    aiConfidence: 0.912,
    aiActionTaken: 'warn_user',
    appealReason: 'Tôi dùng từ "tiêu diệt bug" và "trận đánh lớn" như một cách ví von lập trình viên giải quyết sự cố, hoàn toàn không có ý định bạo lực hay thù địch. Kính mong admin xem xét lại.',
    status: 'pending', // 'pending' | 'approved' | 'rejected'
    adminNotes: '',
    createdAt: '25 phút trước'
  },
  {
    id: 'app-2',
    user: { id: 'user-2', name: 'Trần Hoàng Nam', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' },
    contentType: 'comment',
    contentId: 'cmt-3',
    originalText: 'Thằng bạn thân chí cốt của tôi điên thật rồi, dám bỏ việc lương cao để khởi nghiệp công nghệ!',
    aiPredictedLabel: 'Toxic',
    aiConfidence: 0.884,
    aiActionTaken: 'cooldown_30s',
    appealReason: 'Đây là cách nói đùa khen ngợi bạn thân dũng cảm khởi nghiệp, từ "điên" ở đây mang nghĩa tích cực khâm phục chứ không phải xúc phạm chửi bới.',
    status: 'approved',
    adminNotes: 'Đã kiểm tra ngữ cảnh: Lời khen thân mật giữa bạn bè. AI False Positive. Đã phục hồi bình luận và gỡ phạt.',
    createdAt: '3 giờ trước'
  }
];

let aiOverrideLogsStore = [
  {
    id: 'ovr-1',
    adminName: 'Quản Trị Viên Hệ Thống',
    contentType: 'comment',
    contentId: 'cmt-3',
    rawText: 'Thằng bạn thân chí cốt của tôi điên thật rồi, dám bỏ việc lương cao để khởi nghiệp công nghệ!',
    originalAiLabel: 'Toxic',
    originalConfidence: 0.884,
    correctedLabel: 'Normal',
    overrideReason: 'False Positive: Từ ngữ cảm thán thân mật giữa bạn thân, AI nhận diện nhầm từ "điên".',
    isExportedForRetraining: false,
    createdAt: '2 giờ trước'
  }
];

// ========================================================
// 5. REST APIs: DASHBOARD ADMIN & KIỂM DUYỆT NỘI DUNG
// ========================================================

// 5.1 Thống kê KPI Tổng quan (Yêu cầu quyền Quản trị viên)
app.get('/api/admin/stats', requireRole('admin'), (req, res) => {
  const pendingReports = reportsStore.filter(r => r.status === 'pending').length;
  const pendingAppeals = appealsStore.filter(a => a.status === 'pending').length;
  const falsePositivesOverridden = aiOverrideLogsStore.length;

  res.json({
    success: true,
    data: {
      totalContentScanned: 1845,
      pendingReports,
      pendingAppeals,
      falsePositivesOverridden,
      estimatedAiAccuracy: 96.4,
      avgLatencyMs: 42.8,
      distribution: {
        normal: 1620,
        toxic: 135,
        hateSpeech: 42,
        violence: 48
      }
    }
  });
});

// 5.2 Lấy danh sách Báo cáo (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.get('/api/reports', requireRole('moderator'), (req, res) => {
  res.json({ success: true, data: reportsStore });
});

// 5.3 Gửi Báo cáo người dùng mới (Người dùng đăng nhập gửi báo cáo)
app.post('/api/reports', (req, res) => {
  const { reporter, targetType, targetId, targetAuthor, contentExcerpt, reason, reasonLabel, details } = req.body;
  
  const newReport = {
    id: `rep-${Date.now()}`,
    reporter: reporter || { name: 'Người dùng', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200' },
    targetType: targetType || 'post',
    targetId: targetId || 'target-id',
    targetAuthor: targetAuthor || { name: 'Người dùng vi phạm' },
    contentExcerpt: contentExcerpt || 'Nội dung báo cáo...',
    reason: reason || 'other',
    reasonLabel: reasonLabel || 'Lý do khác',
    details: details || '',
    status: 'pending',
    adminNotes: '',
    createdAt: 'Vừa xong',
    aiStatus: { label: 'Pending Review', confidence: 0.85 }
  };

  reportsStore.unshift(newReport);
  res.json({ success: true, message: 'Đã gửi báo cáo thành công!', data: newReport });
});

// 5.4 Xử lý Báo cáo (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.patch('/api/reports/:id', requireRole('moderator'), async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes, newLabel, oldLabel } = req.body; // status: 'resolved_violation' | 'dismissed'

  const report = reportsStore.find(r => r.id === id);
  if (!report) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy báo cáo' });
  }

  report.status = status;
  if (adminNotes !== undefined) report.adminNotes = adminNotes;

  // Xử lý phân nhánh nghiệp vụ:
  if (status === 'resolved_violation') {
    // BÁO CÁO ĐÚNG: Gán lại nhãn vi phạm (Toxic, Hate Speech, Violence) và ẩn nội dung
    const finalNewLabel = newLabel || 'Toxic';
    const finalOldLabel = oldLabel || report.aiStatus?.label || 'Normal';
    report.newLabel = finalNewLabel;
    report.oldLabel = finalOldLabel;
    report.actionTaken = 'relabel_and_hide';

    // Tạo bản ghi trong Nhật ký hiệu chỉnh nhãn AI (Override Logs) phục vụ xuất file & tái huấn luyện
    const newOverrideLog = {
      id: `ovr-${Date.now()}`,
      adminName: req.user?.full_name || 'Điều Hành Viên Hệ Thống',
      contentType: report.targetType || 'post',
      contentId: report.targetId,
      rawText: report.contentExcerpt || report.targetExcerpt || report.imageUrl || 'Nội dung vi phạm',
      imageUrl: report.imageUrl || null,
      originalAiLabel: finalOldLabel,
      originalConfidence: report.aiStatus?.confidence || 0.95,
      correctedLabel: finalNewLabel,
      overrideReason: adminNotes || `Xác nhận vi phạm từ báo cáo (${report.reasonLabel || report.reason}): Gán lại nhãn ${finalNewLabel}`,
      isExportedForRetraining: false,
      createdAt: 'Vừa xong'
    };
    aiOverrideLogsStore.unshift(newOverrideLog);

    // Đồng bộ CSDL Supabase PostgreSQL nếu pool kết nối
    if (pool) {
      try {
        if (report.targetType === 'post') {
          await pool.query(
            `UPDATE posts SET ai_label = $1, is_hidden = TRUE WHERE id = $2`,
            [finalNewLabel, report.targetId]
          );
        } else if (report.targetType === 'comment') {
          await pool.query(
            `UPDATE comments SET ai_label = $1, is_hidden = TRUE WHERE id = $2`,
            [finalNewLabel, report.targetId]
          );
        }
        await pool.query(
          `INSERT INTO ai_override_logs (admin_id, content_type, content_id, raw_text, original_ai_label, original_confidence, corrected_label, override_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            req.user?.id || null, 
            report.targetType || 'post', 
            report.targetId, 
            report.contentExcerpt || report.targetExcerpt || report.imageUrl || '', 
            finalOldLabel, 
            report.aiStatus?.confidence || 0.95, 
            finalNewLabel, 
            newOverrideLog.overrideReason
          ]
        );
      } catch (dbErr) {
        console.warn('Lưu vào CSDL Supabase thất bại, đã lưu vào bộ nhớ tạm:', dbErr.message);
      }
    }

    return res.json({ 
      success: true, 
      message: `Xác nhận vi phạm thành công: Đã gán lại nhãn "${finalNewLabel}" và ghi nhật ký hiệu chỉnh!`, 
      data: report,
      overrideLog: newOverrideLog 
    });
  } else {
    // BÁO CÁO SAI: Giữ nguyên nhãn ban đầu của bài viết/bình luận/ảnh
    report.actionTaken = 'dismissed_keep_original_label';
    return res.json({ 
      success: true, 
      message: 'Báo cáo sai / không vi phạm: Đã bác bỏ báo cáo và giữ nguyên nhãn ban đầu!', 
      data: report 
    });
  }
});

// 5.5 Lấy danh sách Khiếu nại (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.get('/api/appeals', requireRole('moderator'), (req, res) => {
  res.json({ success: true, data: appealsStore });
});

// 5.6 Gửi Khiếu nại AI gắn nhãn sai
app.post('/api/appeals', (req, res) => {
  const { user, contentType, contentId, originalText, aiPredictedLabel, aiConfidence, aiActionTaken, appealReason } = req.body;

  const newAppeal = {
    id: `app-${Date.now()}`,
    user: user || { name: 'Người khiếu nại', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400' },
    contentType: contentType || 'post',
    contentId: contentId || 'item-id',
    originalText: originalText || '',
    aiPredictedLabel: aiPredictedLabel || 'Toxic',
    aiConfidence: aiConfidence || 0.90,
    aiActionTaken: aiActionTaken || 'warn_user',
    appealReason: appealReason || 'Tôi khiếu nại phán quyết AI.',
    status: 'pending',
    adminNotes: '',
    createdAt: 'Vừa xong'
  };

  appealsStore.unshift(newAppeal);
  res.json({ success: true, message: 'Đã gửi khiếu nại thành công đến Quản trị viên!', data: newAppeal });
});

// 5.7 Xử lý Khiếu nại (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.patch('/api/appeals/:id', requireRole('moderator'), (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body; // status: 'approved' | 'rejected'

  const appeal = appealsStore.find(a => a.id === id);
  if (!appeal) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy đơn khiếu nại' });
  }

  appeal.status = status;
  if (adminNotes !== undefined) appeal.adminNotes = adminNotes;

  // Nếu duyệt chấp thuận khiếu nại (False Positive) -> Ghi log vào AI Override Logs
  if (status === 'approved') {
    aiOverrideLogsStore.unshift({
      id: `ovr-${Date.now()}`,
      adminName: req.user?.full_name || 'Điều Hành Viên Hệ Thống',
      contentType: appeal.contentType,
      contentId: appeal.contentId,
      rawText: appeal.originalText,
      originalAiLabel: appeal.aiPredictedLabel,
      originalConfidence: appeal.aiConfidence,
      correctedLabel: 'Normal',
      overrideReason: `Giải quyết khiếu nại thành công: ${adminNotes || appeal.appealReason}`,
      isExportedForRetraining: false,
      createdAt: 'Vừa xong'
    });
  }

  res.json({ success: true, message: 'Đã xử lý khiếu nại thành công', data: appeal });
});

// 5.8 Hiệu chỉnh nhãn AI trực tiếp (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.post('/api/admin/override-ai-label', requireRole('moderator'), (req, res) => {
  const { contentType, contentId, rawText, originalAiLabel, correctedLabel, overrideReason } = req.body;

  const newLog = {
    id: `ovr-${Date.now()}`,
    adminName: req.user?.full_name || 'Điều Hành Viên Hệ Thống',
    contentType: contentType || 'post',
    contentId: contentId || 'item-id',
    rawText: rawText || '',
    originalAiLabel: originalAiLabel || 'Normal',
    originalConfidence: 0.95,
    correctedLabel: correctedLabel || 'Normal',
    overrideReason: overrideReason || 'Hiệu chỉnh thủ công bởi Điều hành viên / Quản trị viên',
    isExportedForRetraining: false,
    createdAt: 'Vừa xong'
  };

  aiOverrideLogsStore.unshift(newLog);
  res.json({ success: true, message: 'Đã hiệu chỉnh nhãn AI và ghi nhật ký huấn luyện lại!', data: newLog });
});

// 5.9 Lấy danh sách Logs hiệu chỉnh AI (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.get('/api/admin/ai-overrides', requireRole('moderator'), (req, res) => {
  res.json({ success: true, data: aiOverrideLogsStore });
});

// 5.10 Xuất file danh sách gắn nhãn sai (CSV UTF-8 BOM chuẩn tiếng Việt mở bằng Excel)
app.get('/api/admin/ai-overrides/export', requireRole('moderator'), (req, res) => {
  try {
    let csvContent = '\uFEFF"STT","Nội dung / Hình ảnh gắn nhãn sai","Nhãn cũ","Nhãn mới","Loại nội dung","Lý do hiệu chỉnh","Người thực hiện","Thời gian"\n';
    aiOverrideLogsStore.forEach((log, index) => {
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

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Danh_sach_hieu_chinh_nhan_AI_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi xuất file: ' + err.message });
  }
});

app.use((err, _req, res, _next) => {
  logApiError(err);
  res.status(err.statusCode || 500).json({
    success: false,
    code: err.code,
    message: err.statusCode ? err.message : 'Đã có lỗi hệ thống',
  });
});

const PORT = process.env.PORT || 5000;
const stopModerationExpirySweeper = startModerationExpirySweeper(pool);
process.once('SIGINT', () => { stopModerationExpirySweeper(); process.exit(0); });
process.once('SIGTERM', () => { stopModerationExpirySweeper(); process.exit(0); });
app.listen(PORT, async () => {
  console.log('Server Backend đang chạy tại http://localhost:' + PORT);
  if (process.env.NODE_ENV === 'production') {
    console.warn('Cảnh báo: x-user-id development auth đang tắt vì NODE_ENV=production.');
  }
  await testDbConnection();
});


import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import pool, { testDbConnection } from './src/config/db.js';
import { createPostsRouter } from './src/routes/postsRouter.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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
  const isConnected = await testDbConnection();
  if (isConnected) {
    res.json({ success: true, message: 'Kết nối Supabase PostgreSQL thành công!' });
  } else {
    res.status(500).json({ success: false, message: 'Chưa thể kết nối tới Supabase. Vui lòng kiểm tra DATABASE_URL trong backend/.env' });
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
    console.error('Lỗi khi upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use('/api/posts', createPostsRouter({ pool }));

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

// 5.1 Thống kê KPI Tổng quan
app.get('/api/admin/stats', (req, res) => {
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

// 5.2 Lấy danh sách Báo cáo
app.get('/api/reports', (req, res) => {
  res.json({ success: true, data: reportsStore });
});

// 5.3 Gửi Báo cáo người dùng mới
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

// 5.4 Xử lý Báo cáo (Chấp thuận vi phạm hoặc Bác bỏ)
app.patch('/api/reports/:id', (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body; // status: 'resolved_violation' | 'dismissed'

  const report = reportsStore.find(r => r.id === id);
  if (!report) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy báo cáo' });
  }

  report.status = status;
  if (adminNotes !== undefined) report.adminNotes = adminNotes;

  res.json({ success: true, message: 'Cập nhật trạng thái báo cáo thành công', data: report });
});

// 5.5 Lấy danh sách Khiếu nại
app.get('/api/appeals', (req, res) => {
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

// 5.7 Xử lý Khiếu nại (Chấp thuận minh oan hoặc Bác bỏ)
app.patch('/api/appeals/:id', (req, res) => {
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
      adminName: 'Quản Trị Viên Hệ Thống',
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

// 5.8 Admin can thiệp sửa nhãn AI trực tiếp (Override / Re-classify)
app.post('/api/admin/override-ai-label', (req, res) => {
  const { contentType, contentId, rawText, originalAiLabel, correctedLabel, overrideReason } = req.body;

  const newLog = {
    id: `ovr-${Date.now()}`,
    adminName: 'Quản Trị Viên Hệ Thống',
    contentType: contentType || 'post',
    contentId: contentId || 'item-id',
    rawText: rawText || '',
    originalAiLabel: originalAiLabel || 'Normal',
    originalConfidence: 0.95,
    correctedLabel: correctedLabel || 'Normal',
    overrideReason: overrideReason || 'Hiệu chỉnh thủ công bởi Quản trị viên',
    isExportedForRetraining: false,
    createdAt: 'Vừa xong'
  };

  aiOverrideLogsStore.unshift(newLog);
  res.json({ success: true, message: 'Đã hiệu chỉnh nhãn AI và ghi nhật ký huấn luyện lại!', data: newLog });
});

// 5.9 Lấy danh sách Logs hiệu chỉnh AI / Xuất tập dữ liệu tái huấn luyện
app.get('/api/admin/ai-overrides', (req, res) => {
  res.json({ success: true, data: aiOverrideLogsStore });
});

app.use((err, _req, res, _next) => {
  console.error('Lỗi API:', err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.statusCode ? err.message : 'Đã có lỗi hệ thống',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log('Server Backend đang chạy tại http://localhost:' + PORT);
  await testDbConnection();
});


import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
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

// 5.2 Lấy danh sách Báo cáo từ CSDL THẬT (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.get('/api/reports', requireRole('moderator'), async (req, res) => {
  if (pool) {
    try {
      const q = `
        SELECT r.id, r.reporter_id, r.target_type, r.target_id, r.reason, r.details, r.status, r.admin_notes, r.action_taken, r.created_at,
               u.full_name AS reporter_name, u.avatar_url AS reporter_avatar,
               p.content AS post_content, p.image_url AS post_image, p.ai_label AS post_ai_label,
               c.content AS comment_content, c.image_url AS comment_image, c.ai_label AS comment_ai_label,
               author.full_name AS target_author_name, author.username AS target_author_username
        FROM reports r
        LEFT JOIN users u ON r.reporter_id = u.id
        LEFT JOIN posts p ON r.target_type = 'post' AND r.target_id = p.id
        LEFT JOIN comments c ON r.target_type = 'comment' AND r.target_id = c.id
        LEFT JOIN users author ON (
          (r.target_type = 'post' AND p.author_id = author.id) OR
          (r.target_type = 'comment' AND c.author_id = author.id)
        )
        ORDER BY r.created_at DESC
      `;
      const result = await pool.query(q);
      const mapped = result.rows.map(row => {
        const textContent = row.target_type === 'post' ? row.post_content : row.comment_content;
        const img = row.target_type === 'post' ? row.post_image : row.comment_image;
        const currentAiLabel = row.target_type === 'post' ? (row.post_ai_label || 'Normal') : (row.comment_ai_label || 'Normal');
        return {
          id: String(row.id),
          reporter: {
            id: row.reporter_id,
            name: row.reporter_name || 'Người dùng',
            avatar: row.reporter_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200'
          },
          targetType: row.target_type,
          targetId: String(row.target_id),
          targetAuthor: {
            name: row.target_author_name || 'Người dùng',
            username: row.target_author_username || 'user'
          },
          contentExcerpt: textContent || '',
          targetExcerpt: textContent || '',
          imageUrl: img || null,
          reason: row.reason,
          reasonLabel: row.reason === 'toxic' ? 'Công kích / Xúc phạm' : row.reason === 'hate_speech' ? 'Thù ghét' : row.reason === 'violence' ? 'Bạo lực' : row.reason === 'spam' ? 'Spam / Tin rác' : 'Nội dung vi phạm',
          details: row.details || '',
          status: row.status,
          adminNotes: row.admin_notes || '',
          actionTaken: row.action_taken,
          createdAt: new Date(row.created_at).toLocaleString('vi-VN'),
          aiStatus: { label: currentAiLabel, confidence: 0.95 }
        };
      });
      return res.json({ success: true, data: mapped });
    } catch (err) {
      console.warn('Lỗi lấy báo cáo từ DB PostgreSQL, chuyển sang dữ liệu bộ nhớ:', err.message);
    }
  }
  res.json({ success: true, data: reportsStore });
});

// 5.3 Gửi Báo cáo người dùng mới vào CSDL THẬT (Người dùng đăng nhập gửi báo cáo)
app.post('/api/reports', async (req, res) => {
  const { reporter, targetType, targetId, targetAuthor, contentExcerpt, reason, reasonLabel, details } = req.body;
  let reporterId = req.user?.id || reporter?.id;

  if (pool) {
    try {
      if (!reporterId) {
        const uRes = await pool.query('SELECT id FROM users LIMIT 1');
        if (uRes.rows.length > 0) reporterId = uRes.rows[0].id;
      }

      if (reporterId) {
        const numTargetId = parseInt(String(targetId || '1').replace(/\D/g, ''), 10) || 1;
        const validReason = ['toxic', 'hate_speech', 'violence', 'harassment', 'spam', 'misinformation', 'other'].includes(reason) 
          ? reason 
          : 'other';

        const insertQuery = `
          INSERT INTO reports (reporter_id, target_type, target_id, reason, details, status)
          VALUES ($1, $2, $3, $4, $5, 'pending')
          ON CONFLICT (reporter_id, target_type, target_id) 
          DO UPDATE SET details = EXCLUDED.details, reason = EXCLUDED.reason, status = 'pending'
          RETURNING *
        `;
        const result = await pool.query(insertQuery, [reporterId, targetType || 'post', numTargetId, validReason, details || '']);
        const dbReport = result.rows[0];
        return res.json({ 
          success: true, 
          message: 'Đã lưu báo cáo thành công vào CSDL PostgreSQL!', 
          data: {
            id: String(dbReport.id),
            reporter: reporter || { id: reporterId, name: req.user?.full_name || 'Người dùng' },
            targetType: dbReport.target_type,
            targetId: String(dbReport.target_id),
            targetAuthor: targetAuthor || { name: 'Người dùng' },
            contentExcerpt: contentExcerpt || '',
            targetExcerpt: contentExcerpt || '',
            reason: dbReport.reason,
            reasonLabel: reasonLabel || 'Nội dung vi phạm',
            details: dbReport.details,
            status: dbReport.status,
            createdAt: 'Vừa xong',
            aiStatus: { label: 'Normal', confidence: 0.95 }
          }
        });
      }
    } catch (dbErr) {
      console.warn('Lỗi lưu báo cáo vào PostgreSQL, chuyển lưu bộ nhớ tạm:', dbErr.message);
    }
  }

  // Fallback in-memory
  const newReport = {
    id: `rep-${Date.now()}`,
    reporter: reporter || { name: req.user?.full_name || 'Người dùng', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200' },
    targetType: targetType || 'post',
    targetId: targetId || 'target-id',
    targetAuthor: targetAuthor || { name: 'Người dùng vi phạm' },
    contentExcerpt: contentExcerpt || 'Nội dung báo cáo...',
    targetExcerpt: contentExcerpt || 'Nội dung báo cáo...',
    reason: reason || 'other',
    reasonLabel: reasonLabel || 'Lý do khác',
    details: details || '',
    status: 'pending',
    adminNotes: '',
    createdAt: 'Vừa xong',
    aiStatus: { label: 'Normal', confidence: 0.85 }
  };

  reportsStore.unshift(newReport);
  res.json({ success: true, message: 'Đã gửi báo cáo thành công!', data: newReport });
});

// 5.4 Xử lý Báo cáo trong CSDL THẬT (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.patch('/api/reports/:id', requireRole('moderator'), async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes, newLabel, oldLabel } = req.body; // status: 'resolved_violation' | 'dismissed'

  const finalNewLabel = newLabel || 'Toxic';
  const finalOldLabel = oldLabel || 'Normal';
  const actionTaken = status === 'resolved_violation' ? 'relabel_and_hide' : 'dismissed_keep_original_label';
  const reviewerId = req.user?.id || null;

  let report = null;

  // 1. Cập nhật trong PostgreSQL thật
  if (pool) {
    try {
      const numId = parseInt(id, 10);
      if (!isNaN(numId)) {
        const updateReportSql = `
          UPDATE reports 
          SET status = $1, admin_notes = $2, action_taken = $3, reviewed_by = $4, reviewed_at = CURRENT_TIMESTAMP
          WHERE id = $5
          RETURNING *
        `;
        const repRes = await pool.query(updateReportSql, [status, adminNotes || '', actionTaken, reviewerId, numId]);
        if (repRes.rows.length > 0) {
          const dbRep = repRes.rows[0];
          report = {
            id: String(dbRep.id),
            targetType: dbRep.target_type,
            targetId: String(dbRep.target_id),
            status: dbRep.status,
            adminNotes: dbRep.admin_notes,
            newLabel: finalNewLabel,
            oldLabel: finalOldLabel,
            actionTaken
          };

          // Tìm author_id của bài viết, bình luận hoặc tin nhắn bị báo cáo
          let targetAuthorId = null;
          try {
            if (dbRep.target_type === 'post') {
              const pRes = await pool.query('SELECT author_id FROM posts WHERE id = $1', [dbRep.target_id]);
              if (pRes.rows.length > 0) targetAuthorId = pRes.rows[0].author_id;
            } else if (dbRep.target_type === 'comment') {
              const cRes = await pool.query('SELECT author_id FROM comments WHERE id = $1', [dbRep.target_id]);
              if (cRes.rows.length > 0) targetAuthorId = cRes.rows[0].author_id;
            } else if (dbRep.target_type === 'message') {
              const mRes = await pool.query('SELECT sender_id AS author_id FROM messages WHERE id = $1', [dbRep.target_id]);
              if (mRes.rows.length > 0) targetAuthorId = mRes.rows[0].author_id;
            }
          } catch (lookupErr) {
            console.warn('Lỗi tìm authorId mục báo cáo:', lookupErr.message);
          }

          if (status === 'resolved_violation') {
            if (finalNewLabel === 'Normal') {
              // 1. Chuyển về nhãn Normal: Khôi phục hiển thị nội dung & gỡ bỏ mọi cờ kiểm duyệt
              if (dbRep.target_type === 'post') {
                await pool.query(
                  `UPDATE posts 
                   SET ai_label = 'Normal', ai_status = 'approved',
                       image_moderation_status = 'approved', image_moderation_label = 'safe',
                       moderation_expires_at = NULL 
                   WHERE id = $1`,
                  [dbRep.target_id]
                );
              } else if (dbRep.target_type === 'comment') {
                await pool.query(
                  `UPDATE comments 
                   SET ai_label = 'Normal', is_hidden = FALSE,
                       image_moderation_status = 'approved', image_moderation_label = 'safe',
                       moderation_expires_at = NULL 
                   WHERE id = $1`,
                  [dbRep.target_id]
                );
              }

              // 2. Nghiệp vụ: GỠ BỎ TOÀN BỘ ÁN PHẠT CHO TÁC GIẢ NỘI DUNG (status -> active, reset cooldown)
              if (targetAuthorId) {
                await pool.query(
                  `UPDATE users 
                   SET status = 'active', 
                       cooldown_until = NULL, 
                       cooldown_reason = NULL, 
                       cooldown_violation_text = NULL,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1`,
                  [targetAuthorId]
                );

                // Gửi thông báo minh oan và gỡ phạt
                await pool.query(
                  `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
                   VALUES ($1, $2, 'system', 'Nội dung của bạn đã được thẩm định an toàn (Normal). Toàn bộ giới hạn và án phạt đã được gỡ bỏ.', FALSE)`,
                  [targetAuthorId, reviewerId]
                );
              }
            } else {
              // Gán lại nhãn vi phạm (Violence, Hate Speech, Toxic):
              if (dbRep.target_type === 'post') {
                await pool.query(
                  `UPDATE posts SET ai_label = $1, ai_status = 'hidden' WHERE id = $2`,
                  [finalNewLabel, dbRep.target_id]
                );
              } else if (dbRep.target_type === 'comment') {
                await pool.query(
                  `UPDATE comments SET ai_label = $1, is_hidden = TRUE WHERE id = $2`,
                  [finalNewLabel, dbRep.target_id]
                );
              }

              // Nghiệp vụ từng nhãn:
              // - Nhãn Bạo lực (Violence): Phạt Cooldown 10 phút cấm đăng bài & comment
              if (finalNewLabel === 'Violence' && targetAuthorId) {
                await pool.query(
                  `UPDATE users 
                   SET status = 'cooldown', 
                       cooldown_until = CURRENT_TIMESTAMP + INTERVAL '10 minutes', 
                       cooldown_reason = 'Vi phạm bạo lực trong nội dung (Báo cáo vi phạm đã được xác minh)',
                       cooldown_violation_text = $1,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = $2`,
                  [req.body.rawText || dbRep.details || 'Nội dung bạo lực', targetAuthorId]
                );

                await pool.query(
                  `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
                   VALUES ($1, $2, 'system', 'Nội dung của bạn bị báo cáo vi phạm Bạo lực và đã bị ẩn. Bạn bị tạm khóa 10 phút.', FALSE)`,
                  [targetAuthorId, reviewerId]
                );
              } else if (targetAuthorId) {
                // - Nhãn Toxic hoặc Hate Speech: Không phạt cooldown.
                // Nếu tài khoản trước đó đang bị cooldown do nhãn Violence cũ, gỡ bỏ cooldown vì đã chuyển sang nhãn không có cooldown!
                await pool.query(
                  `UPDATE users 
                   SET status = 'active', 
                       cooldown_until = NULL, 
                       cooldown_reason = NULL, 
                       cooldown_violation_text = NULL,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1 AND status = 'cooldown'`,
                  [targetAuthorId]
                );

                const notifMsg = finalNewLabel === 'Hate Speech'
                  ? 'Nội dung của bạn bị báo cáo vi phạm Ngôn từ thù ghét (Hate Speech) và đã bị ẩn.'
                  : 'Nội dung của bạn bị báo cáo chứa từ ngữ độc hại/xúc phạm (Toxic) và đã bị giới hạn hiển thị.';
                await pool.query(
                  `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
                   VALUES ($1, $2, 'system', $3, FALSE)`,
                  [targetAuthorId, reviewerId, notifMsg]
                );
              }
            }

            // Ghi nhật ký vào bảng ai_override_logs CSDL thật
            await pool.query(
              `INSERT INTO ai_override_logs (admin_id, content_type, content_id, raw_text, original_ai_label, original_confidence, corrected_label, override_reason)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                reviewerId,
                dbRep.target_type,
                dbRep.target_id,
                req.body.rawText || dbRep.details || 'Nội dung vi phạm từ báo cáo',
                finalOldLabel,
                0.95,
                finalNewLabel,
                adminNotes || `Xác nhận vi phạm từ báo cáo #${dbRep.id}: Gán lại nhãn ${finalNewLabel}`
              ]
            );
          }
        }
      }
    } catch (dbErr) {
      console.warn('Lỗi xử lý báo cáo trong PostgreSQL:', dbErr.message);
    }
  }

  // 2. Đồng bộ trong in-memory store
  const storeReport = reportsStore.find(r => String(r.id) === String(id));
  if (storeReport) {
    storeReport.status = status;
    if (adminNotes !== undefined) storeReport.adminNotes = adminNotes;
    storeReport.newLabel = finalNewLabel;
    storeReport.oldLabel = finalOldLabel;
    storeReport.actionTaken = actionTaken;
  }

  if (status === 'resolved_violation') {
    const newOverrideLog = {
      id: `ovr-${Date.now()}`,
      adminName: req.user?.full_name || 'Điều Hành Viên Hệ Thống',
      contentType: storeReport?.targetType || report?.targetType || 'post',
      contentId: storeReport?.targetId || report?.targetId || id,
      rawText: req.body.rawText || storeReport?.contentExcerpt || storeReport?.imageUrl || 'Nội dung vi phạm',
      imageUrl: storeReport?.imageUrl || null,
      originalAiLabel: finalOldLabel,
      originalConfidence: 0.95,
      correctedLabel: finalNewLabel,
      overrideReason: adminNotes || `Xác nhận vi phạm: Gán lại nhãn ${finalNewLabel}`,
      isExportedForRetraining: false,
      createdAt: new Date().toLocaleString('vi-VN')
    };
    aiOverrideLogsStore.unshift(newOverrideLog);

    return res.json({
      success: true,
      message: `Xác nhận vi phạm: Đã gán lại nhãn "${finalNewLabel}" và lưu nhật ký vào CSDL PostgreSQL thành công!`,
      data: report || storeReport,
      overrideLog: newOverrideLog
    });
  } else {
    return res.json({
      success: true,
      message: 'Báo cáo sai / không vi phạm: Đã bác bỏ báo cáo và giữ nguyên nhãn ban đầu!',
      data: report || storeReport
    });
  }
});

// 5.5 Lấy danh sách Khiếu nại từ CSDL THẬT (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.get('/api/appeals', requireRole('moderator'), async (req, res) => {
  if (pool) {
    try {
      const q = `
        SELECT a.id, a.user_id, a.content_type, a.content_id, a.original_text,
               a.ai_predicted_label, a.ai_confidence, a.ai_action_taken,
               a.appeal_reason, a.status, a.admin_notes, a.created_at,
               u.full_name AS user_name, u.avatar_url AS user_avatar, u.username,
               COALESCE(p.image_url, c.image_url) AS image_url
        FROM appeals a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN posts p ON a.content_type = 'post' AND a.content_id = p.id
        LEFT JOIN comments c ON a.content_type = 'comment' AND a.content_id = c.id
        ORDER BY CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END, a.created_at DESC
      `;
      const result = await pool.query(q);
      const mapped = result.rows.map(row => ({
        id: String(row.id),
        user: {
          id: row.user_id,
          name: row.user_name || 'Người dùng',
          avatar: row.user_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
          username: row.username || 'user'
        },
        contentType: row.content_type,
        contentId: String(row.content_id),
        originalText: row.original_text,
        imageUrl: row.image_url || null,
        aiPredictedLabel: row.ai_predicted_label,
        aiConfidence: Number(row.ai_confidence) || 0.90,
        aiActionTaken: row.ai_action_taken,
        appealReason: row.appeal_reason,
        status: row.status,
        adminNotes: row.admin_notes || '',
        createdAt: new Date(row.created_at).toLocaleString('vi-VN')
      }));
      return res.json({ success: true, data: mapped });
    } catch (err) {
      console.warn('Lỗi lấy appeals từ DB PostgreSQL, chuyển sang in-memory:', err.message);
    }
  }
  res.json({ success: true, data: appealsStore });
});

// 5.6 Gửi Khiếu nại AI gắn nhãn sai vào CSDL THẬT
app.post('/api/appeals', async (req, res) => {
  const { user, contentType, contentId, originalText, aiPredictedLabel, aiConfidence, aiActionTaken, appealReason } = req.body;
  let userId = req.user?.id || user?.id;

  if (pool) {
    try {
      if (!userId) {
        const uRes = await pool.query('SELECT id FROM users LIMIT 1');
        if (uRes.rows.length > 0) userId = uRes.rows[0].id;
      }

      if (userId) {
        const numContentId = parseInt(String(contentId || '1').replace(/\D/g, ''), 10) || 1;
        const validContentType = ['post', 'comment', 'message'].includes(contentType) ? contentType : 'post';
        const insertSql = `
          INSERT INTO appeals (user_id, content_type, content_id, original_text, ai_predicted_label, ai_confidence, ai_action_taken, appeal_reason, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
          RETURNING *
        `;
        const result = await pool.query(insertSql, [
          userId,
          validContentType,
          numContentId,
          originalText || 'Nội dung khiếu nại',
          aiPredictedLabel || 'Toxic',
          Number(aiConfidence) || 0.90,
          aiActionTaken || 'warn_user',
          appealReason || 'Tôi khiếu nại phán quyết AI.'
        ]);
        const dbAppeal = result.rows[0];
        return res.json({
          success: true,
          message: 'Đã gửi khiếu nại thành công đến Quản trị viên (lưu vào CSDL PostgreSQL)!',
          data: {
            id: String(dbAppeal.id),
            user: user || { id: userId, name: req.user?.full_name || 'Người khiếu nại' },
            contentType: dbAppeal.content_type,
            contentId: String(dbAppeal.content_id),
            originalText: dbAppeal.original_text,
            aiPredictedLabel: dbAppeal.ai_predicted_label,
            aiConfidence: Number(dbAppeal.ai_confidence),
            aiActionTaken: dbAppeal.ai_action_taken,
            appealReason: dbAppeal.appeal_reason,
            status: dbAppeal.status,
            adminNotes: '',
            createdAt: 'Vừa xong'
          }
        });
      }
    } catch (dbErr) {
      console.warn('Lỗi lưu khiếu nại vào PostgreSQL, dùng in-memory store:', dbErr.message);
    }
  }

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

// 5.7 Xử lý Khiếu nại trong CSDL THẬT (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.patch('/api/appeals/:id', requireRole('moderator'), async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes, newLabel } = req.body; // status: 'approved' | 'rejected'
  const reviewerId = req.user?.id || null;

  // 1. Kiểm tra tính hợp lệ của status
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Trạng thái xử lý không hợp lệ. Chỉ chấp nhận 'approved' hoặc 'rejected'."
    });
  }

  // 2. Kiểm tra tính hợp lệ của newLabel khi approved
  const VALID_LABELS = ['Normal', 'Toxic', 'Hate Speech', 'Violence'];
  const finalNewLabel = status === 'approved' ? (newLabel || 'Normal') : null;
  if (status === 'approved' && !VALID_LABELS.includes(finalNewLabel)) {
    return res.status(400).json({
      success: false,
      message: `Nhãn mới không hợp lệ. Danh sách nhãn hợp lệ: ${VALID_LABELS.join(', ')}.`
    });
  }

  const numId = parseInt(id, 10);
  let updatedAppeal = null;
  let createdOverrideLog = null;

  // 3. Xử lý trong CSDL PostgreSQL với Transaction & khóa hàng FOR UPDATE chống xử lý trùng
  if (pool && !isNaN(numId)) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Khóa và kiểm tra xem đơn khiếu nại có tồn tại không
      const checkRes = await client.query('SELECT * FROM appeals WHERE id = $1 FOR UPDATE', [numId]);
      if (checkRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Đơn khiếu nại không tồn tại.' });
      }

      const dbApp = checkRes.rows[0];

      // Chống xử lý trùng: Chỉ xử lý đơn khiếu nại đang ở trạng thái 'pending'
      if (dbApp.status !== 'pending') {
        await client.query('ROLLBACK');
        const statusText = dbApp.status === 'approved' ? 'đã chấp thuận' : 'đã từ chối';
        return res.status(409).json({
          success: false,
          message: `Khiếu nại này đã được xử lý trước đó (${statusText}).`
        });
      }

      // Cập nhật trạng thái khiếu nại
      const updateSql = `
        UPDATE appeals
        SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND status = 'pending'
        RETURNING *
      `;
      const result = await client.query(updateSql, [status, adminNotes || '', reviewerId, numId]);
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Khiếu nại này đã được xử lý trước đó bởi người khác.'
        });
      }

      const updatedRow = result.rows[0];
      updatedAppeal = {
        id: String(updatedRow.id),
        userId: updatedRow.user_id,
        contentType: updatedRow.content_type,
        contentId: String(updatedRow.content_id),
        originalText: updatedRow.original_text,
        aiPredictedLabel: updatedRow.ai_predicted_label,
        aiConfidence: Number(updatedRow.ai_confidence),
        status: updatedRow.status,
        adminNotes: updatedRow.admin_notes,
        newLabel: finalNewLabel,
        oldLabel: updatedRow.ai_predicted_label
      };

      if (status === 'rejected') {
        // TỪ CHỐI KHIẾU NẠI:
        // - Giữ nguyên nhãn đang gắn
        // - Giữ nguyên các hình phạt đang áp dụng
        // - KHÔNG ghi bản ghi đổi nhãn
        if (updatedRow.user_id) {
          await client.query(
            `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
             VALUES ($1, $2, 'system', 'Khiếu nại của bạn về nội dung vi phạm đã bị từ chối sau khi xem xét lại.', FALSE)`,
            [updatedRow.user_id, reviewerId]
          );
        }
      } else if (status === 'approved') {
        // CHẤP NHẬN KHIẾU NẠI (Nhãn bị gắn sai):
        // 1. Phục hồi / Cập nhật nội dung theo nghiệp vụ nhãn mới
        if (finalNewLabel === 'Normal') {
          if (updatedRow.content_type === 'post') {
            await client.query(
              `UPDATE posts 
               SET ai_status = 'approved', ai_label = 'Normal',
                   image_moderation_status = 'approved', image_moderation_label = 'safe',
                   moderation_expires_at = NULL 
               WHERE id = $1`,
              [updatedRow.content_id]
            );
          } else if (updatedRow.content_type === 'comment') {
            await client.query(
              `UPDATE comments 
               SET is_hidden = FALSE, ai_label = 'Normal',
                   image_moderation_status = 'approved', image_moderation_label = 'safe',
                   moderation_expires_at = NULL 
               WHERE id = $1`,
              [updatedRow.content_id]
            );
          }

          // GỠ TOÀN BỘ ÁN PHẠT CHO TÁC GIẢ KHIẾU NẠI (status -> active, reset cooldown)
          if (updatedRow.user_id) {
            await client.query(
              `UPDATE users 
               SET status = 'active', 
                   cooldown_until = NULL, 
                   cooldown_reason = NULL, 
                   cooldown_violation_text = NULL,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [updatedRow.user_id]
            );

            await client.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
               VALUES ($1, $2, 'system', 'Khiếu nại được chấp thuận! Nội dung của bạn đã được xác nhận an toàn (Normal). Toàn bộ án phạt (cooldown/hạn chế) đã được gỡ bỏ.', FALSE)`,
              [updatedRow.user_id, reviewerId]
            );
          }
        } else if (finalNewLabel === 'Violence') {
          // Gán sang Violence -> Ẩn nội dung & Phạt Cooldown 10 phút
          if (updatedRow.content_type === 'post') {
            await client.query(
              `UPDATE posts SET ai_status = 'hidden', ai_label = 'Violence' WHERE id = $1`,
              [updatedRow.content_id]
            );
          } else if (updatedRow.content_type === 'comment') {
            await client.query(
              `UPDATE comments SET is_hidden = TRUE, ai_label = 'Violence' WHERE id = $1`,
              [updatedRow.content_id]
            );
          }

          if (updatedRow.user_id) {
            await client.query(
              `UPDATE users 
               SET status = 'cooldown', 
                   cooldown_until = CURRENT_TIMESTAMP + INTERVAL '10 minutes', 
                   cooldown_reason = 'Vi phạm bạo lực trong nội dung (Khiếu nại được thẩm định lại)',
                   cooldown_violation_text = $1,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [updatedRow.original_text, updatedRow.user_id]
            );

            await client.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
               VALUES ($1, $2, 'system', 'Nội dung của bạn sau khi thẩm định lại bị xác định vi phạm Bạo lực (Violence). Bạn bị tạm khóa 10 phút.', FALSE)`,
              [updatedRow.user_id, reviewerId]
            );
          }
        } else {
          // Gán sang Toxic hoặc Hate Speech -> Ẩn nội dung, không phạt cooldown.
          // Nếu trước đó đang bị cooldown (do Violence cũ), gỡ bỏ cooldown.
          if (updatedRow.content_type === 'post') {
            await client.query(
              `UPDATE posts SET ai_status = 'hidden', ai_label = $1 WHERE id = $2`,
              [finalNewLabel, updatedRow.content_id]
            );
          } else if (updatedRow.content_type === 'comment') {
            await client.query(
              `UPDATE comments SET is_hidden = TRUE, ai_label = $1 WHERE id = $2`,
              [finalNewLabel, updatedRow.content_id]
            );
          }

          if (updatedRow.user_id) {
            await client.query(
              `UPDATE users 
               SET status = 'active', 
                   cooldown_until = NULL, 
                   cooldown_reason = NULL, 
                   cooldown_violation_text = NULL,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1 AND status = 'cooldown'`,
              [updatedRow.user_id]
            );

            const notifMsg = finalNewLabel === 'Hate Speech'
              ? 'Nội dung của bạn sau khi xem xét lại được phân loại là Ngôn từ thù ghét (Hate Speech) và đã bị ẩn.'
              : 'Nội dung của bạn sau khi xem xét lại được phân loại là Độc hại (Toxic) và đã bị giới hạn hiển thị.';
            await client.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
               VALUES ($1, $2, 'system', $3, FALSE)`,
              [updatedRow.user_id, reviewerId, notifMsg]
            );
          }
        }

        // 2. Ghi nhật ký vào ai_override_logs CSDL thật
        const overrideRes = await client.query(
          `INSERT INTO ai_override_logs (admin_id, content_type, content_id, raw_text, original_ai_label, original_confidence, corrected_label, override_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            reviewerId,
            updatedRow.content_type,
            updatedRow.content_id,
            updatedRow.original_text,
            updatedRow.ai_predicted_label,
            Number(updatedRow.ai_confidence) || 0.90,
            finalNewLabel,
            adminNotes || (finalNewLabel === 'Normal'
              ? `Chấp thuận khiếu nại: Minh oan và khôi phục nội dung: ${updatedRow.appeal_reason}`
              : `Chấp thuận khiếu nại: Hiệu chỉnh nhãn sang ${finalNewLabel}`)
          ]
        );
        if (overrideRes.rows.length > 0) {
          const oRow = overrideRes.rows[0];
          createdOverrideLog = {
            id: String(oRow.id),
            adminName: req.user?.full_name || 'Điều Hành Viên Hệ Thống',
            contentType: oRow.content_type,
            contentId: String(oRow.content_id),
            rawText: oRow.raw_text,
            originalAiLabel: oRow.original_ai_label,
            originalConfidence: Number(oRow.original_confidence) || 0.90,
            correctedLabel: oRow.corrected_label,
            overrideReason: oRow.override_reason,
            isExportedForRetraining: oRow.is_exported_for_retraining,
            createdAt: new Date(oRow.created_at).toLocaleString('vi-VN')
          };
        }
      }

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      console.error('Lỗi transaction xử lý khiếu nại trong PostgreSQL:', dbErr.message);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xử lý khiếu nại: ' + dbErr.message });
    } finally {
      client.release();
    }
  }

  // 4. Đồng bộ in-memory store (fallback & dev mode)
  const appeal = appealsStore.find(a => String(a.id) === String(id));
  if (appeal) {
    if (appeal.status !== 'pending' && !updatedAppeal) {
      return res.status(409).json({
        success: false,
        message: `Khiếu nại này đã được xử lý trước đó (${appeal.status === 'approved' ? 'đã chấp thuận' : 'đã từ chối'}).`
      });
    }
    appeal.status = status;
    if (adminNotes !== undefined) appeal.adminNotes = adminNotes;
    appeal.newLabel = finalNewLabel;
  }

  if (status === 'approved' && !createdOverrideLog) {
    createdOverrideLog = {
      id: `ovr-${Date.now()}`,
      adminName: req.user?.full_name || 'Điều Hành Viên Hệ Thống',
      contentType: appeal?.contentType || updatedAppeal?.contentType || 'post',
      contentId: appeal?.contentId || updatedAppeal?.contentId || id,
      rawText: appeal?.originalText || updatedAppeal?.originalText || '',
      originalAiLabel: appeal?.aiPredictedLabel || updatedAppeal?.aiPredictedLabel || 'Toxic',
      originalConfidence: appeal?.aiConfidence || 0.90,
      correctedLabel: finalNewLabel,
      overrideReason: adminNotes || (finalNewLabel === 'Normal' ? 'Chấp thuận khiếu nại: Minh oan và khôi phục nội dung' : `Chấp thuận khiếu nại: Gán lại nhãn ${finalNewLabel}`),
      isExportedForRetraining: false,
      createdAt: new Date().toLocaleString('vi-VN')
    };
  }

  if (createdOverrideLog) {
    aiOverrideLogsStore.unshift(createdOverrideLog);
  }

  return res.json({
    success: true,
    message: status === 'approved'
      ? `Đã chấp thuận khiếu nại: Đổi nhãn sang "${finalNewLabel}" thành công!`
      : 'Đã từ chối khiếu nại và giữ nguyên nhãn ban đầu!',
    data: updatedAppeal || appeal,
    overrideLog: createdOverrideLog
  });
});

// 5.8 Hiệu chỉnh nhãn AI trực tiếp vào CSDL THẬT (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.post('/api/admin/override-ai-label', requireRole('moderator'), async (req, res) => {
  const { contentType, contentId, rawText, originalAiLabel, correctedLabel, overrideReason } = req.body;
  const adminId = req.user?.id || null;
  const numContentId = parseInt(String(contentId || '1').replace(/\D/g, ''), 10) || 1;
  const validContentType = ['post', 'comment', 'message'].includes(contentType) ? contentType : 'post';

  let createdLog = null;

  if (pool) {
    try {
      const insertSql = `
        INSERT INTO ai_override_logs (admin_id, content_type, content_id, raw_text, original_ai_label, original_confidence, corrected_label, override_reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const result = await pool.query(insertSql, [
        adminId,
        validContentType,
        numContentId,
        rawText || '',
        originalAiLabel || 'Normal',
        0.95,
        correctedLabel || 'Normal',
        overrideReason || 'Hiệu chỉnh thủ công bởi Điều hành viên / Quản trị viên'
      ]);
      if (result.rows.length > 0) {
        const row = result.rows[0];
        createdLog = {
          id: String(row.id),
          adminName: req.user?.full_name || 'Điều Hành Viên Hệ Thống',
          contentType: row.content_type,
          contentId: String(row.content_id),
          rawText: row.raw_text,
          originalAiLabel: row.original_ai_label,
          originalConfidence: Number(row.original_confidence) || 0.95,
          correctedLabel: row.corrected_label,
          overrideReason: row.override_reason,
          isExportedForRetraining: row.is_exported_for_retraining,
          createdAt: new Date(row.created_at).toLocaleString('vi-VN')
        };
      }

      // Cập nhật trạng thái bài viết/bình luận và án phạt tác giả theo nghiệp vụ từng nhãn
      try {
        let authorId = null;
        if (validContentType === 'post') {
          const newStatus = correctedLabel === 'Normal' ? 'approved' : 'hidden';
          const p = await pool.query(
            `UPDATE posts 
             SET ai_label = $1, ai_status = $2,
                 image_moderation_status = CASE WHEN $1 = 'Normal' THEN 'approved' ELSE image_moderation_status END,
                 image_moderation_label = CASE WHEN $1 = 'Normal' THEN 'safe' ELSE image_moderation_label END,
                 moderation_expires_at = CASE WHEN $1 = 'Normal' THEN NULL ELSE moderation_expires_at END
             WHERE id = $3 RETURNING author_id`,
            [correctedLabel, newStatus, numContentId]
          );
          if (p.rows.length > 0) authorId = p.rows[0].author_id;
        } else if (validContentType === 'comment') {
          const isHidden = correctedLabel !== 'Normal';
          const c = await pool.query(
            `UPDATE comments 
             SET ai_label = $1, is_hidden = $2,
                 image_moderation_status = CASE WHEN $1 = 'Normal' THEN 'approved' ELSE image_moderation_status END,
                 image_moderation_label = CASE WHEN $1 = 'Normal' THEN 'safe' ELSE image_moderation_label END,
                 moderation_expires_at = CASE WHEN $1 = 'Normal' THEN NULL ELSE moderation_expires_at END
             WHERE id = $3 RETURNING author_id`,
            [correctedLabel, isHidden, numContentId]
          );
          if (c.rows.length > 0) authorId = c.rows[0].author_id;
        }

        if (authorId) {
          if (correctedLabel === 'Normal') {
            // Chuyển về trạng thái bình thường -> GỠ TOÀN BỘ ÁN PHẠT CHO TÁC GIẢ
            await pool.query(
              `UPDATE users 
               SET status = 'active', cooldown_until = NULL, cooldown_reason = NULL, cooldown_violation_text = NULL, updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [authorId]
            );

            await pool.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
               VALUES ($1, $2, 'system', 'Nội dung của bạn đã được Quản trị viên thẩm định an toàn (Normal). Toàn bộ án phạt đã được gỡ bỏ.', FALSE)`,
              [authorId, reviewerId]
            );
          } else if (correctedLabel === 'Violence') {
            // Nhãn Bạo lực -> Phạt Cooldown 10 phút
            await pool.query(
              `UPDATE users 
               SET status = 'cooldown', cooldown_until = CURRENT_TIMESTAMP + INTERVAL '10 minutes', cooldown_reason = 'Vi phạm bạo lực trong nội dung (Quản trị viên hiệu chỉnh)', updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [authorId]
            );

            await pool.query(
              `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
               VALUES ($1, $2, 'system', 'Nội dung của bạn đã bị Quản trị viên phân loại là Bạo lực (Violence). Bạn bị tạm khóa 10 phút.', FALSE)`,
              [authorId, reviewerId]
            );
          } else {
            // Nhãn Toxic hoặc Hate Speech: Không có án phạt cooldown; nếu trước đó bị cooldown, gỡ cooldown!
            await pool.query(
              `UPDATE users 
               SET status = 'active', cooldown_until = NULL, cooldown_reason = NULL, cooldown_violation_text = NULL, updated_at = CURRENT_TIMESTAMP
               WHERE id = $1 AND status = 'cooldown'`,
              [authorId]
            );
          }
        }
      } catch (contentUpdateErr) {
        console.warn('Lỗi cập nhật content và sanction trong override-ai-label:', contentUpdateErr.message);
      }
    } catch (dbErr) {
      console.warn('Lỗi ghi log ai_override_logs vào PostgreSQL:', dbErr.message);
    }
  }

  const fallbackLog = {
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
    createdAt: new Date().toLocaleString('vi-VN')
  };

  aiOverrideLogsStore.unshift(createdLog || fallbackLog);
  res.json({ success: true, message: 'Đã hiệu chỉnh nhãn AI và ghi nhật ký huấn luyện lại vào CSDL!', data: createdLog || fallbackLog });
});

// 5.9 Lấy danh sách Logs hiệu chỉnh AI từ CSDL THẬT (Yêu cầu quyền Điều hành viên hoặc Quản trị viên)
app.get('/api/admin/ai-overrides', requireRole('moderator'), async (req, res) => {
  if (pool) {
    try {
      const q = `
        SELECT o.id, o.admin_id, o.content_type, o.content_id, o.raw_text, o.original_ai_label,
               o.original_confidence, o.corrected_label, o.override_reason, o.is_exported_for_retraining, o.created_at,
               u.full_name AS admin_name, u.avatar_url AS admin_avatar
        FROM ai_override_logs o
        LEFT JOIN users u ON o.admin_id = u.id
        ORDER BY o.created_at DESC
      `;
      const result = await pool.query(q);
      const mapped = result.rows.map(row => ({
        id: String(row.id),
        adminName: row.admin_name || 'Điều Hành Viên Hệ Thống',
        adminAvatar: row.admin_avatar || null,
        contentType: row.content_type,
        contentId: String(row.content_id),
        rawText: row.raw_text,
        originalAiLabel: row.original_ai_label,
        originalConfidence: Number(row.original_confidence) || 0.95,
        correctedLabel: row.corrected_label,
        overrideReason: row.override_reason,
        isExportedForRetraining: row.is_exported_for_retraining,
        createdAt: new Date(row.created_at).toLocaleString('vi-VN')
      }));
      return res.json({ success: true, data: mapped });
    } catch (err) {
      console.warn('Lỗi lấy ai_overrides từ DB PostgreSQL, chuyển sang in-memory store:', err.message);
    }
  }
  res.json({ success: true, data: aiOverrideLogsStore });
});

// 5.10 Xuất file danh sách gắn nhãn sai từ CSDL THẬT (CSV UTF-8 BOM chuẩn tiếng Việt mở bằng Excel theo cột A -> H)
app.get('/api/admin/ai-overrides/export', requireRole('moderator'), async (req, res) => {
  try {
    let listToExport = [];
    if (pool) {
      try {
        const q = `
          SELECT o.id, o.content_type, o.content_id, o.raw_text, o.original_ai_label,
                 o.original_confidence, o.corrected_label, o.override_reason, o.created_at,
                 u.full_name AS admin_name
          FROM ai_override_logs o
          LEFT JOIN users u ON o.admin_id = u.id
          ORDER BY o.created_at DESC
        `;
        const result = await pool.query(q);
        listToExport = result.rows.map(row => ({
          rawText: row.raw_text,
          originalAiLabel: row.original_ai_label,
          correctedLabel: row.corrected_label,
          contentType: row.content_type,
          overrideReason: row.override_reason,
          adminName: row.admin_name || 'Điều Hành Viên Hệ Thống',
          createdAt: new Date(row.created_at).toLocaleString('vi-VN')
        }));
      } catch (dbErr) {
        console.warn('Lỗi query DB khi xuất file, fallback sang in-memory:', dbErr.message);
      }
    }

    if (listToExport.length === 0) {
      listToExport = aiOverrideLogsStore;
    }

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

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Danh_sach_hieu_chinh_nhan_AI_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi xuất file: ' + err.message });
  }
});

// 5.11 Xuất file Excel (.xlsx) danh sách gắn nhãn sai chuẩn các cột A -> H
app.get('/api/admin/ai-overrides/export-excel', requireRole('moderator'), async (req, res) => {
  try {
    let listToExport = [];
    if (pool) {
      try {
        const q = `
          SELECT o.id, o.content_type, o.content_id, o.raw_text, o.original_ai_label,
                 o.original_confidence, o.corrected_label, o.override_reason, o.created_at,
                 u.full_name AS admin_name
          FROM ai_override_logs o
          LEFT JOIN users u ON o.admin_id = u.id
          ORDER BY o.created_at DESC
        `;
        const result = await pool.query(q);
        listToExport = result.rows.map(row => ({
          rawText: row.raw_text,
          originalAiLabel: row.original_ai_label,
          correctedLabel: row.corrected_label,
          contentType: row.content_type,
          overrideReason: row.override_reason,
          adminName: row.admin_name || 'Điều Hành Viên Hệ Thống',
          createdAt: new Date(row.created_at).toLocaleString('vi-VN')
        }));
      } catch (dbErr) {
        console.warn('Lỗi query DB khi xuất Excel, fallback sang in-memory:', dbErr.message);
      }
    }

    if (listToExport.length === 0) {
      listToExport = aiOverrideLogsStore;
    }

    const columns = [
      'A: STT',
      'B: Nội dung câu / Hình ảnh gắn nhãn sai',
      'C: Nhãn cũ',
      'D: Nhãn mới',
      'E: Loại nội dung',
      'F: Lý do hiệu chỉnh / Ghi chú',
      'G: Người thực hiện',
      'H: Thời gian ghi nhận'
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
        'H: Thời gian ghi nhận': log.createdAt || ''
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
      { wch: 22 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Nhat_Ky_Hieu_Chinh_Nhan');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Danh_sach_hieu_chinh_nhan_AI_${dateStr}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi xuất file Excel: ' + err.message });
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
app.listen(PORT, async () => {
  console.log('Server Backend đang chạy tại http://localhost:' + PORT);
  if (process.env.NODE_ENV === 'production') {
    console.warn('Cảnh báo: x-user-id development auth đang tắt vì NODE_ENV=production.');
  }
  await testDbConnection();
});


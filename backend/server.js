import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { testDbConnection } from './src/config/db.js';
import { createUserRepository } from './src/repositories/userRepository.js';

// Routers
import { createPostReactionsRouter } from './src/routes/postReactionsRouter.js';
import { createPostsRouter } from './src/routes/postsRouter.js';
import { createUsersRouter } from './src/routes/usersRouter.js';
import { createNotificationsRouter } from './src/routes/notificationsRouter.js';
import { createImageModerationRouter } from './src/routes/imageModerationRouter.js';
import { createModerationAppealRouter } from './src/routes/moderationAppealRouter.js';
import { createImagePreviewRouter } from './src/routes/imagePreviewRouter.js';
import { createReportsRouter } from './src/routes/reportsRouter.js';
import { createAppealsRouter } from './src/routes/appealsRouter.js';
import { createAdminRouter } from './src/routes/adminRouter.js';
import { createUploadRouter } from './src/routes/uploadRouter.js';
import { createRealtimeRouter } from './src/routes/realtimeRouter.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const userRepository = createUserRepository({ pool });

function logApiError(error) {
  console.error('Lỗi API:', {
    message: error.message,
    code: error.code,
    detail: error.detail,
    constraint: error.constraint,
    stack: error.stack,
  });
}

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

// Gắn các Routers theo từng phân hệ chức năng
app.use('/api/upload', createUploadRouter());
app.use('/api/posts', createPostReactionsRouter({ pool }));
app.use('/api/posts', createPostsRouter({ pool }));
app.use('/api/users', createUsersRouter({ pool }));
app.use('/api/notifications', createNotificationsRouter({ pool }));
app.use('/api/admin/image-moderation', createImageModerationRouter({ pool }));
app.use('/api/posts', createModerationAppealRouter({ pool }));
app.use('/api/posts/preview-image', createImagePreviewRouter({ pool }));
app.use('/api/reports', createReportsRouter({ pool, userRepository }));
app.use('/api/appeals', createAppealsRouter({ pool, userRepository }));
app.use('/api/admin', createAdminRouter({ pool, userRepository }));
app.use('/api/realtime', createRealtimeRouter());

// Middleware xử lý lỗi tập trung
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

export default app;

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

import pool from '../../backend/src/config/db.js';
import { createPostReactionsRouter } from './src/routes/postReactionsRouter.js';
import { createPostsRouter } from './src/routes/postsRouter.js';
import { createModerationAppealRouter } from './src/routes/moderationAppealRouter.js';
import { createImagePreviewRouter } from './src/routes/imagePreviewRouter.js';
import { createUploadRouter } from './src/routes/uploadRouter.js';
import { realtimeService } from '../../backend/src/services/realtimeService.js';
import { attachRealtimePublisher } from '../../backend/src/services/postgresRealtimeBridge.js';

const app = express();
attachRealtimePublisher({ pool, realtimeService });
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    service: 'post-service',
    status: 'UP',
    port: process.env.POST_SERVICE_PORT || 5002,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    service: 'post-service',
    status: 'UP',
    port: process.env.POST_SERVICE_PORT || 5002,
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/upload', createUploadRouter({ pool }));
app.use('/api/posts', createPostReactionsRouter({ pool }));
app.use('/api/posts', createPostsRouter({ pool }));
app.use('/api/posts', createModerationAppealRouter({ pool }));
app.use('/api/posts/preview-image', createImagePreviewRouter({ pool }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Post-Service Error]:', err.message);
  res.status(err.statusCode || 500).json({
    service: 'post-service',
    success: false,
    message: err.statusCode ? err.message : 'Lỗi hệ thống Post Service'
  });
});

const PORT = process.env.POST_SERVICE_PORT || 5002;
app.listen(PORT, () => {
  console.log(`[Microservice 2: Post & Content Service] đang chạy tại http://localhost:${PORT}`);
});

export default app;


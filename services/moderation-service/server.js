import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

import pool from '../../backend/src/config/db.js';
import { createUserRepository } from '../../backend/src/repositories/userRepository.js';
import { createReportsRouter } from './src/routes/reportsRouter.js';
import { createAppealsRouter } from './src/routes/appealsRouter.js';
import { createAdminRouter } from './src/routes/adminRouter.js';
import { createImageModerationRouter } from './src/routes/imageModerationRouter.js';
import { realtimeService } from '../../backend/src/services/realtimeService.js';
import { attachRealtimePublisher } from '../../backend/src/services/postgresRealtimeBridge.js';

const app = express();
attachRealtimePublisher({ pool, realtimeService });
app.use(cors());
app.use(express.json());

const userRepository = createUserRepository({ pool });

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    service: 'moderation-service',
    status: 'UP',
    port: process.env.MODERATION_SERVICE_PORT || 5003,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    service: 'moderation-service',
    status: 'UP',
    port: process.env.MODERATION_SERVICE_PORT || 5003,
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/admin/image-moderation', createImageModerationRouter({ pool }));
app.use('/api/reports', createReportsRouter({ pool, userRepository }));
app.use('/api/appeals', createAppealsRouter({ pool, userRepository }));
app.use('/api/admin', createAdminRouter({ pool, userRepository }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Moderation-Service Error]:', err.message);
  res.status(err.statusCode || 500).json({
    service: 'moderation-service',
    success: false,
    message: err.statusCode ? err.message : 'Lỗi hệ thống Moderation Service'
  });
});

const PORT = process.env.MODERATION_SERVICE_PORT || 5003;
app.listen(PORT, () => {
  console.log(`[Microservice 3: Moderation & Trust Service] đang chạy tại http://localhost:${PORT}`);
});

export default app;


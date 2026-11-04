import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

import pool from '../../backend/src/config/db.js';
import { createNotificationsRouter } from './src/routes/notificationsRouter.js';
import { createRealtimeRouter } from './src/routes/realtimeRouter.js';
import { realtimeService } from '../../backend/src/services/realtimeService.js';
import { attachRealtimePublisher, startRealtimeListener } from '../../backend/src/services/postgresRealtimeBridge.js';

const app = express();
attachRealtimePublisher({ pool, realtimeService });
startRealtimeListener({ pool, realtimeService });
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    service: 'notification-service',
    status: 'UP',
    port: process.env.NOTIFICATION_SERVICE_PORT || 5004,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    service: 'notification-service',
    status: 'UP',
    port: process.env.NOTIFICATION_SERVICE_PORT || 5004,
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/notifications', createNotificationsRouter({ pool }));
app.use('/api/realtime', createRealtimeRouter());

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Notification-Service Error]:', err.message);
  res.status(err.statusCode || 500).json({
    service: 'notification-service',
    success: false,
    message: err.statusCode ? err.message : 'Lỗi hệ thống Notification Service'
  });
});

const PORT = process.env.NOTIFICATION_SERVICE_PORT || 5004;
app.listen(PORT, () => {
  console.log(`[Microservice 4: Notification & Realtime Service] đang chạy tại http://localhost:${PORT}`);
});

export default app;


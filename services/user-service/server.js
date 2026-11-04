import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

import pool from '../../backend/src/config/db.js';
import { createUsersRouter } from './src/routes/usersRouter.js';

const app = express();
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    service: 'user-service',
    status: 'UP',
    port: process.env.USER_SERVICE_PORT || 5001,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    service: 'user-service',
    status: 'UP',
    port: process.env.USER_SERVICE_PORT || 5001,
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/users', createUsersRouter({ pool }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[User-Service Error]:', err.message);
  res.status(err.statusCode || 500).json({
    service: 'user-service',
    success: false,
    message: err.statusCode ? err.message : 'Lỗi hệ thống User Service'
  });
});

const PORT = process.env.USER_SERVICE_PORT || 5001;
app.listen(PORT, () => {
  console.log(`[Microservice 1: User & Auth Service] đang chạy tại http://localhost:${PORT}`);
});

export default app;


import http from 'http';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findRouteTarget } from './src/routeMatcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tự động nạp .env bằng thư viện có sẵn của Node.js (Zero Dependencies)
try {
  const envPath = path.resolve(__dirname, '../backend/.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[match[1]] = value.trim();
      }
    }
  }
} catch (e) {}

const PORT = process.env.GATEWAY_PORT || 5000;

// Các URL có thể ghi đè theo môi trường (localhost khi chạy máy cá nhân,
// DNS service trong Docker Compose).
const SERVICE_URLS = {
  platform: process.env.PLATFORM_SERVICE_URL || 'http://127.0.0.1:8000',
  ai: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001',
  users: process.env.USER_SERVICE_URL || 'http://127.0.0.1:5001',
  posts: process.env.POST_SERVICE_URL || 'http://127.0.0.1:5002',
  moderation: process.env.MODERATION_SERVICE_URL || 'http://127.0.0.1:5003',
  realtime: process.env.REALTIME_SERVICE_URL || 'http://127.0.0.1:5004',
};

// Bảng định tuyến API. Các route cụ thể đặt trước route tổng quát.
const ROUTE_TARGETS = [
  { prefix: '/api/v1/moderate', target: SERVICE_URLS.ai, name: 'AI Inference Service (FastAPI)' },
  { prefix: '/api/moderate', target: SERVICE_URLS.ai, name: 'AI Inference Service (FastAPI)' },
  { prefix: '/api/v1/auth', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI; auth owner)' },
  { prefix: '/api/v1/friends', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI)' },
  { prefix: '/api/v1/messages', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI; message owner)' },
  { prefix: '/api/v1/settings', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI)' },
  { prefix: '/api/v1/search', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI)' },
  { prefix: '/api/v1/admin', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI; legacy admin aliases)' },
  { prefix: '/api/v1/reports', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI; legacy aliases)' },
  { prefix: '/api/v1/appeals', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI; legacy aliases)' },
  { prefix: '/api/auth', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI; auth owner)' },
  { prefix: '/api/friends', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI)' },
  { prefix: '/api/messages', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI; message owner)' },
  { prefix: '/api/settings', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI)' },
  { prefix: '/api/search', target: SERVICE_URLS.platform, name: 'Platform API (FastAPI)' },
  { prefix: '/api/users', target: SERVICE_URLS.users, name: 'User Service (Express; profile and role APIs)' },
  { prefix: '/api/posts', target: SERVICE_URLS.posts, name: 'Social Content Service (Express)' },
  { prefix: '/api/hashtags', target: SERVICE_URLS.posts, name: 'Social Content Service (Express; hashtags)' },
  { prefix: '/api/stories', target: SERVICE_URLS.posts, name: 'Social Content Service (Express; stories)' },
  { prefix: '/api/upload', target: SERVICE_URLS.posts, name: 'Social Content Service (Express; uploads)' },
  { prefix: '/api/reports', target: SERVICE_URLS.moderation, name: 'Moderation Service (Express; reports)' },
  { prefix: '/api/appeals', target: SERVICE_URLS.moderation, name: 'Moderation Service (Express; appeals)' },
  { prefix: '/api/admin', target: SERVICE_URLS.moderation, name: 'Moderation Service (Express; admin)' },
  { prefix: '/api/notifications', target: SERVICE_URLS.realtime, name: 'Realtime Service (Express; notifications)' },
  { prefix: '/api/realtime', target: SERVICE_URLS.realtime, name: 'Realtime Service (Express; SSE)' },
];

const SERVICES_HEALTH = [
  { name: 'User Service', url: `${SERVICE_URLS.users}/health`, port: 5001 },
  { name: 'Social Content Service', url: `${SERVICE_URLS.posts}/health`, port: 5002 },
  { name: 'Moderation Service', url: `${SERVICE_URLS.moderation}/health`, port: 5003 },
  { name: 'Realtime Service', url: `${SERVICE_URLS.realtime}/health`, port: 5004 },
  { name: 'Platform API (legacy combined FastAPI app)', url: `${SERVICE_URLS.platform}/api/health`, port: 8000 },
  { name: 'AI Inference Service', url: `${SERVICE_URLS.ai}/api/health`, port: 8001 },
];

function findTarget(url) {
  return findRouteTarget(url, ROUTE_TARGETS);
}

async function checkServiceHealth(svc) {
  const start = Date.now();
  try {
    const res = await fetch(svc.url, { signal: AbortSignal.timeout(1500) });
    const latency = Date.now() - start;
    if (res.ok) {
      return { service: svc.name, port: svc.port, status: 'UP', latency: `${latency}ms` };
    }
    return { service: svc.name, port: svc.port, status: 'DEGRADED', httpCode: res.status, latency: `${latency}ms` };
  } catch (err) {
    return { service: svc.name, port: svc.port, status: 'DOWN', error: err.message };
  }
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Endpoint tổng hợp trạng thái các Microservices
  if (req.url === '/api/health' || req.url === '/api/gateway/health') {
    checkAllHealth(res);
    return;
  }

  // 2. Endpoint danh mục định tuyến
  if (req.url === '/api/gateway/routes') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      gateway: 'NexusSocial API Gateway',
      version: '2.1.0-microservices',
      architecture: 'Microservices with explicit API ownership and shared PostgreSQL during migration',
      routes: ROUTE_TARGETS.map(({ prefix, target, name }) => ({ prefix, target, service: name }))
    }, null, 2));
    return;
  }

  // 3. Định tuyến Reverse Proxy đến Microservice đích
  const matched = findTarget(req.url);
  if (!matched) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      error: 'Not Found',
      message: `API Gateway: Không tìm thấy Microservice nào phụ trách tuyến đường '${req.url}'`,
      supportedRoutes: ROUTE_TARGETS.map(r => r.prefix)
    }));
    return;
  }

  proxyRequest(matched.target, req, res);
});

function proxyRequest(targetBaseUrl, req, res) {
  const targetUrl = new URL(req.url, targetBaseUrl);
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${targetUrl.hostname}:${targetUrl.port}`,
      'x-forwarded-host': req.headers.host,
      'x-forwarded-proto': 'http'
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Truyền tiếp toàn bộ headers từ service đích sang client
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    // Hỗ trợ truyền dữ liệu dạng luồng (Streaming / SSE / File Upload)
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Gateway Proxy Error] Không thể kết nối tới ${targetBaseUrl}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        error: 'Service Unavailable',
        message: `API Gateway: Dịch vụ đích tại ${targetBaseUrl} hiện chưa khởi động hoặc đang bận.`,
        detail: err.message
      }));
    }
  });

  req.pipe(proxyReq);
}

async function checkAllHealth(res) {
  const results = await Promise.all(SERVICES_HEALTH.map(checkServiceHealth));
  const isAllUp = results.every(r => r.status === 'UP');

  res.writeHead(isAllUp ? 200 : 207, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    gateway: {
      status: 'UP',
      port: PORT,
      timestamp: new Date().toISOString()
    },
    services: results,
    architecture: 'Shared PostgreSQL; FastAPI platform and AI boundaries are pending extraction'
  }, null, 2));
}

// Bắt lỗi ngắt kết nối client đột ngột (ECONNRESET / EPIPE) để Gateway không bao giờ bị crash
process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
    console.warn('⚠️ [Gateway] Bỏ qua lỗi ngắt kết nối socket client:', err.message);
    return;
  }
  console.error('[Gateway Uncaught Exception]:', err);
});

// WebSocket chat do Platform API/FastAPI quản lý. Từ chối upgrade ở path khác.
server.on('upgrade', (req, socket, head) => {
  // Lắng nghe lỗi trên client socket để tránh unhandled ECONNRESET làm sập Gateway
  socket.on('error', (err) => {
    if (err.code !== 'ECONNRESET') {
      console.warn('[Gateway Client Socket Error]:', err.message);
    }
  });

  const requestPath = new URL(req.url, 'http://gateway.local').pathname;
  if (!/^\/api(?:\/v1)?\/messages\/ws\//.test(requestPath)) {
    socket.destroy();
    return;
  }

  const target = new URL(SERVICE_URLS.platform);
  const targetPort = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
  const targetHost = target.hostname;

  let proxySocket = null;
  try {
    proxySocket = net.connect(targetPort, targetHost, () => {
      proxySocket.write(
        `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
        Object.keys(req.headers)
          .map(key => `${key}: ${req.headers[key]}`)
          .join('\r\n') +
        '\r\n\r\n'
      );
      proxySocket.write(head);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });

    proxySocket.on('error', (err) => {
      if (err.code !== 'ECONNRESET') {
        console.error('[Gateway WebSocket Error]:', err.message);
      }
      socket.destroy();
    });
  } catch (err) {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`[API GATEWAY] Đang chạy tại: http://localhost:${PORT}`);
  console.log(`Bảng tổng quan dịch vụ: http://localhost:${PORT}/api/gateway/routes`);
  console.log(`Kiểm tra sức khỏe hệ thống: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
});

export default server;

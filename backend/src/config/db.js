import pkg from 'pg';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Luon tim dung file .env tai thu muc backend/ bat ke chay tu dau (microservice hay monolith)
const __dbFilename = fileURLToPath(import.meta.url);
const __dbDirname = dirname(__dbFilename);
dotenv.config({ path: resolve(__dbDirname, '../../.env') });
dotenv.config(); // Fallback: thu them .env tai CWD

const { Pool } = pkg;

// Tự động gỡ bỏ dấu ngoặc vuông [ ] nếu vô tình giữ lại quanh password
const databaseUrl = process.env.DATABASE_URL?.replace(/:\s*\[([^\]]+)\]\s*@/, ':$1@');

/**
 * Kiểm tra hostname có phải local hoặc Docker nội bộ (mặc định không bật SSL).
 * @param {string} hostname
 * @returns {boolean}
 */
function isLocalOrDockerHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || !host.includes('.')) return true;
  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.startsWith('127.') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

/**
 * Xác định cấu hình SSL cho pg.Pool theo URL (tắt cho Docker/local và Supabase pooler 6543, bật cho remote Postgres).
 * @param {string | undefined} connectionString
 * @returns {false | { rejectUnauthorized: boolean }}
 */
export function resolveSslConfig(connectionString) {
  if (!connectionString) return false;
  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
    const sslParam = parsed.searchParams.get('ssl')?.toLowerCase();

    // Supabase Pooler (port 6543) KHÔNG hỗ trợ SSL, và tôn trọng cờ tắt SSL tường minh
    if (sslMode === 'disable' || sslParam === 'false' || sslParam === '0' || parsed.port === '6543') {
      return false;
    }
    if (
      sslParam === 'true' ||
      sslParam === '1' ||
      ['require', 'verify-ca', 'verify-full', 'no-verify'].includes(sslMode)
    ) {
      return { rejectUnauthorized: false };
    }
    return isLocalOrDockerHost(parsed.hostname) ? false : { rejectUnauthorized: false };
  } catch {
    const isNonSslFallback =
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1') ||
      connectionString.includes(':6543') ||
      connectionString.includes('sslmode=disable');
    return isNonSslFallback ? false : { rejectUnauthorized: false };
  }
}

function isLocalOrDockerUrl(connectionString) {
  if (!connectionString) return false;
  try {
    return isLocalOrDockerHost(new URL(connectionString).hostname);
  } catch {
    return connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  }
}

/**
 * Xác định kích thước pool tối đa (local/Docker dùng 10 cho mượt, Supabase/remote giữ 3 để tránh chạm trần).
 * @param {string | undefined} connectionString
 * @param {string | number | undefined} envMax
 * @returns {number}
 */
export function resolvePoolMax(connectionString, envMax = process.env.DB_POOL_MAX) {
  const parsedEnvMax = Number.parseInt(envMax, 10);
  if (Number.isFinite(parsedEnvMax) && parsedEnvMax > 0) {
    return parsedEnvMax;
  }
  return isLocalOrDockerUrl(connectionString) ? 10 : 3;
}

// Cấu hình kết nối PostgreSQL (remote/Supabase Direct yêu cầu SSL, local/Docker mặc định tắt)
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: resolveSslConfig(databaseUrl),
  connectionTimeoutMillis: 5000,     // Timeout kết nối 5 giây tránh treo vĩnh viễn trên CI
  idleTimeoutMillis: 10000,          // Giải phóng kết nối nhàn rỗi sau 10 giây
  max: resolvePoolMax(databaseUrl),  // Tự mở rộng pool cho local/Docker (10/service), giữ 3 với Supabase
  keepAlive: true,                   // Gửi TCP keep-alive để chống Supavisor đóng kết nối ngầm
  keepAliveInitialDelayMillis: 10000,
});

// Bắt lỗi trên idle client để không làm sập ứng dụng khi Supabase đóng kết nối nhàn rỗi
pool.on('error', (err) => {
  console.warn('⚠️ Cảnh báo kết nối CSDL Supabase (idle client):', err.message);
});

// Bọc pool.query với cơ chế tự động thử lại 1 lần nếu gặp lỗi rớt kết nối (ECONNRESET/closed socket)
const originalQuery = pool.query.bind(pool);
pool.query = async function (queryConfig, values) {
  try {
    return await originalQuery(queryConfig, values);
  } catch (err) {
    const isConnectionReset =
      err.code === 'ECONNRESET' ||
      err.code === 'EPIPE' ||
      err.code === '57P01' ||
      err.code === '08006' ||
      err.code === '08003' ||
      err.message?.includes('ECONNRESET') ||
      err.message?.includes('Connection terminated') ||
      err.message?.includes('Connection closed');

    if (isConnectionReset) {
      console.warn('⚠️ Phát hiện kết nối CSDL bị ngắt (ECONNRESET). Đang tự động kết nối lại và thử lại truy vấn...');
      return await originalQuery(queryConfig, values);
    }
    throw err;
  }
};

// Hàm kiểm tra kết nối khi khởi động server
export const testDbConnection = async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT current_database(), current_user, version()');
    console.log('✅ Đã kết nối thành công tới Database Supabase:', res.rows[0].current_database);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Lỗi kết nối Database Supabase:', err.message);
    return false;
  }
};

// Export pool để thực hiện các truy vấn SQL ở các file controller/service
export default pool;

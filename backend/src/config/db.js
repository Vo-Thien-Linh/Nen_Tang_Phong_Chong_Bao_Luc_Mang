import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Cấu hình kết nối PostgreSQL (Supabase yêu cầu SSL)
const pool = new Pool({
  // Tự động gỡ bỏ dấu ngoặc vuông [ ] nếu vô tình giữ lại quanh password
  connectionString: process.env.DATABASE_URL?.replace(/:\s*\[([^\]]+)\]\s*@/, ':$1@'),

  ssl: process.env.DATABASE_URL?.includes('localhost') 
    ? false 
    : { rejectUnauthorized: false }, // Cho phép kết nối SSL bảo mật tới Supabase
  connectionTimeoutMillis: 5000,     // Timeout kết nối 5 giây tránh treo vĩnh viễn trên CI
  idleTimeoutMillis: 10000,          // Giải phóng kết nối nhàn rỗi sau 10 giây
  max: 10,                           // Giới hạn pool kết nối an toàn cho Supabase
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

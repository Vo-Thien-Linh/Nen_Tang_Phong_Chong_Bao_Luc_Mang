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
});

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

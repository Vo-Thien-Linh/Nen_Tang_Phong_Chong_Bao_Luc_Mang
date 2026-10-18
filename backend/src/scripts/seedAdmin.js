import dotenv from 'dotenv';
import pool from '../config/db.js';

dotenv.config();

async function seedAdmin() {
  const targetEmail = (process.argv[2] || process.env.INITIAL_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  console.log('--- KHỞI TẠO TÀI KHOẢN ADMIN ĐẦU TIÊN ---');

  if (!targetEmail) {
    console.error('Lỗi: Chưa cung cấp email quản trị viên.');
    console.log('Cách dùng 1: Thêm INITIAL_ADMIN_EMAIL=<email> vào file .env');
    console.log('Cách dùng 2: Chạy lệnh: node src/scripts/seedAdmin.js <email>');
    
    // Kiểm tra xem hiện tại đã có admin nào chưa
    const existingAdmin = await pool.query("SELECT id, username, email, role FROM users WHERE LOWER(role) = 'admin' LIMIT 5");
    if (existingAdmin.rows.length > 0) {
      console.log('\nDanh sách các tài khoản admin hiện tại trong hệ thống:');
      console.table(existingAdmin.rows);
    } else {
      console.log('\nHiện hệ thống chưa có tài khoản admin nào.');
    }

    await pool.end();
    process.exit(1);
  }

  try {
    const userRes = await pool.query('SELECT id, username, email, role FROM users WHERE LOWER(email) = $1', [targetEmail]);
    if (userRes.rows.length === 0) {
      console.error(`Không tìm thấy người dùng với email "${targetEmail}" trong cơ sở dữ liệu.`);
      console.log('Vui lòng đảm bảo tài khoản đã đăng ký trên hệ thống trước khi gán quyền admin.');
      process.exit(1);
    }

    const user = userRes.rows[0];
    const oldRole = (user.role || 'user').toLowerCase();

    if (oldRole === 'admin') {
      console.log(`Tài khoản "${user.email}" (${user.username}) hiện đã là admin. Không cần thay đổi.`);
      process.exit(0);
    }

    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
    await pool.query(
      `INSERT INTO role_audit_logs (actor_id, target_user_id, old_role, new_role)
       VALUES ($1, $1, $2, 'admin')`,
      [user.id, oldRole]
    );

    console.log(`Đã nâng cấp tài khoản "${user.email}" (${user.username}) thành ADMIN thành công!`);
  } catch (error) {
    console.error('Lỗi khi nâng cấp tài khoản admin:', error.message);
  } finally {
    await pool.end();
  }
}

seedAdmin();

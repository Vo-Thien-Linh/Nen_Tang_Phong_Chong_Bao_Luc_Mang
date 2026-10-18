import pool from './src/config/db.js';

async function fixSequences() {
  try {
    const tables = ['reports', 'appeals', 'ai_override_logs', 'posts', 'comments'];
    for (const table of tables) {
      const q = `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM ${table}`;
      await pool.query(q);
      console.log(`Đã cập nhật sequence cho bảng: ${table}`);
    }
    console.log('Tất cả sequence đã được đồng bộ chuẩn xác!');
  } catch (err) {
    console.error('Lỗi cập nhật sequence:', err.message);
  } finally {
    await pool.end();
  }
}

fixSequences();

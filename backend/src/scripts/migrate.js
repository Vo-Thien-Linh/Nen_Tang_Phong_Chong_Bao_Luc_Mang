import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 Bắt đầu khởi tạo database trên Supabase...');
  try {
    const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
    const seedPath = path.resolve(__dirname, '../../../database/seed.sql');

    if (fs.existsSync(schemaPath)) {
      console.log('📦 Đang chạy schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('✅ schema.sql thành công!');
    }

    if (fs.existsSync(seedPath)) {
      console.log('🌱 Đang nạp dữ liệu mẫu seed.sql...');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await pool.query(seedSql);
      console.log('✅ seed.sql thành công!');
    }

    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
    console.log('🎉 Danh sách 12 bảng hiện tại trong Supabase:');
    console.table(res.rows);
  } catch (err) {
    console.error('❌ Lỗi migration:', err.message);
  } finally {
    await pool.end();
  }
}

runMigration();

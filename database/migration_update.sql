-- ========================================================
-- SCRIPT ĐỒNG BỘ CSDL LÊN SUPABASE (ĐÃ TỐI ƯU HÓA)
-- ========================================================

-- ========================================================
-- PHẦN 1: TẠO CỘT MỚI (CHẠY PHẦN NÀY ĐẦU TIÊN)
-- ========================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Thêm cột phone và status trực tiếp bằng lệnh native PostgreSQL
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- ========================================================
-- PHẦN 2: CẬP NHẬT DỮ LIỆU MẪU (CHẠY SAU KHI PHẦN 1 XONG)
-- ========================================================
UPDATE users SET phone = '0912345678', status = 'active' WHERE username = 'linh.vothien.16';
UPDATE users SET phone = '0909999999', status = 'active' WHERE username = 'admin_moderator';
UPDATE users SET phone = '0987654321', status = 'active' WHERE username = 'thutrang_le';
UPDATE users SET phone = '0933333333', status = 'active' WHERE username = 'nam_traveler';

-- Thêm tài khoản bị khóa mẫu (Mật khẩu: Password123)
INSERT INTO users (id, username, email, phone, status, password_hash, full_name, role, is_verified)
VALUES (
    'a0000000-0000-0000-0000-000000000004',
    'tuan_tran_ai',
    'tuan.tran.hack@darkmail.com',
    '0988888888',
    'banned',
    '$2b$12$T7WV8FtIRGpSXr6YJ.HU9ulm0mf3jVZbrUTOGYxljRPA5plNx.T3C',
    'Trần Minh Tuấn (Bị khóa)',
    'USER',
    FALSE
) ON CONFLICT (username) DO UPDATE 
SET phone = EXCLUDED.phone, status = EXCLUDED.status;

-- Xem lại kết quả cập nhật
SELECT username, email, phone, status, full_name FROM users;

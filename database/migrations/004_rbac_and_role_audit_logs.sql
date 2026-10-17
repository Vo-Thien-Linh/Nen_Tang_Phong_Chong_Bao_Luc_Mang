-- ========================================================
-- MIGRATION 004: PHÂN QUYỀN RBAC (USER / MODERATOR / ADMIN)
-- VÀ BẢNG NHẬT KÝ ĐỔI VAI TRÒ (ROLE AUDIT LOGS)
-- ========================================================

-- 1. Chuẩn hóa giá trị vai trò hiện tại sang chữ thường và cập nhật ràng buộc
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Cập nhật các dòng cũ: USER -> user, ADMIN -> admin, MODERATOR -> moderator
UPDATE users SET role = LOWER(role) WHERE role IS NOT NULL;
UPDATE users SET role = 'user' WHERE role IS NULL OR role NOT IN ('user', 'moderator', 'admin');

-- Đặt ràng buộc kiểm tra vai trò hợp lệ (chấp nhận cả chữ thường chuẩn và chữ hoa dự phòng)
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (LOWER(role) IN ('user', 'moderator', 'admin'));

-- Đặt giá trị mặc định cho cột role là 'user'
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';

-- 2. Tạo bảng ghi nhận lịch sử thay đổi vai trò (Role Audit Logs)
CREATE TABLE IF NOT EXISTS role_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_role VARCHAR(20) NOT NULL,
    new_role VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_role_audit_logs_actor ON role_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_logs_target ON role_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_logs_created_at ON role_audit_logs(created_at DESC);

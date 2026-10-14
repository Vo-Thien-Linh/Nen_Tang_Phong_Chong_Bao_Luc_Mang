-- ========================================================
-- MIGRATION 003: Hỗ trợ chức năng Chia sẻ bài viết
-- Thêm cột original_post_id vào bảng posts
-- Cho phép bài chia sẻ liên kết tới bài viết gốc
-- ========================================================

-- Khi bài gốc bị xóa, cột này sẽ tự động SET NULL
-- (bài chia sẻ vẫn tồn tại nhưng không còn liên kết bài gốc)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS original_post_id BIGINT REFERENCES posts(id) ON DELETE SET NULL;

-- Index hỗ trợ truy vấn "bài viết này đã được chia sẻ bao nhiêu lần"
CREATE INDEX IF NOT EXISTS idx_posts_original_post ON posts(original_post_id);

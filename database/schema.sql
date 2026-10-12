-- ========================================================
-- DATABASE SCHEMA: MẠNG XÃ HỘI NEXUSSOCIAL & KIỂM DUYỆT AI
-- Hệ quản trị CSDL: PostgreSQL 14+
-- ========================================================

-- Kích hoạt tiện ích tạo UUID ngẫu nhiên
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================================
-- 1. BẢNG USERS (Người dùng & Trang cá nhân)
-- ========================================================
CREATE TABLE IF NOT EXISTS users (
    -- 1. Bắt buộc để xác thực & định danh tài khoản
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'MODERATOR')), -- Phân quyền hệ thống: USER, ADMIN, MODERATOR

    -- 2. Ảnh mặc định hiển thị giao diện (để tránh lỗi ảnh vỡ khi chưa tải lên)
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    cover_url TEXT DEFAULT 'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?w=1200&auto=format&fit=crop&q=80',

    -- 3. Thông tin cá nhân / Profile (Hoàn toàn NULL khi tạo tài khoản)
    bio TEXT,
    location VARCHAR(100),
    hometown VARCHAR(100),
    education VARCHAR(150),
    high_school VARCHAR(150),
    relationship_status VARCHAR(50),

    -- 4. Trạng thái & Kiểm duyệt hệ thống
    phone VARCHAR(20) UNIQUE,   -- Số điện thoại (dùng để đăng nhập hoặc khôi phục)
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cooldown', 'banned')), -- Trạng thái tài khoản: active, cooldown, banned (bị khóa)
    is_verified BOOLEAN DEFAULT FALSE,
    cooldown_until TIMESTAMPTZ, -- Hạn xử phạt kiểm duyệt AI (NULL nếu không bị phạt)
    cooldown_reason TEXT,       -- Lý do xử phạt (Ví dụ: "Vi phạm ngôn từ thù địch / bạo lực")
    cooldown_violation_text TEXT, -- Trích dẫn câu nói / bài viết khiến tài khoản bị phạt
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);


-- ========================================================
-- 2. BẢNG POSTS (Bài viết)
-- ========================================================
CREATE TABLE IF NOT EXISTS posts (
    id BIGSERIAL PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    content TEXT NOT NULL,
    image_url TEXT,
    privacy VARCHAR(20) DEFAULT 'public', -- 'public', 'friends', 'private'
    
    -- Kiểm duyệt nội dung AI
    ai_label VARCHAR(50) DEFAULT 'Normal', -- 'Normal', 'Toxic', 'Violence', 'Hate Speech'
    ai_confidence NUMERIC(5, 4) DEFAULT 0.9900,
    ai_status VARCHAR(20) DEFAULT 'approved', -- 'approved', 'warned', 'hidden'
    
    -- Bộ đếm cache để truy vấn News Feed tốc độ cao
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    shares_count INT DEFAULT 0,
    reports_count INT DEFAULT 0, -- Số lượt bị người dùng báo cáo vi phạm
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts(created_at DESC);


-- ========================================================
-- 3. BẢNG COMMENTS (Bình luận bài viết)
-- ========================================================
CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE, -- Hỗ trợ trả lời bình luận
    content TEXT NOT NULL,
    
    -- Kiểm duyệt AI cho bình luận
    ai_label VARCHAR(50) DEFAULT 'Normal',
    ai_confidence NUMERIC(5, 4) DEFAULT 0.9900,
    is_hidden BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at ASC);


-- ========================================================
-- 4. BẢNG POST_REACTIONS (Bày tỏ 6 loại cảm xúc: Thích, Tim, Haha, Ngạc nhiên, Buồn, Phẫn nộ)
-- ========================================================
CREATE TABLE IF NOT EXISTS post_reactions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL, -- 'like', 'love', 'haha', 'wow', 'sad', 'angry'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id), -- Mỗi người dùng chỉ có 1 cảm xúc trên 1 bài viết
    CONSTRAINT check_valid_reaction CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry'))
);

CREATE INDEX IF NOT EXISTS idx_reactions_post ON post_reactions(post_id, reaction_type);


-- ========================================================
-- 5. BẢNG FRIENDSHIPS (Quan hệ bạn bè)
-- ========================================================
CREATE TABLE IF NOT EXISTS friendships (
    id BIGSERIAL PRIMARY KEY,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- 1. Bắt buộc status chỉ được nhận các giá trị hợp lệ
    CONSTRAINT check_friendship_status CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),

    -- 2. Chặn tự gửi lời mời kết bạn cho chính mình
    CONSTRAINT check_not_self_friend CHECK (requester_id <> addressee_id)
);

-- 3. Chặn trùng lặp 2 chiều (Cặp A-B và B-A là duy nhất)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_friendship_pair 
ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);


-- ========================================================
-- 6. BẢNG NOTIFICATIONS (Thông báo)
-- ========================================================
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL, -- 'like', 'comment', 'friend_request', 'friend_accept', 'system'
    content TEXT NOT NULL,
    target_post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id, created_at DESC);


-- ========================================================
-- 7. BẢNG MODERATION_LOGS (Nhật ký phân tích kiểm duyệt AI)
-- ========================================================
CREATE TABLE IF NOT EXISTS moderation_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content_type VARCHAR(20) NOT NULL, -- 'post' hoặc 'comment'
    content_id BIGINT,
    raw_text TEXT NOT NULL,
    predicted_label VARCHAR(50) NOT NULL, -- 'Normal', 'Toxic', 'Hate Speech', 'Violence'
    confidence NUMERIC(5, 4) NOT NULL,
    action_taken VARCHAR(50) NOT NULL,    -- 'allow', 'warn_user', 'cooldown_30s', 'auto_hide'
    latency_ms NUMERIC(6, 2),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- 8. BẢNG CONVERSATIONS (Cuộc trò chuyện & Hộp thư chờ người lạ)
-- ========================================================
CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'accepted', -- 'accepted' (Hộp thư chính), 'pending' (Tin nhắn chờ từ người lạ), 'blocked'
    initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Người bắt đầu nhắn
    last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_conv_not_self CHECK (user1_id <> user2_id)
);

-- Đảm bảo chỉ có 1 cuộc trò chuyện duy nhất giữa 2 người (2 chiều)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_conversation_pair 
ON conversations (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id));

CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);


-- ========================================================
-- 9. BẢNG MESSAGES (Tin nhắn chi tiết)
-- ========================================================
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'sent', -- 'sent' (Đã gửi), 'delivered' (Đã nhận), 'read' (Đã xem)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_not_self_message CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages(receiver_id, is_read);


-- ========================================================
-- 10. BẢNG REPORTS (Người dùng báo cáo vi phạm: Bài viết, Bình luận, Tin nhắn)
-- ========================================================
CREATE TABLE IF NOT EXISTS reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL, -- 'post', 'comment', 'message'
    target_id BIGINT NOT NULL,        -- id của post, comment, hoặc message
    reason VARCHAR(50) NOT NULL,      -- 'toxic', 'hate_speech', 'violence', 'harassment', 'spam', 'misinformation', 'other'
    details TEXT,                     -- Mô tả chi tiết lý do báo cáo
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' (chờ duyệt), 'resolved_violation' (xác nhận vi phạm), 'dismissed' (bác bỏ báo cáo)
    admin_notes TEXT,                 -- Ghi chú xử lý của Quản trị viên
    action_taken VARCHAR(50),         -- Biện pháp xử lý: 'hidden_content', 'warned_user', 'cooldown_24h', 'ban_account', 'dismissed'
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin tiếp nhận xử lý
    reviewed_at TIMESTAMPTZ,          -- Thời điểm xử lý xong
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_report_target_type CHECK (target_type IN ('post', 'comment', 'message')),
    CONSTRAINT chk_report_status CHECK (status IN ('pending', 'resolved_violation', 'dismissed')),
    CONSTRAINT unique_user_report UNIQUE (reporter_id, target_type, target_id) -- Chống spam: 1 người chỉ báo cáo 1 đối tượng 1 lần
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);


-- ========================================================
-- 11. BẢNG APPEALS (Khiếu nại / Kháng nghị khi bị AI gắn nhãn vi phạm sai)
-- ========================================================
CREATE TABLE IF NOT EXISTS appeals (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Người dùng khiếu nại
    content_type VARCHAR(20) NOT NULL, -- 'post', 'comment', 'message'
    content_id BIGINT NOT NULL,        -- id nội dung bị AI gắn nhãn
    original_text TEXT NOT NULL,       -- Nội dung nguyên văn bị phạt
    ai_predicted_label VARCHAR(50) NOT NULL, -- 'Toxic', 'Hate Speech', 'Violence'
    ai_confidence NUMERIC(5, 4) NOT NULL,    -- Độ tin cậy AI đã gán
    ai_action_taken VARCHAR(50) NOT NULL,    -- 'auto_hide', 'warn_user', 'cooldown_30s'
    appeal_reason TEXT NOT NULL,       -- Lời giải trình của người dùng (Ví dụ: Trích dẫn văn học, ngữ cảnh hiểu lầm)
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' (chờ duyệt), 'approved' (minh oan thành công), 'rejected' (bác bỏ khiếu nại)
    admin_notes TEXT,                  -- Lời giải thích/phản hồi từ Admin
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin xem xét
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_appeal_content_type CHECK (content_type IN ('post', 'comment', 'message')),
    CONSTRAINT chk_appeal_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appeals_user ON appeals(user_id);
-- Chống spam khiếu nại: 1 người chỉ có tối đa 1 đơn khiếu nại đang chờ duyệt (pending) cho cùng 1 nội dung
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_appeal 
ON appeals(user_id, content_type, content_id) WHERE status = 'pending';


-- ========================================================
-- 12. BẢNG AI_OVERRIDE_LOGS (Nhật ký Admin hiệu chỉnh nhãn AI sai & Tái huấn luyện mô hình)
-- ========================================================
CREATE TABLE IF NOT EXISTS ai_override_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content_type VARCHAR(20) NOT NULL, -- 'post', 'comment', 'message'
    content_id BIGINT NOT NULL,
    raw_text TEXT NOT NULL,
    original_ai_label VARCHAR(50) NOT NULL,  -- Nhãn AI dự đoán ban đầu (Ví dụ: Toxic)
    original_confidence NUMERIC(5, 4),
    corrected_label VARCHAR(50) NOT NULL,    -- Nhãn đúng do Admin chỉnh lại (Ví dụ: Normal)
    override_reason TEXT NOT NULL,           -- Lý do sửa nhãn (Ví dụ: 'False Positive - Từ lóng địa phương vô hại')
    is_exported_for_retraining BOOLEAN DEFAULT FALSE, -- Đã kết xuất cho tập dataset train lại chưa
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_override_content_type CHECK (content_type IN ('post', 'comment', 'message'))
);

CREATE INDEX IF NOT EXISTS idx_ai_override_created ON ai_override_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_override_retrain ON ai_override_logs(is_exported_for_retraining);


-- ========================================================
-- 13. CẬP NHẬT SCHEMA (chạy lặp lại an toàn)
--     - posts.title: tiêu đề bài viết (cho phép NULL để không ảnh hưởng bài cũ)
--     - post_reactions: cho phép 6 loại cảm xúc (thêm 'haha')
--     Lý do cần khối này: CREATE TABLE IF NOT EXISTS ở trên không sửa bảng đã tồn tại.
-- ========================================================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS title VARCHAR(200);

ALTER TABLE post_reactions DROP CONSTRAINT IF EXISTS check_valid_reaction;
ALTER TABLE post_reactions
    ADD CONSTRAINT check_valid_reaction
    CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry'));

ALTER TABLE messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';



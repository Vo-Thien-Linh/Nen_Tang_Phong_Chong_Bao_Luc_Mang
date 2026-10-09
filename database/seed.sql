-- ========================================================
-- DỮ LIỆU MẪU (SEED DATA) CHO NEXUSSOCIAL
-- Khớp 100% với dữ liệu hiển thị trên giao diện Frontend
-- ========================================================

-- 1. TẠO TÀI KHOẢN MẪU
-- Tài khoản chính: Võ Thiện Linh
INSERT INTO users (id, username, email, password_hash, full_name, avatar_url, cover_url, bio, location, hometown, education, high_school, relationship_status, is_verified)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'linh.vothien.16',
    'linh.vothien@example.com',
    '$2b$12$e80yJ/6J9Zf41p3hWv5P2uK8E2jX7.3d5F7h1y3l1b9o4s2q1w3e5', -- demo hashed password
    'Võ Thiện Linh',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?w=1200&auto=format&fit=crop&q=80',
    'Cuộc sống là những chuyến đi và trải nghiệm 🌊 Đam mê công nghệ & khám phá cuộc sống.',
    'Vũng Tàu',
    'Vũng Tàu',
    'Đại học Bách Khoa',
    'Trường THPT Hòa Hội',
    'Độc thân',
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- Tài khoản Quản trị viên mẫu (Admin)
INSERT INTO users (id, username, email, password_hash, full_name, role, is_verified)
VALUES (
    'a0000000-0000-0000-0000-000000000099',
    'admin_moderator',
    'admin@nexussocial.vn',
    '$2b$12$e80yJ/6J9Zf41p3hWv5P2uK8E2jX7.3d5F7h1y3l1b9o4s2q1w3e5',
    'Quản Trị Viên Hệ Thống',
    'ADMIN',
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- Bạn bè mẫu: Lê Thu Trang
INSERT INTO users (id, username, email, password_hash, full_name, avatar_url, bio, is_verified)
VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'thutrang_le',
    'thutrang@example.com',
    '$2b$12$e80yJ/6J9Zf41p3hWv5P2uK8E2jX7.3d5F7h1y3l1b9o4s2q1w3e5',
    'Lê Thu Trang',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
    'Frontend Developer & Coffee lover',
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- Bạn bè mẫu: Trần Hoàng Nam
INSERT INTO users (id, username, email, password_hash, full_name, avatar_url, bio, is_verified)
VALUES (
    'a0000000-0000-0000-0000-000000000003',
    'nam_traveler',
    'nam@example.com',
    '$2b$12$e80yJ/6J9Zf41p3hWv5P2uK8E2jX7.3d5F7h1y3l1b9o4s2q1w3e5',
    'Trần Hoàng Nam',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    'Photographer & Wanderer',
    FALSE
) ON CONFLICT (username) DO NOTHING;


-- 2. TẠO BÀI VIẾT MẪU
-- Bài 1: Cập nhật ảnh đại diện của Võ Thiện Linh
INSERT INTO posts (id, author_id, content, image_url, ai_label, ai_confidence, likes_count, comments_count, shares_count, created_at)
VALUES (
    1,
    'a0000000-0000-0000-0000-000000000001',
    'Võ Thiện Linh đã cập nhật ảnh đại diện của anh ấy.',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
    'Normal',
    0.9920,
    184,
    1,
    5,
    NOW() - INTERVAL '3 days'
) ON CONFLICT (id) DO NOTHING;

-- Bài 2: Chia sẻ dự án AI của Võ Thiện Linh
INSERT INTO posts (id, author_id, content, image_url, ai_label, ai_confidence, likes_count, comments_count, shares_count, created_at)
VALUES (
    2,
    'a0000000-0000-0000-0000-000000000001',
    'Vừa hoàn thiện xong module mạng xã hội với hệ thống kiểm duyệt bài viết thông minh bằng AI. Cảm ơn mọi người đã đồng hành và đóng góp ý kiến! ✨🎯',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
    'Normal',
    0.9850,
    312,
    1,
    35,
    NOW() - INTERVAL '5 hours'
) ON CONFLICT (id) DO NOTHING;

-- Bài 3: Bài viết của Lê Thu Trang trên bảng tin
INSERT INTO posts (id, author_id, content, image_url, ai_label, ai_confidence, likes_count, comments_count, shares_count, created_at)
VALUES (
    3,
    'a0000000-0000-0000-0000-000000000002',
    'Cuối tuần cùng team chinh phục một dự án mới. Giao diện trực quan và trải nghiệm mượt mà luôn là ưu tiên hàng đầu! Mọi người thấy phối màu xanh navy này thế nào? ☕💻',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80',
    'Normal',
    0.9910,
    148,
    2,
    12,
    NOW() - INTERVAL '2 hours'
) ON CONFLICT (id) DO NOTHING;


-- 3. TẠO BÌNH LUẬN MẪU
INSERT INTO comments (post_id, author_id, content, ai_label, created_at)
VALUES 
    (1, 'a0000000-0000-0000-0000-000000000002', 'Ảnh đại diện phong cách và góc chụp đẹp quá anh ơi! ✨', 'Normal', NOW() - INTERVAL '2 days'),
    (2, 'a0000000-0000-0000-0000-000000000003', 'Xuất sắc luôn anh ơi, có mở mã nguồn thử nghiệm không ạ?', 'Normal', NOW() - INTERVAL '3 hours'),
    (3, 'a0000000-0000-0000-0000-000000000001', 'Chúc mừng team nhé, phần animation mượt mà nữa là điểm 10 luôn!', 'Normal', NOW() - INTERVAL '1 hour');


-- 4. TẠO LƯỢT BÀY TỎ CẢM XÚC MẪU (5 CẢM XÚC: LIKE, LOVE, WOW, SAD, ANGRY)
INSERT INTO post_reactions (user_id, post_id, reaction_type)
VALUES 
    ('a0000000-0000-0000-0000-000000000002', 1, 'love'),  -- Lê Thu Trang thả Tim
    ('a0000000-0000-0000-0000-000000000003', 1, 'wow'),   -- Trần Hoàng Nam Ngạc nhiên
    ('a0000000-0000-0000-0000-000000000001', 2, 'like'),  -- Võ Thiện Linh Thích
    ('a0000000-0000-0000-0000-000000000001', 3, 'love')   -- Võ Thiện Linh Thả tim
ON CONFLICT DO NOTHING;


-- 5. TẠO THÔNG BÁO MẪU
INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id, is_read, created_at)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'like', 'đã thích bài viết của bạn: "Vừa hoàn thiện xong module mạng xã hội..."', 2, FALSE, NOW() - INTERVAL '15 minutes'),
    ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'comment', 'đã bình luận vào bài viết của bạn: "Xuất sắc luôn anh ơi..."', 2, FALSE, NOW() - INTERVAL '1 hour'),
    ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'like', 'đã thả tim vào ảnh đại diện mới của bạn.', 1, TRUE, NOW() - INTERVAL '1 day');


-- ========================================================
-- 6. TẠO DỮ LIỆU BÁO CÁO MẪU (REPORTS: BÀI VIẾT, BÌNH LUẬN, TIN NHẮN)
-- ========================================================
INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, admin_notes, created_at)
VALUES 
    (
        1,
        'a0000000-0000-0000-0000-000000000002', -- Lê Thu Trang báo cáo
        'post',
        3,
        'spam',
        'Nghi ngờ bài viết chứa liên kết quảng cáo spam chưa được kiểm duyệt.',
        'pending',
        NULL,
        NOW() - INTERVAL '40 minutes'
    ),
    (
        2,
        'a0000000-0000-0000-0000-000000000003', -- Trần Hoàng Nam báo cáo
        'comment',
        1,
        'toxic',
        'Bình luận có từ ngữ công kích thô tục nhắm vào người khác.',
        'pending',
        NULL,
        NOW() - INTERVAL '2 hours'
    ),
    (
        3,
        'a0000000-0000-0000-0000-000000000001', -- Võ Thiện Linh báo cáo
        'message',
        1,
        'harassment',
        'Tin nhắn quấy rối liên tục và đe dọa trong hộp thư chờ.',
        'resolved_violation',
        'Đã xác minh tin nhắn có yếu tố xúc phạm, tiến hành cảnh cáo người gửi và ẩn hội thoại.',
        NOW() - INTERVAL '1 day'
    )
ON CONFLICT (id) DO NOTHING;


-- ========================================================
-- 7. TẠO DỮ LIỆU KHIẾU NẠI MẪU (APPEALS: KHIẾU NẠI AI PHÁN QUYẾT SAI)
-- ========================================================
INSERT INTO appeals (id, user_id, content_type, content_id, original_text, ai_predicted_label, ai_confidence, ai_action_taken, appeal_reason, status, admin_notes, created_at)
VALUES 
    (
        1,
        'a0000000-0000-0000-0000-000000000001', -- Võ Thiện Linh gửi khiếu nại
        'post',
        2,
        'Hôm nay team em "tiêu diệt" gọn ghẽ đống bug cứng đầu trong sprint này! Cảm giác như vừa chiến thắng một trận đánh lớn vậy haha.',
        'Violence',
        0.9120,
        'warn_user',
        'Tôi dùng từ "tiêu diệt bug" và "trận đánh lớn" như một cách ví von lập trình viên fix lỗi phần mềm, hoàn toàn không có ý định bạo lực hay thù địch. Kính mong admin xem xét lại.',
        'pending',
        NULL,
        NOW() - INTERVAL '25 minutes'
    ),
    (
        2,
        'a0000000-0000-0000-0000-000000000003', -- Trần Hoàng Nam gửi khiếu nại
        'comment',
        2,
        'Thằng bạn thân chí cốt của tôi điên thật rồi, dám bỏ việc lương cao để khởi nghiệp công nghệ!',
        'Toxic',
        0.8840,
        'cooldown_30s',
        'Đây là cách nói đùa khen ngợi bạn thân dũng cảm khởi nghiệp, từ "điên" ở đây mang nghĩa tích cực khâm phục chứ không phải xúc phạm chửi bới.',
        'approved',
        'Đã kiểm tra ngữ cảnh: Là lời khen mang sắc thái thân mật giữa bạn bè. AI False Positive. Đã phục hồi bình luận và gỡ phạt.',
        NOW() - INTERVAL '3 hours'
    )
ON CONFLICT (id) DO NOTHING;


-- ========================================================
-- 8. TẠO DỮ LIỆU NHẬT KÝ HIỆU CHỈNH NHÃN AI (AI OVERRIDE LOGS)
-- ========================================================
INSERT INTO ai_override_logs (id, admin_id, content_type, content_id, raw_text, original_ai_label, original_confidence, corrected_label, override_reason, is_exported_for_retraining, created_at)
VALUES 
    (
        1,
        'a0000000-0000-0000-0000-000000000099',
        'comment',
        2,
        'Thằng bạn thân chí cốt của tôi điên thật rồi, dám bỏ việc lương cao để khởi nghiệp công nghệ!',
        'Toxic',
        0.8840,
        'Normal',
        'False Positive: Từ ngữ cảm thán thân mật giữa bạn thân, AI nhận diện nhầm từ "điên".',
        FALSE,
        NOW() - INTERVAL '2 hours'
    )
ON CONFLICT (id) DO NOTHING;


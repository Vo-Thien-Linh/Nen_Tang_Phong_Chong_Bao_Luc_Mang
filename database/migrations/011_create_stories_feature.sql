-- ========================================================
-- Migration: 011_create_stories_feature.sql
-- Mô tả: Thêm bảng Stories, Story Views, Story Reactions
-- Hỗ trợ đăng tin 24h (text, image, video tối đa 60s)
-- Tích hợp kiểm duyệt AI đa phương thức và hệ thống báo cáo/kháng cáo
-- ========================================================

-- 1. BẢNG STORIES
CREATE TABLE IF NOT EXISTS stories (
    id BIGSERIAL PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_type VARCHAR(20) NOT NULL DEFAULT 'image', -- 'text', 'image', 'video'
    media_url TEXT DEFAULT NULL,
    text_content TEXT DEFAULT NULL,
    background_style JSONB DEFAULT NULL,
    privacy VARCHAR(20) NOT NULL DEFAULT 'public', -- 'public', 'friends', 'private'
    expires_at TIMESTAMPTZ NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    -- Kiểm duyệt nội dung AI (đồng bộ với Posts)
    ai_status VARCHAR(20) NOT NULL DEFAULT 'approved', -- 'approved', 'warned', 'hidden'
    ai_label VARCHAR(50) DEFAULT 'Normal',
    ai_confidence NUMERIC(5, 4) DEFAULT 0.9900,
    media_moderation_status VARCHAR(20) DEFAULT NULL, -- 'safe', 'sensitive', 'rejected_hold', 'rejected_admin'
    media_moderation_label VARCHAR(20) DEFAULT NULL,
    media_moderation_safe NUMERIC(8, 7) DEFAULT NULL,
    media_moderation_nsfw NUMERIC(8, 7) DEFAULT NULL,
    media_moderation_violence NUMERIC(8, 7) DEFAULT NULL,
    media_moderation_thresholds JSONB DEFAULT NULL,
    media_moderation_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    media_moderation_reviewed_at TIMESTAMPTZ DEFAULT NULL,
    media_moderation_appealed_at TIMESTAMPTZ DEFAULT NULL,

    -- Bộ đếm cache hiệu năng cao
    views_count INT NOT NULL DEFAULT 0,
    reactions_count INT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index tăng tốc truy vấn Feed Story 24h
CREATE INDEX IF NOT EXISTS idx_stories_author ON stories(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_active_feed ON stories(created_at DESC) 
    WHERE is_deleted = FALSE AND is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at) 
    WHERE is_archived = FALSE;

-- 2. BẢNG STORY_VIEWS
CREATE TABLE IF NOT EXISTS story_views (
    id BIGSERIAL PRIMARY KEY,
    story_id BIGINT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_story_viewer UNIQUE (story_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON story_views(story_id, viewed_at DESC);

-- 3. BẢNG STORY_REACTIONS
CREATE TABLE IF NOT EXISTS story_reactions (
    id BIGSERIAL PRIMARY KEY,
    story_id BIGINT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL DEFAULT 'like', -- 'like', 'love', 'haha', 'wow', 'sad', 'angry'
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_story_reaction UNIQUE (story_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_story_reactions_story_id ON story_reactions(story_id);

-- 4. BỔ SUNG VIEWS MODERATION HỖ TRỢ STORIES
CREATE OR REPLACE VIEW moderation_content_read_model AS
SELECT
    'post'::TEXT AS content_type,
    p.id::BIGINT AS content_id,
    NULL::BIGINT AS parent_post_id,
    p.author_id,
    u.full_name AS author_name,
    p.content,
    p.image_url,
    p.image_moderation_status,
    p.image_moderation_safe,
    p.image_moderation_nsfw,
    p.image_moderation_violence,
    p.image_moderation_thresholds,
    p.image_moderation_appealed_at,
    p.image_moderation_reviewed_by,
    p.image_moderation_reviewed_at,
    p.ai_label,
    p.ai_confidence,
    p.ai_status,
    (p.ai_status = 'hidden') AS is_hidden,
    p.created_at,
    p.image_moderation_label
FROM posts p
JOIN users u ON u.id = p.author_id
UNION ALL
SELECT
    'comment'::TEXT AS content_type,
    c.id::BIGINT AS content_id,
    c.post_id AS parent_post_id,
    c.author_id,
    u.full_name AS author_name,
    c.content,
    c.image_url,
    c.image_moderation_status,
    c.image_moderation_safe,
    c.image_moderation_nsfw,
    c.image_moderation_violence,
    c.image_moderation_thresholds,
    c.image_moderation_appealed_at,
    c.image_moderation_reviewed_by,
    c.image_moderation_reviewed_at,
    c.ai_label,
    c.ai_confidence,
    c.ai_status,
    c.is_hidden,
    c.created_at,
    c.image_moderation_label
FROM comments c
JOIN users u ON u.id = c.author_id
UNION ALL
SELECT
    'story'::TEXT AS content_type,
    s.id::BIGINT AS content_id,
    NULL::BIGINT AS parent_post_id,
    s.author_id,
    u.full_name AS author_name,
    COALESCE(s.text_content, '[Tin đa phương tiện]') AS content,
    s.media_url AS image_url,
    s.media_moderation_status AS image_moderation_status,
    s.media_moderation_safe AS image_moderation_safe,
    s.media_moderation_nsfw AS image_moderation_nsfw,
    s.media_moderation_violence AS image_moderation_violence,
    s.media_moderation_thresholds AS image_moderation_thresholds,
    s.media_moderation_appealed_at AS image_moderation_appealed_at,
    s.media_moderation_reviewed_by AS image_moderation_reviewed_by,
    s.media_moderation_reviewed_at AS image_moderation_reviewed_at,
    s.ai_label,
    s.ai_confidence,
    s.ai_status,
    (s.ai_status = 'hidden' OR s.is_deleted = TRUE) AS is_hidden,
    s.created_at,
    s.media_moderation_label AS image_moderation_label
FROM stories s
JOIN users u ON u.id = s.author_id;

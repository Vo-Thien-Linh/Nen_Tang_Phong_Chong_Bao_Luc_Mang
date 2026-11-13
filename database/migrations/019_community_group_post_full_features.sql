-- Migration 019: Bo sung tinh nang day du cho bai viet nhom (Luu, Sua, Bao cao, Khang cao, Reply & Anh binh luan)

CREATE TABLE IF NOT EXISTS saved_group_posts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES community_group_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_saved_group_post UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_group_posts_user_id
    ON saved_group_posts(user_id, created_at DESC);

ALTER TABLE community_group_posts
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE community_group_post_comments
    ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES community_group_post_comments(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS image_moderation JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ai_label VARCHAR(50) NOT NULL DEFAULT 'Normal',
    ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(5, 4) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) NOT NULL DEFAULT 'approved';

CREATE INDEX IF NOT EXISTS idx_community_group_post_comments_parent
    ON community_group_post_comments (parent_id);

CREATE TABLE IF NOT EXISTS community_group_reports (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL,
    parent_post_id BIGINT REFERENCES community_group_posts(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    admin_notes TEXT NOT NULL DEFAULT '',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT community_group_reports_target_check CHECK (target_type IN ('post', 'comment')),
    CONSTRAINT community_group_reports_status_check CHECK (status IN ('pending', 'resolved_violation', 'dismissed')),
    CONSTRAINT unique_group_user_report UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_community_group_reports_group
    ON community_group_reports (group_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS community_group_appeals (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES community_group_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appeal_reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    admin_notes TEXT NOT NULL DEFAULT '',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT community_group_appeals_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_group_appeal
    ON community_group_appeals (user_id, post_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_community_group_appeals_group
    ON community_group_appeals (group_id, status, created_at DESC);

ALTER TABLE community_group_moderation_logs
    DROP CONSTRAINT IF EXISTS community_group_moderation_logs_target_check;
ALTER TABLE community_group_moderation_logs
    ADD CONSTRAINT community_group_moderation_logs_target_check
    CHECK (target_type IN ('post', 'member', 'comment', 'report', 'appeal'));

ALTER TABLE community_group_post_comments
    DROP CONSTRAINT IF EXISTS community_group_post_comments_content_check;
ALTER TABLE community_group_post_comments
    ADD CONSTRAINT community_group_post_comments_content_check
    CHECK (length(btrim(content)) > 0 OR image_url IS NOT NULL);

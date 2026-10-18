ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS image_moderation_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS image_moderation_label VARCHAR(20),
    ADD COLUMN IF NOT EXISTS image_moderation_safe NUMERIC(8, 7),
    ADD COLUMN IF NOT EXISTS image_moderation_nsfw NUMERIC(8, 7),
    ADD COLUMN IF NOT EXISTS image_moderation_violence NUMERIC(8, 7),
    ADD COLUMN IF NOT EXISTS image_moderation_thresholds JSONB,
    ADD COLUMN IF NOT EXISTS image_moderation_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS image_moderation_reviewed_at TIMESTAMPTZ;

ALTER TABLE comments
    ADD COLUMN IF NOT EXISTS image_moderation_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS image_moderation_label VARCHAR(20),
    ADD COLUMN IF NOT EXISTS image_moderation_safe NUMERIC(8, 7),
    ADD COLUMN IF NOT EXISTS image_moderation_nsfw NUMERIC(8, 7),
    ADD COLUMN IF NOT EXISTS image_moderation_violence NUMERIC(8, 7),
    ADD COLUMN IF NOT EXISTS image_moderation_thresholds JSONB,
    ADD COLUMN IF NOT EXISTS image_moderation_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS image_moderation_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_image_moderation_status
    ON posts(image_moderation_status) WHERE image_moderation_status = 'pending_review';
CREATE INDEX IF NOT EXISTS idx_comments_image_moderation_status
    ON comments(image_moderation_status) WHERE image_moderation_status = 'pending_review';

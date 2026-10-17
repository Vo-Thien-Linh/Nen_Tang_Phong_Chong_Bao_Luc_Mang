ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS moderation_expires_at TIMESTAMPTZ;

ALTER TABLE comments
    ADD COLUMN IF NOT EXISTS moderation_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_moderation_expiry
    ON posts(moderation_expires_at) WHERE image_moderation_status = 'rejected_hold';

CREATE INDEX IF NOT EXISTS idx_comments_moderation_expiry
    ON comments(moderation_expires_at) WHERE image_moderation_status = 'rejected_hold';

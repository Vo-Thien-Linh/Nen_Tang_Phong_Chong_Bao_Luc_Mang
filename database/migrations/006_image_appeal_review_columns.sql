ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS image_moderation_appealed_at TIMESTAMPTZ;

ALTER TABLE comments
    ADD COLUMN IF NOT EXISTS image_moderation_appealed_at TIMESTAMPTZ;

ALTER TABLE moderation_logs
    ADD COLUMN IF NOT EXISTS image_review_stage VARCHAR(20),
    ADD COLUMN IF NOT EXISTS image_review_previous_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS image_review_new_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS image_review_scores JSONB;

CREATE INDEX IF NOT EXISTS idx_posts_image_appeal_queue
    ON posts(image_moderation_status, image_moderation_appealed_at)
    WHERE image_moderation_status = 'appeal_pending';

CREATE INDEX IF NOT EXISTS idx_comments_image_appeal_queue
    ON comments(image_moderation_status, image_moderation_appealed_at)
    WHERE image_moderation_status = 'appeal_pending';

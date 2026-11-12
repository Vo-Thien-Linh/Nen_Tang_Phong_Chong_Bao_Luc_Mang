ALTER TABLE community_group_posts
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS image_moderation JSONB,
    ADD COLUMN IF NOT EXISTS ai_source VARCHAR(20) NOT NULL DEFAULT 'legacy';

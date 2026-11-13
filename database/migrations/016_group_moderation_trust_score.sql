ALTER TABLE community_group_members
    ADD COLUMN IF NOT EXISTS moderation_score INT NOT NULL DEFAULT 100;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'community_group_members_moderation_score_check'
          AND conrelid = 'community_group_members'::regclass
    ) THEN
        ALTER TABLE community_group_members
            ADD CONSTRAINT community_group_members_moderation_score_check
            CHECK (moderation_score BETWEEN 0 AND 100);
    END IF;
END $$;

ALTER TABLE community_group_moderation_logs
    ADD COLUMN IF NOT EXISTS author_trust_score_change INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS moderator_trust_score_change INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS moderator_trust_score_after INT;

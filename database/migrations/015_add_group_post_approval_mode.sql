ALTER TABLE community_groups
    ADD COLUMN IF NOT EXISTS post_approval_mode VARCHAR(20) NOT NULL DEFAULT 'manual';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'community_groups_post_approval_mode_check'
          AND conrelid = 'community_groups'::regclass
    ) THEN
        ALTER TABLE community_groups
            ADD CONSTRAINT community_groups_post_approval_mode_check
            CHECK (post_approval_mode IN ('manual', 'automatic'));
    END IF;
END $$;

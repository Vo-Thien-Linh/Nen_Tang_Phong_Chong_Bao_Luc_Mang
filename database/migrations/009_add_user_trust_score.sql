-- ========================================================
-- MIGRATION 009: HE THONG DIEM UY TIN (USER TRUST SCORE)
-- ========================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score INT NOT NULL DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_trust_recovery_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_user_trust_score_range'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT check_user_trust_score_range CHECK (trust_score BETWEEN 0 AND 100);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_trust_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_amount INT NOT NULL,
    new_score INT NOT NULL,
    reason TEXT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    content_id INT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_trust_logs_user_id ON user_trust_logs(user_id, created_at DESC);

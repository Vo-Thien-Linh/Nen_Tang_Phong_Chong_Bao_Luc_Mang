ALTER TABLE posts ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE post_reactions DROP CONSTRAINT IF EXISTS check_valid_reaction;
ALTER TABLE post_reactions ADD CONSTRAINT check_valid_reaction CHECK (reaction_type IN ('like','love','haha','wow','sad','angry'));

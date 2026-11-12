-- Migration 021: Add reaction tables for regular post comments and community group post comments
CREATE TABLE IF NOT EXISTS comment_reactions (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_comment_reaction_user UNIQUE (comment_id, user_id),
    CONSTRAINT check_valid_comment_reaction CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry'))
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id, reaction_type);

CREATE TABLE IF NOT EXISTS community_group_comment_reactions (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES community_group_post_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_group_comment_reaction_user UNIQUE (comment_id, user_id),
    CONSTRAINT community_group_comment_reactions_type_check CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry'))
);

CREATE INDEX IF NOT EXISTS idx_group_comment_reactions_comment ON community_group_comment_reactions(comment_id, reaction_type);


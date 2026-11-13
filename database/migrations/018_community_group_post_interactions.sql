CREATE TABLE IF NOT EXISTS community_group_post_reactions (
    post_id BIGINT NOT NULL REFERENCES community_group_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id),
    CONSTRAINT community_group_post_reactions_type_check
        CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry'))
);

CREATE TABLE IF NOT EXISTS community_group_post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_group_posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT community_group_post_comments_content_check CHECK (length(btrim(content)) > 0)
);

CREATE TABLE IF NOT EXISTS community_group_post_shares (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_group_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_community_group_post_comments_post
    ON community_group_post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_group_post_shares_post
    ON community_group_post_shares (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    rules TEXT NOT NULL DEFAULT '',
    privacy VARCHAR(20) NOT NULL DEFAULT 'public',
    is_discoverable BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT community_groups_privacy_check CHECK (privacy IN ('public', 'private'))
);

CREATE TABLE IF NOT EXISTS community_group_members (
    group_id BIGINT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    PRIMARY KEY (group_id, user_id),
    CONSTRAINT community_group_members_role_check CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
    CONSTRAINT community_group_members_status_check CHECK (status IN ('active', 'pending', 'rejected', 'banned', 'left'))
);

CREATE TABLE IF NOT EXISTS community_group_posts (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    review_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ai_label VARCHAR(50) NOT NULL DEFAULT 'Review needed',
    ai_confidence NUMERIC(5, 4),
    ai_action VARCHAR(20) NOT NULL DEFAULT 'review',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT community_group_posts_status_check CHECK (review_status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT community_group_posts_ai_action_check CHECK (ai_action IN ('allow', 'warn', 'hide', 'review'))
);

CREATE TABLE IF NOT EXISTS community_group_moderation_logs (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL,
    target_post_id BIGINT REFERENCES community_group_posts(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(30) NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    ai_label VARCHAR(50),
    ai_confidence NUMERIC(5, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT community_group_moderation_logs_target_check CHECK (target_type IN ('post', 'member'))
);

CREATE INDEX IF NOT EXISTS idx_community_groups_discover ON community_groups (privacy, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_group_members_user ON community_group_members (user_id, status, group_id);
CREATE INDEX IF NOT EXISTS idx_community_group_members_requests ON community_group_members (group_id, requested_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_community_group_posts_feed ON community_group_posts (group_id, created_at DESC) WHERE review_status = 'approved';
CREATE INDEX IF NOT EXISTS idx_community_group_posts_queue ON community_group_posts (group_id, created_at ASC) WHERE review_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_community_group_moderation_logs_group ON community_group_moderation_logs (group_id, created_at DESC);

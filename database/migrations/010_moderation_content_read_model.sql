-- Read-only projection for moderation queues and dashboard exports.
-- Social Content remains the write owner of posts/comments; moderation reads
-- the projection instead of duplicating author/content join logic.
ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS target_modality VARCHAR(20) DEFAULT 'both';

CREATE OR REPLACE VIEW moderation_content_read_model AS
SELECT
    'post'::TEXT AS content_type,
    p.id::BIGINT AS content_id,
    NULL::BIGINT AS parent_post_id,
    p.author_id,
    u.full_name AS author_name,
    p.content,
    p.image_url,
    p.image_moderation_status,
    p.image_moderation_safe,
    p.image_moderation_nsfw,
    p.image_moderation_violence,
    p.image_moderation_thresholds,
    p.image_moderation_appealed_at,
    p.image_moderation_reviewed_by,
    p.image_moderation_reviewed_at,
    p.ai_label,
    p.ai_confidence,
    p.ai_status,
    (p.ai_status = 'hidden') AS is_hidden,
    p.created_at,
    p.image_moderation_label
FROM posts p
JOIN users u ON u.id = p.author_id
UNION ALL
SELECT
    'comment'::TEXT AS content_type,
    c.id::BIGINT AS content_id,
    c.post_id AS parent_post_id,
    c.author_id,
    u.full_name AS author_name,
    c.content,
    c.image_url,
    c.image_moderation_status,
    c.image_moderation_safe,
    c.image_moderation_nsfw,
    c.image_moderation_violence,
    c.image_moderation_thresholds,
    c.image_moderation_appealed_at,
    c.image_moderation_reviewed_by,
    c.image_moderation_reviewed_at,
    c.ai_label,
    c.ai_confidence,
    c.ai_status,
    c.is_hidden,
    c.created_at,
    c.image_moderation_label
FROM comments c
JOIN users u ON u.id = c.author_id;

CREATE OR REPLACE VIEW moderation_report_read_model AS
SELECT
    r.id,
    r.reporter_id,
    r.target_type,
    r.target_id,
    r.reason,
    r.details,
    r.status,
    r.admin_notes,
    r.action_taken,
    r.created_at,
    r.target_modality,
    reporter.full_name AS reporter_name,
    reporter.avatar_url AS reporter_avatar,
    p.content AS post_content,
    p.image_url AS post_image,
    p.ai_label AS post_ai_label,
    p.ai_status AS post_ai_status,
    parent_post.id AS parent_post_id,
    parent_post.content AS parent_post_content,
    parent_post.image_url AS parent_post_image,
    parent_post.ai_status AS parent_post_ai_status,
    parent_post.ai_label AS parent_post_ai_label,
    p.image_moderation_label AS post_image_label,
    p.image_moderation_status AS post_image_status,
    parent_post.image_moderation_status AS parent_post_image_status,
    c.content AS comment_content,
    c.image_url AS comment_image,
    c.ai_label AS comment_ai_label,
    c.image_moderation_label AS comment_image_label,
    c.image_moderation_status AS comment_image_status,
    author.full_name AS target_author_name,
    author.username AS target_author_username
FROM reports r
LEFT JOIN users reporter ON reporter.id = r.reporter_id
LEFT JOIN posts p ON r.target_type = 'post' AND r.target_id = p.id
LEFT JOIN comments c ON r.target_type = 'comment' AND r.target_id = c.id
LEFT JOIN posts parent_post ON r.target_type = 'comment' AND c.post_id = parent_post.id
LEFT JOIN users author ON (
    (r.target_type = 'post' AND p.author_id = author.id) OR
    (r.target_type = 'comment' AND c.author_id = author.id)
);

CREATE OR REPLACE VIEW moderation_appeal_read_model AS
SELECT
    a.id,
    a.user_id,
    a.content_type,
    a.content_id,
    a.original_text,
    a.ai_predicted_label,
    a.ai_confidence,
    a.ai_action_taken,
    a.appeal_reason,
    a.status,
    a.admin_notes,
    a.created_at,
    u.full_name AS user_name,
    u.avatar_url AS user_avatar,
    u.username,
    COALESCE(p.image_url, c.image_url) AS image_url,
    COALESCE(p.id, parent_post.id) AS target_post_id,
    COALESCE(p.content, parent_post.content) AS target_post_content,
    COALESCE(p.image_url, parent_post.image_url) AS target_post_image,
    COALESCE(p.ai_status, parent_post.ai_status) AS target_post_ai_status,
    COALESCE(p.ai_label, parent_post.ai_label) AS target_post_ai_label,
    COALESCE(p.image_moderation_status, parent_post.image_moderation_status) AS target_post_image_status
FROM appeals a
LEFT JOIN users u ON u.id = a.user_id
LEFT JOIN posts p ON a.content_type = 'post' AND a.content_id = p.id
LEFT JOIN comments c ON a.content_type = 'comment' AND a.content_id = c.id
LEFT JOIN posts parent_post ON a.content_type = 'comment' AND c.post_id = parent_post.id;

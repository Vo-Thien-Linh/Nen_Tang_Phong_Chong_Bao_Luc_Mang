import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { mapPostToResponse } from '../controllers/postsController.js';
import { realtimeService } from '../services/realtimeService.js';
import { reviewImageModeration } from '../services/imageModerationReviewService.js';
import { getFinalRejectionEvent } from '../services/imageModerationRealtimeEvents.js';

const listTypes = new Set(['all', 'post', 'comment']);

export function createImageModerationRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const { requireAuth, requireRole } = createAuthMiddleware({ userRepository });
  const moderatorOnly = [requireAuth, requireRole('moderator')];

  router.get('/pending', ...moderatorOnly, async (req, res, next) => {
    try {
      const result = await listReviewQueue(pool, 'pending_review', req.query);
      res.json({ success: true, ...result });
    } catch (error) { next(error); }
  });

  router.get('/appeals', ...moderatorOnly, async (req, res, next) => {
    try {
      const result = await listReviewQueue(pool, 'appeal_pending', req.query, true);
      res.json({ success: true, ...result });
    } catch (error) { next(error); }
  });

  router.post('/:contentType/:id/decide', ...moderatorOnly, async (req, res, next) => {
    await decide(req, res, next, pool, req.body?.stage || 'first');
  });
  // Keep the original API paths working for existing moderation clients.
  router.post('/:contentType/:id/approve', ...moderatorOnly, async (req, res, next) => {
    await decide(req, res, next, pool, 'first', 'safe');
  });
  router.post('/:contentType/:id/reject', ...moderatorOnly, async (req, res, next) => {
    await decide(req, res, next, pool, 'first', 'violence');
  });
  return router;
}

async function decide(req, res, next, pool, stage, fixedDecision = null) {
  const decision = fixedDecision || req.body?.decision;
  try {
  const result = await reviewImageModeration({
    pool,
    contentType: req.params.contentType,
    contentId: req.params.id,
    stage,
    decision,
    reviewerId: req.user.id,
  });
  if (!result.ok) return res.status(result.statusCode).json({ success: false, message: result.message });
  if (result.data.published) await broadcastPublishedItem(pool, result.data);
  if (result.data.status === 'rejected_final') {
    realtimeService.broadcast(getFinalRejectionEvent(result.data));
  }
  return res.json({ success: true, data: result.data, message: "Đã cập nhật trạng thái duyệt ảnh" });
  } catch (error) {
    console.error('Image review decision failed', {
      code: error.code || 'UNKNOWN',
      message: error.message || 'Unknown error',
    });
    return res.status(500).json({ success: false, message: 'Đã có lỗi hệ thống' });
  }
}

export async function broadcastPublishedItem(pool, { id, type }) {
  if (type === 'post') {
    const result = await pool.query(
      `SELECT p.id, p.author_id, p.content, p.image_url, p.image_moderation_status,
              p.image_moderation_label, p.image_moderation_safe, p.image_moderation_nsfw,
              p.image_moderation_violence, p.image_moderation_thresholds, p.image_moderation_appealed_at,
              p.moderation_expires_at, p.created_at, p.edited_at, p.ai_label, p.ai_confidence,
              p.ai_status, p.likes_count, p.comments_count, p.shares_count,
              u.full_name, u.username, u.avatar_url, u.is_verified
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.id = $1 AND p.image_moderation_status IN ('safe', 'sensitive')`,
      [id]
    );
    const post = result.rows[0];
    if (post?.ai_status === 'approved') realtimeService.broadcast({ type: 'POST_CREATED', post: mapPostToResponse(post) });
    return;
  }
  const result = await pool.query(
    `SELECT c.id, c.post_id, c.author_id, c.content, c.image_url, c.image_label,
            c.image_moderation_status, c.image_moderation_safe, c.image_moderation_nsfw,
            c.image_moderation_violence, c.image_moderation_thresholds,
            c.image_moderation_appealed_at, c.moderation_expires_at, c.is_hidden,
            c.ai_label, c.ai_confidence, c.created_at,
            u.full_name, u.username, u.avatar_url, u.is_verified
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.id = $1 AND c.image_moderation_status IN ('safe', 'sensitive')`,
    [id]
  );
  const row = result.rows[0];
  if (!row || row.is_hidden) return;
  const postResult = await pool.query(`SELECT id, ai_status FROM posts WHERE id = $1`, [row.post_id]);
  if (postResult.rows[0]?.ai_status !== 'approved') return;
  realtimeService.broadcast({
    type: 'COMMENT_CREATED',
    postId: String(row.post_id),
    comment: {
      id: String(row.id),
      author: { id: row.author_id, name: row.full_name, username: row.username, avatar: row.avatar_url, isVerified: Boolean(row.is_verified) },
      content: row.content,
      image: row.image_url || null,
      imageModeration: row.image_moderation_status ? {
        status: row.image_moderation_status,
        scores: { safe: row.image_moderation_safe, nsfw: row.image_moderation_nsfw, violence: row.image_moderation_violence },
        thresholds: row.image_moderation_thresholds || null,
        moderationExpiresAt: row.moderation_expires_at || null,
        appealedAt: row.image_moderation_appealed_at || null,
      } : null,
      image_label: row.image_label,
      is_hidden: false,
      isHidden: false,
      is_soft_hidden: false,
      isSoftHidden: false,
      ai_label: row.ai_label || 'Normal',
      aiLabel: row.ai_label || 'Normal',
      ai_confidence: Number(row.ai_confidence ?? 0.99),
      time: row.created_at,
      createdAt: row.created_at,
    },
  });
}

export async function listReviewQueue(pool, status, query = {}, withPreviousDecision = false) {
  const type = listTypes.has(query.type) ? query.type : 'all';
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const fetchCount = offset + limit + 1;
  const tables = type === 'all' ? ['posts', 'comments'] : [type === 'post' ? 'posts' : 'comments'];
  const rows = [];
  for (const table of tables) {
    const contentType = table === 'posts' ? 'post' : 'comment';
    const commentJoin = '';
    const previousSelect = withPreviousDecision
      ? `COALESCE((SELECT jsonb_build_object('label', l.predicted_label, 'reviewerName', reviewer.full_name, 'reviewedAt', l.created_at)
                    FROM moderation_logs l LEFT JOIN users reviewer ON reviewer.id = l.user_id
                    WHERE l.content_type = '${contentType}' AND l.content_id = item.id AND l.image_review_stage = 'first'
                    ORDER BY l.created_at DESC LIMIT 1),
                   jsonb_build_object('label', CASE WHEN item.image_moderation_status = 'rejected_admin' THEN 'Violence' ELSE 'Violence' END,
                                      'reviewerName', previous_reviewer.full_name, 'reviewedAt', item.image_moderation_reviewed_at)) AS previous_decision`
      : 'NULL::jsonb AS previous_decision';
    const reviewerJoin = withPreviousDecision ? `LEFT JOIN users previous_reviewer ON previous_reviewer.id = item.image_moderation_reviewed_by` : '';
    const result = await pool.query(
      `SELECT item.id, '${contentType}'::text AS content_type, item.author_id,
              author.full_name AS author_name, item.content, item.image_url,
              item.image_moderation_status AS status, item.image_moderation_label AS model_label,
              item.image_moderation_safe AS safe, item.image_moderation_nsfw AS nsfw,
              item.image_moderation_violence AS violence, item.image_moderation_thresholds AS thresholds,
              item.created_at, item.image_moderation_appealed_at AS appealed_at,
              ${previousSelect}
       FROM ${table} item JOIN users author ON author.id = item.author_id
       ${commentJoin} ${reviewerJoin}
       WHERE item.image_moderation_status = $1
         AND item.image_url IS NOT NULL AND BTRIM(item.image_url) <> ''
       ORDER BY item.created_at ASC, item.id ASC
       LIMIT $2`,
      [status, fetchCount]
    );
    rows.push(...result.rows);
  }
  rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || Number(a.id) - Number(b.id));
  const pageRows = rows.slice(offset, offset + limit);
  return {
    data: pageRows.map((row) => ({
      id: String(row.id),
      type: row.content_type,
      content_type: row.content_type,
      author: { id: row.author_id, name: row.author_name },
      text: row.content,
      content: row.content,
      imageUrls: row.image_url ? [row.image_url] : [],
      imageUrl: row.image_url,
      image_url: row.image_url,
      modelLabel: row.model_label,
      modelScores: { safe: row.safe, nsfw: row.nsfw, violence: row.violence },
      thresholds: row.thresholds,
      createdAt: row.created_at,
      status: row.status,
      previousDecision: row.previous_decision,
      appealedAt: row.appealed_at,
    })),
    pagination: { page, limit, hasMore: rows.length > offset + limit },
  };
}

import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';

export function createModerationAppealRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const { requireAuth } = createAuthMiddleware({ userRepository });
  router.post('/:postId/appeal', requireAuth, async (req, res, next) => reviewAppeal(req, res, next, pool, 'posts', req.params.postId));
  router.post('/:postId/comments/:commentId/appeal', requireAuth, async (req, res, next) => reviewAppeal(req, res, next, pool, 'comments', req.params.commentId));
  return router;
}

async function reviewAppeal(req, res, next, pool, table, id) {
  try {
    const result = await pool.query(`
      UPDATE ${table}
      SET image_moderation_status = 'pending_review', moderation_expires_at = NULL
      WHERE id = $1 AND author_id = $2 AND image_moderation_status = 'rejected_hold'
        AND moderation_expires_at > CURRENT_TIMESTAMP
      RETURNING id`, [id, req.user.id]);
    if (!result.rows[0]) return res.status(409).json({ success: false, message: 'Đã hết thời gian kháng cáo' });
    await pool.query(`INSERT INTO moderation_logs (user_id, content_type, content_id, raw_text, predicted_label, confidence, action_taken) VALUES ($1, $2, $3, $4, 'Violence', 1, 'appeal')`, [req.user.id, table === 'posts' ? 'post' : 'comment', id, 'Image moderation appeal']);
    res.json({ success: true, data: { id: result.rows[0].id, status: 'pending_review' } });
  } catch (error) { next(error); }
}

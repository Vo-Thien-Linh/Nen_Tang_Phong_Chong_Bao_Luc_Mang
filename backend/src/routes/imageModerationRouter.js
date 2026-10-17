import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createUserRepository } from '../repositories/userRepository.js';

const adminOnly = (req, res, next) => {
  const role = String(req.user?.role || '').toUpperCase();
  if (role !== 'ADMIN' && role !== 'MODERATOR') return res.status(403).json({ success: false, message: 'Chỉ quản trị viên mới có quyền duyệt ảnh' });
  next();
};

export function createImageModerationRouter({ pool }) {
  const router = express.Router();
  const userRepository = createUserRepository({ pool });
  const { requireAuth } = createAuthMiddleware({ userRepository });

  router.get('/pending', requireAuth, adminOnly, async (_req, res, next) => {
    try {
      const result = await pool.query(`
        SELECT 'post' AS content_type, p.id, p.author_id, p.content, p.image_url,
               p.image_moderation_status AS status, p.image_moderation_safe AS safe,
               p.image_moderation_nsfw AS nsfw, p.image_moderation_violence AS violence,
               p.image_moderation_thresholds AS thresholds
        FROM posts p WHERE p.image_moderation_status = 'pending_review'
        UNION ALL
        SELECT 'comment', c.id, c.author_id, c.content, c.image_url,
               c.image_moderation_status, c.image_moderation_safe,
               c.image_moderation_nsfw, c.image_moderation_violence,
               c.image_moderation_thresholds
        FROM comments c WHERE c.image_moderation_status = 'pending_review'
        ORDER BY id DESC`);
      res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
  });

  router.post('/:contentType/:id/approve', requireAuth, adminOnly, async (req, res, next) => {
    await review(req, res, next, pool, 'safe');
  });
  router.post('/:contentType/:id/reject', requireAuth, adminOnly, async (req, res, next) => {
    await review(req, res, next, pool, 'rejected');
  });
  return router;
}

async function review(req, res, next, pool, decision) {
  const table = req.params.contentType === 'comment' ? 'comments' : req.params.contentType === 'post' ? 'posts' : null;
  if (!table) return res.status(400).json({ success: false, message: 'Loại nội dung không hợp lệ' });
  try {
    const rejectionColumn = decision === 'rejected' ? (table === 'posts' ? ', ai_status = \'hidden\'' : ', is_hidden = TRUE') : '';
    const result = await pool.query(
      `UPDATE ${table} SET image_moderation_status = $1, image_moderation_reviewed_by = $2,
       image_moderation_reviewed_at = CURRENT_TIMESTAMP${rejectionColumn}
       WHERE id = $3 AND image_moderation_status = 'pending_review'
       RETURNING id, author_id`,
      [decision, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy nội dung chờ duyệt' });
    if (decision === 'rejected') {
      await pool.query(`INSERT INTO notifications (recipient_id, type, content, target_post_id) VALUES ($1, 'system', $2, $3)`, [result.rows[0].author_id, 'Ảnh của bạn bị từ chối sau khi quản trị viên xem xét', table === 'posts' ? result.rows[0].id : null]);
    }
    res.json({ success: true, data: { id: result.rows[0].id, decision } });
  } catch (error) { next(error); }
}

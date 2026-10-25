import { transitionImageModeration } from './imageModerationState.js';
import { imageReviewNotification } from './moderationNotificationText.js';

const TABLE_BY_TYPE = { post: 'posts', comment: 'comments' };
const DECISION_LABEL = { safe: 'Safe', nsfw: 'NSFW', violence: 'Violence' };
const conflictMessage = 'Má»¥c nÃ y Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½ hoáº·c khÃ´ng cÃ²n tá»“n táº¡i';

export async function reviewImageModeration({ pool, contentType, contentId, stage, decision, reviewerId, clock = () => new Date() }) {
  const table = TABLE_BY_TYPE[contentType];
  if (!table || !['first', 'final'].includes(stage)) return { ok: false, statusCode: 400, message: 'YÃªu cáº§u khÃ´ng há»£p lá»‡' };
  if (!Object.hasOwn(DECISION_LABEL, decision)) return { ok: false, statusCode: 400, message: 'Nhãn quyáº¿t Ä‘á»‹nh khÃ´ng há»£p lá»‡' };
  const expectedStatus = stage === 'first' ? 'pending_review' : 'appeal_pending';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id, author_id, post_id, content, image_url, image_moderation_status,
              image_moderation_safe, image_moderation_nsfw, image_moderation_violence,
              image_moderation_thresholds, image_moderation_appealed_at, moderation_expires_at
       FROM ${table} WHERE id = $1 FOR UPDATE`,
      [contentId]
    );
    const item = existing.rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return { ok: false, statusCode: 409, message: conflictMessage };
    }
    const transition = transitionImageModeration({
      status: item.image_moderation_status,
      action: stage === 'first' ? 'first_review' : 'final_review',
      decision,
    });
    if (!transition.ok || item.image_moderation_status !== expectedStatus) {
      await client.query('ROLLBACK');
      return { ok: false, statusCode: 409, message: conflictMessage };
    }
    const reviewedAt = clock();
    const updated = await client.query(
      `UPDATE ${table}
       SET image_moderation_status = $1,
           image_moderation_reviewed_by = $2,
           image_moderation_reviewed_at = $3,
           moderation_expires_at = NULL
       WHERE id = $4 AND image_moderation_status = $5
       RETURNING id, author_id, post_id, image_moderation_status`,
      [transition.nextStatus, reviewerId, reviewedAt, contentId, expectedStatus]
    );
    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, statusCode: 409, message: conflictMessage };
    }
    const scores = {
      safe: item.image_moderation_safe,
      nsfw: item.image_moderation_nsfw,
      violence: item.image_moderation_violence,
      thresholds: item.image_moderation_thresholds,
    };
    const confidence = Number(item.image_moderation_violence ?? item.image_moderation_nsfw ?? item.image_moderation_safe ?? 0);
    await client.query(
      `INSERT INTO moderation_logs
         (user_id, content_type, content_id, raw_text, predicted_label, confidence, action_taken,
          image_review_stage, image_review_previous_status, image_review_new_status, image_review_scores)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [reviewerId, contentType, contentId, item.content || '', DECISION_LABEL[decision], confidence,
        `image_review_${stage}_${decision}`, stage, expectedStatus, transition.nextStatus, JSON.stringify(scores)]
    );
    await client.query(
      `INSERT INTO notifications (recipient_id, type, content, target_post_id)
       VALUES ($1, 'system', $2, $3)`,
      [item.author_id, imageReviewNotification(contentType, stage, decision), contentType === 'post' ? item.id : item.post_id]
    );
    await client.query('COMMIT');
    return { ok: true, data: { id: String(item.id), type: contentType, status: transition.nextStatus, decision, published: transition.visibleToOthers, reviewedAt } };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

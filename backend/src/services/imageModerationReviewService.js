import { transitionImageModeration } from './imageModerationState.js';
import { imageReviewNotification } from './moderationNotificationText.js';

const TABLE_BY_TYPE = { post: 'posts', comment: 'comments', story: 'stories' };
const DECISION_LABEL = { safe: 'Safe', nsfw: 'NSFW', violence: 'Violence' };
const reviewNotFoundMessage = 'Không tìm thấy mục cần duyệt';
const conflictMessage = 'Mục này đã được xử lý hoặc không còn tồn tại';
const appealedMessage = 'Bạn đã khiếu nại mục này';

export async function appealImageModeration({ pool, contentType, contentId, authorId, clock = () => new Date() }) {
  const table = TABLE_BY_TYPE[contentType];
  const isStory = contentType === 'story';
  const parentPostColumn = contentType === 'comment' ? 'post_id, ' : '';
  const statusField = isStory ? 'media_moderation_status' : 'image_moderation_status';
  const safeField = isStory ? 'media_moderation_safe' : 'image_moderation_safe';
  const nsfwField = isStory ? 'media_moderation_nsfw' : 'image_moderation_nsfw';
  const violenceField = isStory ? 'media_moderation_violence' : 'image_moderation_violence';
  const thresholdsField = isStory ? 'media_moderation_thresholds' : 'image_moderation_thresholds';
  const appealedAtField = isStory ? 'media_moderation_appealed_at' : 'image_moderation_appealed_at';
  const contentField = isStory ? 'text_content AS content' : 'content';

  if (!table) return { ok: false, statusCode: 400, message: 'Loại nội dung không hợp lệ' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id, author_id, ${parentPostColumn}${contentField}, ${statusField} AS image_moderation_status,
              ${safeField} AS image_moderation_safe, ${nsfwField} AS image_moderation_nsfw, ${violenceField} AS image_moderation_violence,
              ${thresholdsField} AS image_moderation_thresholds, ${appealedAtField} AS image_moderation_appealed_at
       FROM ${table} WHERE id = $1 FOR UPDATE`,
      [contentId]
    );
    const item = existing.rows[0];
    if (!item || String(item.author_id) !== String(authorId)) {
      await client.query('ROLLBACK');
      return { ok: false, statusCode: 404, message: conflictMessage };
    }
    const now = clock();
    const transition = transitionImageModeration({
      status: item.image_moderation_status,
      action: 'appeal',
      appealedAt: item.image_moderation_appealed_at,
    });
    if (!transition.ok) {
      await client.query('ROLLBACK');
      const message = transition.reason === 'already_appealed' ? appealedMessage : conflictMessage;
      return { ok: false, statusCode: transition.statusCode, message };
    }
    const appealedAt = now;
    const updated = await client.query(
      `UPDATE ${table}
       SET ${statusField} = 'appeal_pending', ${appealedAtField} = $3
       WHERE id = $1 AND author_id = $2 AND ${statusField} = $4
         AND ${appealedAtField} IS NULL
       RETURNING id`,
      [contentId, authorId, appealedAt, transition.previousStatus]
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
    await client.query(
      `INSERT INTO moderation_logs
         (user_id, content_type, content_id, raw_text, predicted_label, confidence, action_taken,
          image_review_stage, image_review_previous_status, image_review_new_status, image_review_scores)
       VALUES ($1, $2, $3, $4, 'Violence', $5, 'image_review_appeal', 'appeal', $6, 'appeal_pending', $7::jsonb)`,
      [authorId, contentType, contentId, item.content || '', Number(item.image_moderation_violence ?? 0),
        transition.previousStatus, JSON.stringify(scores)]
    );
    await client.query('COMMIT');
    return { ok: true, data: { id: String(item.id), status: 'appeal_pending', appealedAt } };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function reviewImageModeration({ pool, contentType, contentId, stage, decision, reviewerId, clock = () => new Date() }) {
  const table = TABLE_BY_TYPE[contentType];
  const isStory = contentType === 'story';
  const parentPostColumn = contentType === 'comment' ? 'post_id, ' : '';
  const hiddenColumn = contentType === 'comment' ? 'is_hidden, ' : '';
  const statusField = isStory ? 'media_moderation_status' : 'image_moderation_status';
  const reviewedByField = isStory ? 'media_moderation_reviewed_by' : 'image_moderation_reviewed_by';
  const reviewedAtField = isStory ? 'media_moderation_reviewed_at' : 'image_moderation_reviewed_at';
  const safeField = isStory ? 'media_moderation_safe' : 'image_moderation_safe';
  const nsfwField = isStory ? 'media_moderation_nsfw' : 'image_moderation_nsfw';
  const violenceField = isStory ? 'media_moderation_violence' : 'image_moderation_violence';
  const thresholdsField = isStory ? 'media_moderation_thresholds' : 'image_moderation_thresholds';
  const appealedAtField = isStory ? 'media_moderation_appealed_at' : 'image_moderation_appealed_at';
  const contentField = isStory ? 'text_content AS content' : 'content';
  const imageField = isStory ? 'media_url AS image_url' : 'image_url';

  if (!table || !['first', 'final'].includes(stage)) return { ok: false, statusCode: 400, message: 'Yêu cầu không hợp lệ' };
  if (!Object.hasOwn(DECISION_LABEL, decision)) return { ok: false, statusCode: 400, message: 'Nhãn quyết định không hợp lệ' };
  const expectedStatus = stage === 'first' ? 'pending_review' : 'appeal_pending';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id, author_id, ${parentPostColumn}${contentField}, ${imageField}, created_at, ${hiddenColumn}${statusField} AS image_moderation_status,
              ${safeField} AS image_moderation_safe, ${nsfwField} AS image_moderation_nsfw, ${violenceField} AS image_moderation_violence,
              ${thresholdsField} AS image_moderation_thresholds, ${appealedAtField} AS image_moderation_appealed_at
       FROM ${table} WHERE id = $1 FOR UPDATE`,
      [contentId]
    );
    const item = existing.rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return { ok: false, statusCode: 404, message: reviewNotFoundMessage };
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
       SET ${statusField} = $1,
           ${reviewedByField} = $2,
           ${reviewedAtField} = $3
       WHERE id = $4 AND ${statusField} = $5
       RETURNING id, author_id, ${statusField} AS image_moderation_status`,
      [transition.nextStatus, reviewerId, reviewedAt, contentId, expectedStatus]
    );
    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, statusCode: 409, message: conflictMessage };
    }
    if (contentType === 'comment' && transition.visibleToOthers && !item.is_hidden) {
      await client.query(`UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1`, [item.post_id]);
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
    const removalSnapshot = stage === 'final' && decision === 'violence'
      ? {
          type: 'moderation_removal',
          contentType,
          content: item.content || '',
          imageUrls: item.image_url ? [item.image_url] : [],
          createdAt: item.created_at || null,
          excerpt: (item.content || '').slice(0, 160),
        }
      : null;
    await client.query(
      `INSERT INTO notifications (recipient_id, type, content, target_post_id, payload)
       VALUES ($1, 'system', $2, $3, $4::jsonb)`,
      [item.author_id, imageReviewNotification(contentType, stage, decision), contentType === 'post' ? item.id : (contentType === 'comment' ? item.post_id : null), JSON.stringify(removalSnapshot)]
    );
    await client.query('COMMIT');
    return { ok: true, data: { id: String(item.id), type: contentType, postId: contentType === 'comment' ? String(item.post_id) : undefined, status: transition.nextStatus, decision, published: transition.visibleToOthers, reviewedAt } };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

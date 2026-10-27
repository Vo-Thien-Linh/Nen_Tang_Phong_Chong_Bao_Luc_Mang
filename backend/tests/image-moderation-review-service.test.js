import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewImageModeration, appealImageModeration } from '../src/services/imageModerationReviewService.js';

function mockPool({ rows = [], failAt = null } = {}) {
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.startsWith('SELECT')) return { rows };
      if (sql.startsWith('UPDATE') && !(failAt && sql.startsWith(failAt))) return { rows: [{ id: 4, author_id: 'author', post_id: 9 }] };
      if (failAt && sql.startsWith(failAt)) throw new Error('mock database failure');
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  return { queries, connect: async () => client };
}

test('first review of a missing item returns not found without writing', async () => {
  const pool = mockPool();
  const result = await reviewImageModeration({ pool, contentType: 'post', contentId: 4, stage: 'first', decision: 'safe', reviewerId: 'moderator' });
  assert.equal(result.statusCode, 404);
  assert.equal(pool.queries.some(({ sql }) => sql.startsWith('UPDATE')), false);
  assert.equal(pool.queries.at(-1).sql, 'ROLLBACK');
});

test('first review is rejected when the item is no longer pending', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', image_moderation_status: 'safe' }] });
  const result = await reviewImageModeration({ pool, contentType: 'post', contentId: 4, stage: 'first', decision: 'safe', reviewerId: 'moderator' });
  assert.equal(result.statusCode, 409);
  assert.equal(pool.queries.some(({ sql }) => sql.startsWith('UPDATE')), false);
});

test('first review records reviewer and time', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', content: 'hello', image_moderation_status: 'pending_review' }] });
  const reviewedAt = new Date('2026-10-25T00:00:00Z');
  const result = await reviewImageModeration({ pool, contentType: 'post', contentId: 4, stage: 'first', decision: 'safe', reviewerId: 'moderator', clock: () => reviewedAt });
  const update = pool.queries.find(({ sql }) => sql.startsWith('UPDATE'));
  assert.equal(update.values[1], 'moderator');
  assert.equal(update.values[2], reviewedAt);
  assert.equal(result.data.reviewedAt, reviewedAt);
});

test('first review writes a moderation log entry', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', content: 'hello', image_moderation_status: 'pending_review', image_moderation_safe: 0.91 }] });
  await reviewImageModeration({ pool, contentType: 'post', contentId: 4, stage: 'first', decision: 'safe', reviewerId: 'moderator' });
  const log = pool.queries.find(({ sql }) => sql.includes('INSERT INTO moderation_logs'));
  assert.match(log.sql, /\(user_id, content_type, content_id, raw_text, predicted_label, confidence, action_taken,/);
  assert.doesNotMatch(log.sql, /post_id/);
  assert.equal(log.values[0], 'moderator');
  assert.equal(log.values[6], 'image_review_first_safe');
  assert.equal(log.values[7], 'first');
  assert.equal(log.values[8], 'pending_review');
  assert.equal(log.values[9], 'safe');
  assert.deepEqual(JSON.parse(log.values[10]), { safe: 0.91 });
});

test('first review of a post writes valid notification columns', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', image_moderation_status: 'pending_review' }] });
  await reviewImageModeration({ pool, contentType: 'post', contentId: 4, stage: 'first', decision: 'safe', reviewerId: 'moderator' });
  const notification = pool.queries.find(({ sql }) => sql.includes('INSERT INTO notifications'));
  assert.match(notification.sql, /\(recipient_id, type, content, target_post_id, payload\)/);
  assert.deepEqual(notification.values, ['author', 'Bài viết của bạn đã được duyệt', 4, 'null']);
});

test('decide does not crash for an item without image scores', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', image_moderation_status: 'pending_review', image_moderation_safe: null, image_moderation_nsfw: null, image_moderation_violence: null, image_moderation_thresholds: null }] });
  const result = await reviewImageModeration({ pool, contentType: 'post', contentId: 4, stage: 'first', decision: 'safe', reviewerId: 'moderator' });
  const log = pool.queries.find(({ sql }) => sql.includes('INSERT INTO moderation_logs'));
  assert.equal(result.ok, true);
  assert.equal(log.values[5], 0);
  assert.deepEqual(JSON.parse(log.values[10]), { safe: null, nsfw: null, violence: null, thresholds: null });
});

test('final review records the final reviewer and prior appeal status in its log', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', content: 'hello', image_moderation_status: 'appeal_pending', image_moderation_nsfw: 0.7 }] });
  await reviewImageModeration({ pool, contentType: 'post', contentId: 4, stage: 'final', decision: 'nsfw', reviewerId: 'same-moderator' });
  const log = pool.queries.find(({ sql }) => sql.includes('INSERT INTO moderation_logs'));
  assert.equal(log.values[0], 'same-moderator');
  assert.equal(log.values[6], 'image_review_final_nsfw');
  assert.equal(log.values[7], 'final');
  assert.equal(log.values[8], 'appeal_pending');
  assert.equal(log.values[9], 'sensitive');
});

test('final review uses valid columns for posts and comments', async () => {
  for (const contentType of ['post', 'comment']) {
    const item = { id: 4, author_id: 'author', image_moderation_status: 'appeal_pending', ...(contentType === 'comment' ? { post_id: 9 } : {}) };
    const pool = mockPool({ rows: [item] });
    await reviewImageModeration({ pool, contentType, contentId: 4, stage: 'final', decision: 'safe', reviewerId: 'moderator' });
    const select = pool.queries.find(({ sql }) => sql.startsWith('SELECT'));
    const update = pool.queries.find(({ sql }) => sql.startsWith('UPDATE'));
    assert.match(select.sql, new RegExp(`FROM ${contentType === 'post' ? 'posts' : 'comments'}`));
    if (contentType === 'post') assert.doesNotMatch(select.sql, /\bpost_id\b/);
    else assert.match(select.sql, /author_id, post_id, content/);
    assert.match(update.sql, /RETURNING id, author_id, image_moderation_status/);
    assert.doesNotMatch(update.sql, /post_id/);
  }
});

test('failed first review rolls back without notifying the author', async () => {
  const pool = mockPool({
    rows: [{ id: 4, author_id: 'author', content: 'hello', image_moderation_status: 'pending_review' }],
    failAt: 'INSERT INTO moderation_logs',
  });
  await assert.rejects(() => reviewImageModeration({ pool, contentType: 'post', contentId: 4, stage: 'first', decision: 'safe', reviewerId: 'moderator' }), /mock database failure/);
  assert.equal(pool.queries.some(({ sql }) => sql === 'COMMIT'), false);
  assert.equal(pool.queries.at(-1).sql, 'ROLLBACK');
  assert.equal(pool.queries.some(({ sql }) => sql.includes('INSERT INTO notifications')), false);
});

test('decide rolls back when a statement fails', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', image_moderation_status: 'pending_review' }], failAt: 'INSERT INTO notifications' });
  await assert.rejects(() => reviewImageModeration({ pool, contentType: 'post', contentId: 4, stage: 'first', decision: 'safe', reviewerId: 'moderator' }), /mock database failure/);
  assert.equal(pool.queries.some(({ sql }) => sql === 'COMMIT'), false);
  assert.equal(pool.queries.at(-1).sql, 'ROLLBACK');
});

test('publishing an approved comment increments its parent count once', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', post_id: 9, ai_status: 'approved', is_hidden: false, image_moderation_status: 'pending_review' }] });
  await reviewImageModeration({ pool, contentType: 'comment', contentId: 4, stage: 'first', decision: 'safe', reviewerId: 'moderator' });
  const countUpdate = pool.queries.filter(({ sql }) => sql.includes('comments_count = comments_count + 1'));
  assert.equal(countUpdate.length, 1);
  assert.deepEqual(countUpdate[0].values, [9]);
});

test('first review of a comment uses comment table columns', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', post_id: 9, ai_status: 'approved', is_hidden: false, image_moderation_status: 'pending_review' }] });
  await reviewImageModeration({ pool, contentType: 'comment', contentId: 4, stage: 'first', decision: 'safe', reviewerId: 'moderator' });
  const select = pool.queries.find(({ sql }) => sql.startsWith('SELECT'));
  const notification = pool.queries.find(({ sql }) => sql.includes('INSERT INTO notifications'));
  assert.match(select.sql, /FROM comments/);
  assert.match(select.sql, /author_id, post_id, content/);
  assert.deepEqual(notification.values, ['author', 'Bình luận của bạn đã được duyệt', 9, 'null']);
});

test('final violence rejection does not increment its parent comment count', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', post_id: 9, ai_status: 'approved', is_hidden: false, image_moderation_status: 'appeal_pending' }] });
  await reviewImageModeration({ pool, contentType: 'comment', contentId: 4, stage: 'final', decision: 'violence', reviewerId: 'moderator' });
  assert.equal(pool.queries.some(({ sql }) => sql.includes('comments_count = comments_count + 1')), false);
});

test('owner can appeal an admin rejected item', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', image_moderation_status: 'rejected_admin', content: 'image post' }] });
  const result = await appealImageModeration({ pool, contentType: 'post', contentId: 4, authorId: 'author', clock: () => new Date('2026-10-25T00:00:00Z') });
  assert.equal(result.data.status, 'appeal_pending');
  assert.equal(pool.queries.some(({ sql }) => sql.includes('image_moderation_appealed_at IS NULL')), true);
  assert.equal(pool.queries.some(({ sql }) => sql.includes('INSERT INTO notifications')), false);
  assert.equal(pool.queries.at(-1).sql, 'COMMIT');
});

test('appeal submit uses valid columns for posts and comments', async () => {
  for (const contentType of ['post', 'comment']) {
    const item = { id: 4, author_id: 'author', image_moderation_status: 'rejected_admin', ...(contentType === 'comment' ? { post_id: 9 } : {}) };
    const pool = mockPool({ rows: [item] });
    await appealImageModeration({ pool, contentType, contentId: 4, authorId: 'author' });
    const select = pool.queries.find(({ sql }) => sql.startsWith('SELECT'));
    const update = pool.queries.find(({ sql }) => sql.startsWith('UPDATE'));
    assert.match(select.sql, new RegExp(`FROM ${contentType === 'post' ? 'posts' : 'comments'}`));
    if (contentType === 'post') assert.doesNotMatch(select.sql, /\bpost_id\b/);
    else assert.match(select.sql, /author_id, post_id, content/);
    assert.match(update.sql, /RETURNING id/);
    assert.doesNotMatch(update.sql, /RETURNING id, post_id/);
  }
});

test('non owner cannot appeal an image item', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', image_moderation_status: 'rejected_admin' }] });
  const result = await appealImageModeration({ pool, contentType: 'post', contentId: 4, authorId: 'other-user' });
  assert.equal(result.statusCode, 404);
  assert.equal(pool.queries.some(({ sql }) => sql.startsWith('UPDATE')), false);
});

test('second appeal is rejected and leaves the item unchanged', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', image_moderation_status: 'rejected_admin', image_moderation_appealed_at: new Date('2026-10-24T00:00:00Z') }] });
  const result = await appealImageModeration({ pool, contentType: 'post', contentId: 4, authorId: 'author' });
  assert.equal(result.statusCode, 409);
  assert.equal(result.message, 'Bạn đã khiếu nại mục này');
  assert.equal(pool.queries.some(({ sql }) => sql.startsWith('UPDATE')), false);
});

test('appeal of a published item is rejected', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', image_moderation_status: 'sensitive' }] });
  const result = await appealImageModeration({ pool, contentType: 'post', contentId: 4, authorId: 'author' });
  assert.equal(result.statusCode, 409);
  assert.equal(pool.queries.some(({ sql }) => sql.startsWith('UPDATE')), false);
});

test('decide endpoints reject invalid decision values', async () => {
  let connected = false;
  const result = await reviewImageModeration({ pool: { connect: async () => { connected = true; } }, contentType: 'post', contentId: 4, stage: 'first', decision: 'reject', reviewerId: 'moderator' });
  assert.equal(result.statusCode, 400);
  assert.equal(connected, false);
});

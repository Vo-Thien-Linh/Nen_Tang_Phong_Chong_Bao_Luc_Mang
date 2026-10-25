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

test('first review of a missing item returns a conflict without writing', async () => {
  const pool = mockPool();
  const result = await reviewImageModeration({ pool, contentType: 'post', contentId: 4, stage: 'first', decision: 'safe', reviewerId: 'moderator' });
  assert.equal(result.statusCode, 409);
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
  assert.equal(log.values[0], 'moderator');
  assert.equal(log.values[6], 'image_review_first_safe');
  assert.equal(log.values[7], 'first');
  assert.equal(log.values[8], 'pending_review');
  assert.equal(log.values[9], 'safe');
  assert.deepEqual(JSON.parse(log.values[10]), { safe: 0.91 });
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

test('owner can appeal an admin rejected item', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', image_moderation_status: 'rejected_admin', content: 'image post' }] });
  const result = await appealImageModeration({ pool, contentType: 'post', contentId: 4, authorId: 'author', clock: () => new Date('2026-10-25T00:00:00Z') });
  assert.equal(result.data.status, 'appeal_pending');
  assert.equal(pool.queries.some(({ sql }) => sql.includes('image_moderation_appealed_at IS NULL')), true);
  assert.equal(pool.queries.some(({ sql }) => sql.includes('INSERT INTO notifications')), false);
  assert.equal(pool.queries.at(-1).sql, 'COMMIT');
});

test('owner can appeal an unexpired held item', async () => {
  const pool = mockPool({ rows: [{ id: 4, author_id: 'author', image_moderation_status: 'rejected_hold', moderation_expires_at: new Date('2026-10-25T00:10:00Z'), content: 'image post' }] });
  const result = await appealImageModeration({ pool, contentType: 'post', contentId: 4, authorId: 'author', clock: () => new Date('2026-10-25T00:05:00Z') });
  const update = pool.queries.find(({ sql }) => sql.startsWith('UPDATE'));
  assert.equal(result.data.status, 'appeal_pending');
  assert.match(update.sql, /moderation_expires_at > \$4/);
});

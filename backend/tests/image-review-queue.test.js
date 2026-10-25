import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageModerationRouter, listReviewQueue } from '../src/routes/imageModerationRouter.js';

function makeQueuePool(rowsByTable = {}) {
  const queries = [];
  return {
    queries,
    async query(sql, values) {
      queries.push({ sql, values });
      const table = sql.includes('FROM posts item') ? 'posts' : 'comments';
      return { rows: rowsByTable[table] || [] };
    },
  };
}

test('moderator queue lists first review items', async () => {
  const pool = makeQueuePool({ posts: [{ id: 7, content_type: 'post', author_id: 'author', author_name: 'A', content: 'text', image_url: '/image.jpg', status: 'pending_review', model_label: 'Violence', safe: 0.1, nsfw: 0.2, violence: 0.7, created_at: new Date('2026-10-25T00:00:00Z') }] });
  const result = await listReviewQueue(pool, 'pending_review', { type: 'post', page: '1', limit: '10' });
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].type, 'post');
  assert.equal(result.data[0].author.name, 'A');
  assert.equal(result.data[0].modelScores.violence, 0.7);
  assert.match(pool.queries[0].sql, /image_moderation_status = \$1/);
});

test('moderator can list final review items with previous decision', async () => {
  const previousDecision = { label: 'Violence', reviewerName: 'Mod', reviewedAt: '2026-10-24T12:00:00Z' };
  const pool = makeQueuePool({ comments: [{ id: 8, content_type: 'comment', author_id: 'author', author_name: 'A', content: 'text', image_url: '/image.jpg', status: 'appeal_pending', model_label: 'Violence', safe: 0.1, nsfw: 0.2, violence: 0.7, created_at: new Date('2026-10-25T00:00:00Z'), previous_decision: previousDecision, appealed_at: '2026-10-24T13:00:00Z' }] });
  const result = await listReviewQueue(pool, 'appeal_pending', { type: 'comment' }, true);
  assert.deepEqual(result.data[0].previousDecision, previousDecision);
  assert.equal(result.data[0].appealedAt, '2026-10-24T13:00:00Z');
  assert.match(pool.queries[0].sql, /image_review_stage = 'first'/);
});

test('image review queues filter by post or comment type', async () => {
  const pool = makeQueuePool();
  await listReviewQueue(pool, 'pending_review', { type: 'comment' });
  assert.equal(pool.queries.length, 1);
  assert.match(pool.queries[0].sql, /FROM comments item/);
  assert.doesNotMatch(pool.queries[0].sql, /FROM posts item/);
});

test('image review queues return the oldest item first', async () => {
  const pool = makeQueuePool({
    posts: [{ id: 9, content_type: 'post', author_id: 'a', author_name: 'A', status: 'pending_review', created_at: '2026-10-25T02:00:00Z' }],
    comments: [{ id: 3, content_type: 'comment', author_id: 'b', author_name: 'B', status: 'pending_review', created_at: '2026-10-25T01:00:00Z' }],
  });
  const result = await listReviewQueue(pool, 'pending_review', { type: 'all' });
  assert.equal(result.data[0].type, 'comment');
  assert.equal(result.data[1].type, 'post');
});

test('regular users are rejected from both image review queues', async () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const pool = { async query(sql) { return sql.includes('FROM users') ? { rows: [{ id: userId, role: 'user', status: 'active' }] } : { rows: [] }; } };
  const router = createImageModerationRouter({ pool });
  for (const path of ['/pending', '/appeals']) {
    const handlers = router.stack.find((layer) => layer.route?.path === path).route.stack;
    const req = { query: {}, header: (name) => name === 'x-user-id' ? userId : undefined };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handlers[0].handle(req, res, () => {});
    await handlers[1].handle(req, res, () => {});
    assert.equal(res.statusCode, 403);
  }
});

test('appealed item appears in the final review list', async () => {
  const pool = makeQueuePool({ posts: [{ id: 11, content_type: 'post', author_id: 'a', author_name: 'A', status: 'appeal_pending', created_at: '2026-10-25T00:00:00Z', appealed_at: '2026-10-25T00:01:00Z' }] });
  const result = await listReviewQueue(pool, 'appeal_pending', { type: 'all' }, true);
  assert.equal(result.data[0].id, '11');
  assert.equal(result.data[0].status, 'appeal_pending');
  assert.equal(result.data[0].appealedAt, '2026-10-25T00:01:00Z');
});

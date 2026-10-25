import test from 'node:test';
import assert from 'node:assert/strict';
import { listReviewQueue } from '../src/routes/imageModerationRouter.js';

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

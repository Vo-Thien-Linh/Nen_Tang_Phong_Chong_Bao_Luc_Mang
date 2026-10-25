import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewImageModeration } from '../src/services/imageModerationReviewService.js';

function mockPool({ rows = [], failAt = null } = {}) {
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.startsWith('SELECT')) return { rows };
      if (sql.startsWith('UPDATE') && !failAt) return { rows: [{ id: 4, author_id: 'author', post_id: 9 }] };
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { appealImageModeration } from '../src/services/imageModerationReviewService.js';

test('appeal is allowed long after the item was held', async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.startsWith('SELECT')) return { rows: [{ id: 4, author_id: 'author', image_moderation_status: 'rejected_hold', image_moderation_violence: 0.95, content: 'old held post' }] };
      if (sql.startsWith('UPDATE')) return { rows: [{ id: 4 }] };
      return { rows: [] };
    },
    release() {},
  };
  const result = await appealImageModeration({
    pool: { async connect() { return client; } },
    contentType: 'post',
    contentId: 4,
    authorId: 'author',
    clock: () => new Date('2035-01-01T00:00:00Z'),
  });

  assert.equal(result.data.status, 'appeal_pending');
  assert.doesNotMatch(queries.find((sql) => sql.startsWith('UPDATE')), /moderation_expires_at|CURRENT_TIMESTAMP/);
});

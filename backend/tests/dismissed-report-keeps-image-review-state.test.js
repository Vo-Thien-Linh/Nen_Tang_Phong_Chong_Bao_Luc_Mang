import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreReportedTextModeration } from '../src/services/reportDismissal.js';

test('dismissed report keeps image review state', async () => {
  const imageReviewState = {
    image_moderation_status: 'appeal_pending',
    image_moderation_label: 'violence',
    moderation_expires_at: '2026-10-27T00:00:00.000Z',
  };
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
    },
  };

  await restoreReportedTextModeration(pool, { targetType: 'post', targetId: 'post-1' });

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /SET ai_label = 'Normal', ai_status = 'approved'/);
  assert.doesNotMatch(queries[0].sql, /image_moderation|moderation_expires_at/);
  assert.deepEqual(imageReviewState, {
    image_moderation_status: 'appeal_pending',
    image_moderation_label: 'violence',
    moderation_expires_at: '2026-10-27T00:00:00.000Z',
  });
});

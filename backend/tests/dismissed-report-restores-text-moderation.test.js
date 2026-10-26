import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreReportedTextModeration } from '../src/services/reportDismissal.js';

test('dismissed report restores text moderation of the reported item', async () => {
  const post = { id: 'post-2', ai_label: 'Toxic', ai_status: 'hidden' };
  const pool = {
    async query(sql, params) {
      assert.match(sql, /UPDATE posts/);
      assert.deepEqual(params, ['post-2']);
      post.ai_label = 'Normal';
      post.ai_status = 'approved';
      return { rowCount: 1 };
    },
  };

  await restoreReportedTextModeration(pool, { targetType: 'post', targetId: post.id });

  assert.deepEqual(post, { id: 'post-2', ai_label: 'Normal', ai_status: 'approved' });
});

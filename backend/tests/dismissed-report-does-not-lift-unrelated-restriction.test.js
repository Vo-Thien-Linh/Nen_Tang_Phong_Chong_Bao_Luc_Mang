import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreReportedTextModeration } from '../src/services/reportDismissal.js';

test('dismissed report does not lift unrelated restriction', async () => {
  const user = {
    id: 'author-1',
    status: 'cooldown',
    cooldown_reason: 'restriction from another moderation decision',
  };
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
    },
  };

  await restoreReportedTextModeration(pool, { targetType: 'comment', targetId: 'comment-1' });

  assert.equal(user.status, 'cooldown');
  assert.equal(user.cooldown_reason, 'restriction from another moderation decision');
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /UPDATE comments/);
  assert.doesNotMatch(queries[0].sql, /UPDATE users/);
});

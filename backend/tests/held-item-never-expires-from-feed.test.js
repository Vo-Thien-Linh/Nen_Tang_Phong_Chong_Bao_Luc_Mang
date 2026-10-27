import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';

test('held item is never deleted by time', async () => {
  let query;
  const repository = createPostRepository({ pool: { async query(sql) { query = sql; return { rows: [] }; } } });
  await repository.findVisiblePosts({ viewerId: 'author-1' });

  assert.match(query, /p\.author_id = \$1 AND p\.image_moderation_status IN \('pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending'\)/);
  assert.doesNotMatch(query.slice(query.indexOf('WHERE')), /moderation_expires_at|CURRENT_TIMESTAMP/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';

test('rejected final comments are excluded from feed comment lists', async () => {
  const queries = [];
  const repository = createPostRepository({ pool: { async query(sql) {
    queries.push(sql);
    if (sql.includes('FROM posts p')) return { rows: [{ id: 1, author_id: 'author', ai_status: 'approved', comments_count: 0 }] };
    return { rows: [] };
  } } });
  await repository.findVisiblePosts({ viewerId: 'viewer' });
  const commentQuery = queries.find((sql) => sql.includes('FROM comments c'));
  assert.ok(commentQuery);
  assert.doesNotMatch(commentQuery, /rejected_final/);
  assert.match(commentQuery, /c\.image_moderation_status IS NULL OR c\.image_moderation_status IN \('safe', 'sensitive'\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';

test('edit sql uses valid columns and parameters', async () => {
  const queries = [];
  const repository = createPostRepository({ pool: { async query(sql, values) {
    queries.push({ sql, values });
    if (sql.startsWith('UPDATE posts')) return { rows: [{ id: 7 }] };
    if (sql.includes('FROM posts p')) return { rows: [{ id: 7, author_id: 'u1', content: 'edited', image_url: 'new.png', image_moderation_status: 'safe', image_moderation_label: 'Safe' }] };
    return { rows: [] };
  } } });

  await repository.updatePost({
    postId: 7, authorId: 'u1', content: 'edited', imageUrl: 'new.png',
    imageModeration: { decision: 'safe', label: 'Safe', images: [{ scores: { safe: 0.99, nsfw: 0, violence: 0 } }], thresholds: { safe: 0.8 } },
  });

  const update = queries.find(({ sql }) => sql.startsWith('UPDATE posts'));
  assert.match(update.sql, /image_moderation_label = \$6/);
  assert.match(update.sql, /image_moderation_thresholds = \$10/);
  assert.equal(update.values.length, 10);
  assert.deepEqual(update.values.slice(0, 6), [7, 'u1', 'edited', 'new.png', 'safe', 'Safe']);
  assert.deepEqual(update.values.slice(6), [0.99, 0, 0, { safe: 0.8 }]);
});

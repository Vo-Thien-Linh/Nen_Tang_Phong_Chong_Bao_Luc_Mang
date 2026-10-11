import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';

test('author sees own posts while others see only approved posts', async () => {
  const queries = [];
  const repository = createPostRepository({
    pool: {
      async query(sql, params) {
        queries.push({ sql, params });
        return { rows: [] };
      },
    },
  });

  await repository.findVisiblePosts({ viewerId: null });
  await repository.findVisiblePosts({ viewerId: 'author-1' });

  assert.match(queries[0].sql, /p\.ai_status = 'approved'/);
  assert.deepEqual(queries[0].params, []);

  assert.match(queries[1].sql, /p\.ai_status = 'approved' OR p\.author_id = \$1/);
  assert.deepEqual(queries[1].params, ['author-1']);
});

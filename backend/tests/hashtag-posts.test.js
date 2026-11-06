import test from 'node:test';
import assert from 'node:assert/strict';
import { createHashtagRepository } from '../src/repositories/hashtagRepository.js';

function browseRepo(rows = [{ id: 2, total_count: 3 }, { id: 1, total_count: 3 }]) {
  const queries = [];
  const repository = createHashtagRepository({
    pool: {
      async query(sql, params) {
        queries.push({ sql, params });
        return { rows };
      },
    },
    postRepository: {
      async findById(id) { return { id, content: `post-${id}` }; },
    },
  });
  return { repository, queries };
}

test('hashtag posts are newest first and paginated', async () => {
  const { repository, queries } = browseRepo();
  const result = await repository.findPosts({ tag: 'wings', page: 2, limit: 2, viewerId: 'u1' });
  assert.deepEqual(result.posts.map((post) => post.id), [2, 1]);
  assert.equal(result.total, 3);
  assert.deepEqual(queries[0].params, ['u1', 'wings', 2, 2]);
  assert.match(queries[0].sql, /ORDER BY p\.created_at DESC/i);
});

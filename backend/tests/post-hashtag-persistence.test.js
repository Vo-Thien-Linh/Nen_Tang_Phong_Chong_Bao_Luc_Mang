import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';

function queryPool({ insertRows = [{ id: 11 }], failInsert = false } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('INSERT INTO posts')) {
        if (failInsert) throw new Error('insert failed');
        return { rows: insertRows };
      }
      return { rows: [] };
    },
  };
}

test('create post stores its hashtags', async () => {
  const pool = queryPool();
  await createPostRepository({ pool }).createPost({
    authorId: 'u1',
    content: 'Hello #One #SinhViên',
  });

  const hashtagInserts = pool.queries.filter(({ sql }) => sql.includes('INSERT INTO post_hashtags'));
  assert.deepEqual(hashtagInserts.map(({ params }) => params.slice(1)), [
    ['one', 'One'],
    ['sinhviên', 'SinhViên'],
  ]);
});

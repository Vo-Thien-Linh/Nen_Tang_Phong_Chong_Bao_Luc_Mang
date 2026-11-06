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

test('create post without hashtags stores none', async () => {
  const pool = queryPool();
  await createPostRepository({ pool }).createPost({ authorId: 'u1', content: 'No tags here' });
  assert.equal(pool.queries.some(({ sql }) => sql.includes('post_hashtags')), false);
});

test('failed post creation stores no hashtags', async () => {
  const pool = queryPool({ failInsert: true });
  await assert.rejects(
    () => createPostRepository({ pool }).createPost({ authorId: 'u1', content: 'Fail #NoWrite' }),
    /insert failed/
  );
  assert.equal(pool.queries.some(({ sql }) => sql.includes('post_hashtags')), false);
});

test('edit replaces hashtags with the new text', async () => {
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('UPDATE posts')) return { rows: [{ id: 11 }] };
      return { rows: [] };
    },
  };
  await createPostRepository({ pool }).updatePost({
    postId: 11,
    authorId: 'u1',
    content: 'Edited #NewTag',
    imageUrl: null,
  });
  assert.equal(queries.some(({ sql }) => sql.includes('DELETE FROM post_hashtags')), true);
  assert.deepEqual(queries.find(({ sql }) => sql.includes('INSERT INTO post_hashtags')).params.slice(1), ['newtag', 'NewTag']);
});

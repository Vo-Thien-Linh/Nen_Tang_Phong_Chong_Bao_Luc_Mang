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

test('edit removing all hashtags clears them', async () => {
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('UPDATE posts')) return { rows: [{ id: 11 }] };
      return { rows: [] };
    },
  };
  await createPostRepository({ pool }).updatePost({ postId: 11, authorId: 'u1', content: 'No hashtags', imageUrl: null });
  assert.equal(queries.filter(({ sql }) => sql.includes('post_hashtags')).length, 1);
  assert.match(queries.find(({ sql }) => sql.includes('post_hashtags')).sql, /DELETE FROM post_hashtags/);
});

test('blocked edit does not change hashtags', async () => {
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [] };
    },
  };
  await assert.rejects(
    () => createPostRepository({ pool }).updatePost({ postId: 11, authorId: 'u1', content: 'Blocked #New', imageUrl: null }),
    (error) => error.statusCode === 404,
  );
  assert.equal(queries.some(({ sql }) => sql.includes('post_hashtags')), false);
});

test('tags are written in the same transaction as the post', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('INSERT INTO posts')) return { rows: [{ id: 12 }] };
      return { rows: [] };
    },
    release() { calls.push({ sql: 'RELEASE' }); },
  };
  const pool = { connect: async () => client, async query() { return { rows: [] }; } };
  await createPostRepository({ pool }).createPost({ authorId: 'u1', content: 'Atomic #Tag' });
  assert.equal(calls[0].sql, 'BEGIN');
  assert.ok(calls.some(({ sql }) => sql.includes('INSERT INTO post_hashtags')));
  assert.equal(calls.at(-2).sql, 'COMMIT');
  assert.equal(calls.at(-1).sql, 'RELEASE');
});

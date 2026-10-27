import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';

test('delete returns not found when no row was deleted', async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      return { rows: [] };
    },
    release() {},
  };
  const repository = createPostRepository({ pool: { async connect() { return client; } } });

  await assert.rejects(
    () => repository.deletePost({ postId: '1', authorId: 'u1' }),
    (error) => error.statusCode === 404
  );
  assert.equal(statements.some((sql) => sql === 'COMMIT'), false);
  assert.equal(statements.at(-1), 'ROLLBACK');
});

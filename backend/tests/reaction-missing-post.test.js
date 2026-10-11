import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactionRepository } from '../src/repositories/reactionRepository.js';

test('reject reaction on missing or deleted post with not found message', async () => {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('SELECT id, author_id, likes_count')) {
        return { rows: [] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const repository = createReactionRepository({
    pool: {
      async connect() {
        return client;
      },
    },
  });

  await assert.rejects(
    () => repository.setReaction({ userId: 'user-1', postId: '404', reactionType: 'like' }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, 'Bài viết không tồn tại');
      return true;
    }
  );

  assert.equal(queries.at(-1).sql, 'ROLLBACK');
});

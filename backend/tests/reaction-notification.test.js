import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactionRepository } from '../src/repositories/reactionRepository.js';

async function reactWithAuthor({ actorId, authorId }) {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('SELECT id, author_id, likes_count')) {
        return { rows: [{ id: '10', author_id: authorId, likes_count: 0 }] };
      }
      if (sql.includes('SELECT reaction_type')) {
        return { rows: [] };
      }
      if (sql.includes('SELECT reaction_type, COUNT')) {
        return { rows: [{ reaction_type: 'like', count: 1 }] };
      }
      if (sql.includes('SELECT likes_count')) {
        return { rows: [{ likes_count: 1 }] };
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

  await repository.setReaction({ userId: actorId, postId: '10', reactionType: 'like' });
  return queries;
}

test('notify post author on new reaction but not on self reaction', async () => {
  const otherReactionQueries = await reactWithAuthor({ actorId: 'user-2', authorId: 'user-1' });
  const selfReactionQueries = await reactWithAuthor({ actorId: 'user-1', authorId: 'user-1' });

  assert.ok(otherReactionQueries.some((query) => query.sql.includes('INSERT INTO notifications')));
  assert.equal(selfReactionQueries.some((query) => query.sql.includes('INSERT INTO notifications')), false);
});

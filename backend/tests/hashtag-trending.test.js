import test from 'node:test';
import assert from 'node:assert/strict';
import { createHashtagRepository } from '../src/repositories/hashtagRepository.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function repoWithRows(rows) {
  const queries = [];
  return {
    queries,
    repository: createHashtagRepository({
      pool: {
        async query(sql, params) {
          queries.push({ sql, params });
          return { rows };
        },
      },
      postRepository: { async findById(id) { return { id }; } },
    }),
  };
}

test('trending ranks by distinct authors then posts', async () => {
  const { repository } = repoWithRows([
    { tag: 'wings', display_tag: 'Wings', post_count: 4, author_count: 3 },
    { tag: 'btl', display_tag: 'BTL', post_count: 9, author_count: 2 },
  ]);
  const result = await repository.findTrending({ limit: 5, days: 7 });
  assert.deepEqual(result, [
    { tag: 'wings', displayTag: 'Wings', postCount: 4, authorCount: 3 },
    { tag: 'btl', displayTag: 'BTL', postCount: 9, authorCount: 2 },
  ]);
});

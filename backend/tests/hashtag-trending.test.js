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

test('one author repeating a tag counts once for ranking', async () => {
  const { repository, queries } = repoWithRows([]);
  await repository.findTrending({ limit: 5, days: 7 });
  assert.match(queries[0].sql, /COUNT\(DISTINCT author_id\)/i);
  assert.match(queries[0].sql, /COUNT\(DISTINCT id\)/i);
});

test('trending excludes posts under image review for everyone', async () => {
  const { repository, queries } = repoWithRows([]);
  await repository.findTrending({ limit: 5, days: 7 });
  assert.match(queries[0].sql, /image_moderation_status IS NULL OR p\.image_moderation_status IN \('safe', 'sensitive'\)/i);
  assert.match(queries[0].sql, /p\.ai_status = 'approved'/i);
});

test('trending excludes rejected and appealed posts', async () => {
  const { repository, queries } = repoWithRows([]);
  await repository.findTrending({ limit: 5, days: 7 });
  const sql = queries[0].sql;
  assert.doesNotMatch(sql, /rejected_admin|appeal_pending|rejected_final/i);
  assert.match(sql, /p\.ai_status = 'approved'/i);
});

test('trending excludes posts older than the window', async () => {
  const { repository, queries } = repoWithRows([]);
  await repository.findTrending({ limit: 5, days: 7 });
  assert.match(queries[0].sql, /p\.created_at >= CURRENT_TIMESTAMP - \(\$1 \* INTERVAL '1 day'\)/i);
  assert.deepEqual(queries[0].params, [7, 5]);
});

test('trending counts a post once per hashtag', async () => {
  const { repository, queries } = repoWithRows([]);
  await repository.findTrending({ limit: 5, days: 7 });
  assert.match(queries[0].sql, /COUNT\(DISTINCT id\)/i);
});

test('trending respects the limit', async () => {
  const { repository, queries } = repoWithRows([]);
  await repository.findTrending({ limit: 99, days: 7 });
  assert.equal(queries[0].params[1], 10);
  assert.match(queries[0].sql, /LIMIT \$2/i);
});

test('trending requires authentication', () => {
  const route = readFileSync(fileURLToPath(new URL('../src/routes/hashtagsRouter.js', import.meta.url)), 'utf8');
  assert.match(route, /router\.get\('\/trending', requireAuth/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reviewImageModeration, appealImageModeration } from '../src/services/imageModerationReviewService.js';
import { broadcastPublishedItem } from '../src/routes/imageModerationRouter.js';

const schema = readFileSync(fileURLToPath(new URL('../../database/schema.sql', import.meta.url)), 'utf8');
const tableColumns = new Map();
for (const [, table, body] of schema.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
  const columns = new Set();
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s{4}([a-z_]\w*)\s+[A-Z][A-Z0-9_]*/i);
    if (match && !['constraint', 'primary', 'unique', 'foreign', 'check'].includes(match[1].toLowerCase())) columns.add(match[1]);
  }
  tableColumns.set(table.toLowerCase(), columns);
}
for (const migration of ['002_posts_edited_at.sql', '003_add_share_post.sql', '004_add_image_moderation.sql', '005_add_moderation_expiry.sql', '006_image_appeal_review_columns.sql', '007_add_comment_moderation_state.sql', '008_image_review_notification_snapshot.sql']) {
  const sql = readFileSync(fileURLToPath(new URL(`../../database/migrations/${migration}`, import.meta.url)), 'utf8');
  for (const [, table, additions] of sql.matchAll(/ALTER TABLE\s+(\w+)\s+([\s\S]*?);/gi)) {
    const known = tableColumns.get(table.toLowerCase());
    for (const [, column] of additions.matchAll(/ADD COLUMN IF NOT EXISTS\s+(\w+)/gi)) known?.add(column);
  }
}

function validateStatement(sql) {
  const tables = '(posts|comments|notifications|moderation_logs|users)';
  const table = sql.match(new RegExp(`\\bFROM\\s+${tables}\\b`, 'i'))?.[1]?.toLowerCase()
    || sql.match(new RegExp(`\\bUPDATE\\s+${tables}\\b`, 'i'))?.[1]?.toLowerCase()
    || sql.match(new RegExp(`\\bINSERT\\s+INTO\\s+${tables}\\b`, 'i'))?.[1]?.toLowerCase();
  if (!table) return;
  const aliases = new Map();
  for (const [, joinedTable, alias] of sql.matchAll(new RegExp(`\\b(?:FROM|JOIN)\\s+${tables}\\s+(?:AS\\s+)?(\\w+)`, 'gi'))) aliases.set(alias.toLowerCase(), joinedTable.toLowerCase());
  const columns = [];
  const addColumn = (raw) => {
    const name = raw.trim().split(/\s+AS\s+/i)[0];
    const parts = name.split('.');
    const owner = parts.length > 1 ? aliases.get(parts[0].toLowerCase()) || table : table;
    columns.push({ owner, name: parts.at(-1) });
  };
  const select = sql.match(/\bSELECT\s+([\s\S]+?)\s+FROM\s+/i)?.[1];
  if (select) select.split(',').forEach(addColumn);
  const insert = sql.match(/\bINSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i)?.[1];
  if (insert) insert.split(',').forEach(addColumn);
  const set = sql.match(/\bSET\s+([\s\S]+?)(?:\bWHERE\b|\bRETURNING\b|$)/i)?.[1];
  if (set) set.split(',').forEach((assignment) => addColumn(assignment.split('=')[0]));
  const returning = sql.match(/\bRETURNING\s+([\s\S]+)$/i)?.[1];
  if (returning) returning.split(',').forEach(addColumn);
  const where = sql.match(/\bWHERE\s+([\s\S]+?)(?:\bRETURNING\b|\bORDER\s+BY\b|\bLIMIT\b|\bFOR\s+UPDATE\b|$)/i)?.[1];
  if (where) [...where.matchAll(/\b([a-z_]\w*(?:\.[a-z_]\w*)?)\s*(?:<>|>=|<=|=|>|<|\bIS\b)/gi)].forEach((match) => addColumn(match[1]));
  for (const { owner, name } of columns) {
    const known = tableColumns.get(owner);
    assert.ok(known?.has(name), `${owner}.${name} exists in database/schema.sql plus migrations 002-006; SQL: ${sql}`);
  }
}

function mockPool(item) {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.startsWith('SELECT')) return { rows: [item] };
      if (sql.startsWith('UPDATE')) return { rows: [{ id: item.id, author_id: item.author_id }] };
      return { rows: [] };
    },
    release() {},
  };
  return { queries, connect: async () => client };
}

test('guard review sql against unknown columns', async () => {
  for (const contentType of ['post', 'comment']) {
    const tableFields = contentType === 'comment' ? { post_id: 12 } : {};
    const firstPool = mockPool({ id: 3, author_id: 'author', image_moderation_status: 'pending_review', ...tableFields });
    await reviewImageModeration({ pool: firstPool, contentType, contentId: 3, stage: 'first', decision: 'safe', reviewerId: 'moderator' });

    const appealPool = mockPool({ id: 3, author_id: 'author', image_moderation_status: 'rejected_admin', ...tableFields });
    await appealImageModeration({ pool: appealPool, contentType, contentId: 3, authorId: 'author' });

    const finalPool = mockPool({ id: 3, author_id: 'author', image_moderation_status: 'appeal_pending', ...tableFields });
    await reviewImageModeration({ pool: finalPool, contentType, contentId: 3, stage: 'final', decision: 'safe', reviewerId: 'moderator' });

    for (const sql of [...firstPool.queries, ...appealPool.queries, ...finalPool.queries]) validateStatement(sql);
  }

  const postQueries = [];
  await broadcastPublishedItem({ async query(sql) {
    postQueries.push(sql);
    return { rows: [{ id: 3, author_id: 'author', image_moderation_status: 'safe', ai_status: 'approved' }] };
  } }, { id: 3, type: 'post' });

  const commentQueries = [];
  await broadcastPublishedItem({ async query(sql) {
    commentQueries.push(sql);
    if (sql.includes('FROM comments')) return { rows: [{ id: 4, post_id: 3, author_id: 'author', image_moderation_status: 'safe', is_hidden: false }] };
    return { rows: [{ id: 3, ai_status: 'approved' }] };
  } }, { id: 4, type: 'comment' });
  for (const sql of [...postQueries, ...commentQueries]) validateStatement(sql);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const schema = readFileSync(`${root}/database/schema.sql`, 'utf8');
const migration = readFileSync(`${root}/database/migrations/010_add_post_hashtags.sql`, 'utf8');

test('post hashtag schema is idempotent and cascades with posts', () => {
  for (const sql of [schema, migration]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS post_hashtags/i);
    assert.match(sql, /post_id BIGINT NOT NULL REFERENCES posts\(id\) ON DELETE CASCADE/i);
    assert.match(sql, /tag VARCHAR\(50\) NOT NULL/i);
    assert.match(sql, /display_tag VARCHAR\(50\) NOT NULL/i);
    assert.match(sql, /PRIMARY KEY \(post_id, tag\)/i);
    assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_post_hashtags_tag/i);
  }
});

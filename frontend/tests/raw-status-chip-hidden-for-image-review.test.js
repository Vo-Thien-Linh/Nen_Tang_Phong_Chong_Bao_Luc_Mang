import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('raw status chip is hidden when image review status exists', async () => {
  const source = await readFile(new URL('../src/components/PostCard.jsx', import.meta.url), 'utf8');
  assert.match(source, /post\.moderationStatus && post\.moderationStatus !== 'approved' && !postImageStatus/);
});

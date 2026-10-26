import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('original post modal loads sensitive notice state from the API', async () => {
  const source = await readFile(new URL('../src/components/OriginalPostModal.jsx', import.meta.url), 'utf8');
  assert.match(source, /setPostImageModeration\(apiData\.imageModeration \|\| null\)/);
  assert.match(source, /isOriginalPostAuthor && originalImageStatus === 'sensitive'/);
});

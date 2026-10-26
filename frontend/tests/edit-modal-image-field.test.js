import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('edit modal sends the new image field', async () => {
  const modal = await readFile(new URL('../src/components/EditPostModal.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../src/api/client.js', import.meta.url), 'utf8');
  assert.match(modal, /const uploadedUrl = await uploadPostImage\(file\)/);
  assert.match(modal, /imageUrl: imageUrl \|\| null/);
  assert.match(api, /body: JSON\.stringify\(\{ content, imageUrl \}\)/);
});

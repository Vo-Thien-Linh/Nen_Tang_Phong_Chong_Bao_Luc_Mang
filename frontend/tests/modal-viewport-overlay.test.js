import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('modal overlay is fixed to the viewport', async () => {
  const [edit, remove] = await Promise.all([
    readFile(new URL('../src/components/EditPostModal.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/DeletePostModal.jsx', import.meta.url), 'utf8'),
  ]);
  for (const source of [edit, remove]) {
    assert.match(source, /fixed inset-0 z-\[100\] flex items-center justify-center/);
    assert.match(source, /max-h-\[90vh\]/);
    assert.match(source, /overflow-y-auto/);
  }
});

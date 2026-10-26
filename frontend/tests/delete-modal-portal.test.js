import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('delete modal is rendered through a portal', async () => {
  const source = await readFile(new URL('../src/components/DeletePostModal.jsx', import.meta.url), 'utf8');
  assert.match(source, /createPortal\(/);
  assert.match(source, /document\.body/);
});

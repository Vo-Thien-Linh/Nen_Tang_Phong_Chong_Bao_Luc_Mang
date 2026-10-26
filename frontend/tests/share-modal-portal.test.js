import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('share modal is rendered through a portal', async () => {
  const source = await readFile(new URL('../src/components/SharePostModal.jsx', import.meta.url), 'utf8');
  assert.match(source, /createPortal\(/);
  assert.match(source, /document\.body/);
});

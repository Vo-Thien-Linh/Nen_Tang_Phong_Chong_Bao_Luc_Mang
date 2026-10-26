import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('edit modal stays open and shows the error on failure', async () => {
  const source = await readFile(new URL('../src/components/EditPostModal.jsx', import.meta.url), 'utf8');
  const submitHandler = source.slice(source.indexOf('const handleSubmit'), source.indexOf('return createPortal'));
  assert.match(submitHandler, /await onSave\(/);
  assert.match(submitHandler, /catch \(error\)[\s\S]*setErrorMessage\(error\.message/);
  assert.doesNotMatch(submitHandler, /onClose\(/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const modalSource = fs.readFileSync(new URL('../src/components/EditPostModal.jsx', import.meta.url), 'utf8');

test('edit modal preselects the current privacy', () => {
  assert.match(modalSource, /setPrivacy\(post\.privacy === 'private' \? 'only_me' : \(post\.privacy \|\| 'public'\)\)/);
  assert.match(modalSource, /<select value=\{privacy === 'private' \? 'only_me' : privacy\}/);
});

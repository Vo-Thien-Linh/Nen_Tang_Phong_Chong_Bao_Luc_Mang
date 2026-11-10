import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getPostPrivacyLabel, normalizePostPrivacy } from '../src/utils/postPrivacy.js';

const modalSource = fs.readFileSync(new URL('../src/components/EditPostModal.jsx', import.meta.url), 'utf8');

test('edit modal preselects the current privacy', () => {
  assert.match(modalSource, /setPrivacy\(post\.privacy === 'private' \? 'only_me' : \(post\.privacy \|\| 'public'\)\)/);
  assert.match(modalSource, /<select value=\{privacy === 'private' \? 'only_me' : privacy\}/);
});

test('privacy label for each value', () => {
  assert.equal(getPostPrivacyLabel('public'), 'Công khai');
  assert.equal(getPostPrivacyLabel('friends'), 'Bạn bè');
  assert.equal(getPostPrivacyLabel('only_me'), 'Chỉ mình tôi');
  assert.equal(normalizePostPrivacy('private'), 'only_me');
});

test('other viewers see the privacy badge only for visible posts', () => {
  const postCardSource = fs.readFileSync(new URL('../src/components/PostCard.jsx', import.meta.url), 'utf8');
  assert.match(postCardSource, /getPostPrivacyLabel\(post\.privacy\)/);
  assert.match(postCardSource, /normalizePostPrivacy\(post\.privacy\) === 'only_me'/);
});

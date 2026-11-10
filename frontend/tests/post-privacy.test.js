import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getPostPrivacyLabel, normalizePostPrivacy, POST_PRIVACY_OPTIONS } from '../src/utils/postPrivacy.js';

const modalSource = fs.readFileSync(new URL('../src/components/EditPostModal.jsx', import.meta.url), 'utf8');

test('privacy options contain each choice once', () => {
  assert.deepEqual(POST_PRIVACY_OPTIONS.map((option) => option.value), ['public', 'friends', 'only_me']);
  assert.equal(new Set(POST_PRIVACY_OPTIONS.map((option) => option.label)).size, 3);
  const composerSource = fs.readFileSync(new URL('../src/components/CreatePostCard.jsx', import.meta.url), 'utf8');
  assert.match(composerSource, /POST_PRIVACY_OPTIONS\.map/);
  assert.match(modalSource, /POST_PRIVACY_OPTIONS\.map/);
});

test('legacy private value selects only me', () => {
  assert.equal(normalizePostPrivacy('private'), 'only_me');
  assert.match(modalSource, /value=\{privacy === 'private' \? 'only_me' : privacy\}/);
  assert.match(modalSource, /privacy: normalizePostPrivacy\(privacy\)/);
});

test('only me and private map to the same label', () => {
  assert.equal(normalizePostPrivacy('private'), normalizePostPrivacy('only_me'));
  assert.equal(getPostPrivacyLabel('private'), getPostPrivacyLabel('only_me'));
});

test('edit modal preselects the current privacy', () => {
  assert.match(modalSource, /useState\(post\?\.privacy \|\| 'public'\)/);
  assert.match(modalSource, /<select value=\{privacy === 'private' \? 'only_me' : privacy\}/);
  const postCardSource = fs.readFileSync(new URL('../src/components/PostCard.jsx', import.meta.url), 'utf8');
  assert.match(postCardSource, /key=\{`\$\{post\.id\}-\$\{post\.privacy \|\| 'public'\}`\}/);
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

test('composer normalizes the legacy private default', () => {
  const composerSource = fs.readFileSync(new URL('../src/components/CreatePostCard.jsx', import.meta.url), 'utf8');
  assert.match(composerSource, /normalizePostPrivacy\(currentUser\?\.settings\?\.post_default_privacy/);
});

test('only me privacy renders its own label', () => {
  const postCardSource = fs.readFileSync(new URL('../src/components/PostCard.jsx', import.meta.url), 'utf8');
  assert.match(postCardSource, /normalizePostPrivacy\(post\.privacy\) === 'only_me' \? 'Chỉ mình tôi'/);
});

test('shared post shows a placeholder when its original is unavailable', () => {
  const postCardSource = fs.readFileSync(new URL('../src/components/PostCard.jsx', import.meta.url), 'utf8');
  assert.match(postCardSource, /post\.originalPostId && !post\.originalPost/);
  assert.match(postCardSource, /N\\u1ed9i dung g\\u1ed1c kh\\u00f4ng kh\\u1ea3 d\\u1ee5ng/);
});

test('hashtag view has no subtitle about public posts', () => {
  const hashtagSource = fs.readFileSync(new URL('../src/components/HashtagView.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(hashtagSource, /Bài viết công khai có hashtag này/);
});

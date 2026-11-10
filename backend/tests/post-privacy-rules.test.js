import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewerSeePost } from '../src/repositories/postVisibility.js';

test('public post is visible to everyone', () => {
  assert.equal(canViewerSeePost({
    viewerId: 'viewer', authorId: 'author', privacy: 'public', friendshipStatus: null,
  }), true);
});

test('single post returns not found for unauthorized viewer', () => {
  assert.equal(canViewerSeePost({
    viewerId: 'stranger', authorId: 'author', privacy: 'only_me', friendshipStatus: 'accepted',
  }), false);
});

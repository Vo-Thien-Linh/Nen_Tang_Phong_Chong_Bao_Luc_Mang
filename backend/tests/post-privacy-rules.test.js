import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewerSeePost } from '../src/repositories/postVisibility.js';

test('public post is visible to everyone', () => {
  assert.equal(canViewerSeePost({
    viewerId: 'viewer', authorId: 'author', privacy: 'public', friendshipStatus: null,
  }), true);
});

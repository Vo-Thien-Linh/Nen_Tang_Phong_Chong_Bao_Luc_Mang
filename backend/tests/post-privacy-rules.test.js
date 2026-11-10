import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewerSeePost } from '../src/repositories/postVisibility.js';
import { createHashtagRepository } from '../src/repositories/hashtagRepository.js';

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

test('hashtag list hides friends and only me posts from strangers', async () => {
  const queries = [];
  const pool = { query: async (text) => {
    queries.push(text);
    if (text.includes('COUNT(*) OVER')) return { rows: [] };
    return { rows: [] };
  } };
  await createHashtagRepository({ pool, postRepository: { findById: async () => null } })
    .findPosts({ tag: 'tag', viewerId: 'viewer' });
  assert.match(queries[0], /f\.status = 'accepted'/);
  assert.match(queries[0], /COALESCE\(p\.privacy, 'public'\)/);
});

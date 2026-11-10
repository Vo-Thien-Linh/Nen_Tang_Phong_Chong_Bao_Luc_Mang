import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewerSeePost } from '../src/repositories/postVisibility.js';
import { createHashtagRepository } from '../src/repositories/hashtagRepository.js';
import { realtimeService } from '../src/services/realtimeService.js';
import { createPostService } from '../src/services/postService.js';

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

test('only me post is never broadcast to another viewer', () => {
  const author = { writes: [], write(chunk) { this.writes.push(chunk); } };
  const stranger = { writes: [], write(chunk) { this.writes.push(chunk); } };
  realtimeService.addClient(author, 'author');
  realtimeService.addClient(stranger, 'stranger');
  try {
    realtimeService.broadcast({ type: 'POST_CREATED', audienceUserIds: ['author'], post: { id: '1' } });
    assert.equal(author.writes.length, 1);
    assert.equal(stranger.writes.length, 0);
  } finally {
    realtimeService.removeClient(author);
    realtimeService.removeClient(stranger);
  }
});

test('sharing a non public post is rejected', async () => {
  const service = createPostService({
    postRepository: {
      findById: async () => ({ id: 1, author_id: 'author', privacy: 'friends', ai_status: 'approved' }),
      sharePost: async () => { throw new Error('should not share'); },
    },
  });
  await assert.rejects(
    service.sharePost({ user: { id: 'viewer' }, originalPostId: 1, content: '' }),
    (error) => error.statusCode === 403 && error.message === 'BÃ i viáº¿t nÃ y khÃ´ng thá»ƒ chia sáº»'
  );
});

test('create post stores the chosen privacy', async () => {
  let created;
  const service = createPostService({
    postRepository: {
      createPost: async (input) => { created = input; return { id: 1, ...input }; },
      findVisiblePosts: async () => [],
    },
    moderationHook: { afterPostCreated: async () => {} },
  });
  await service.createPost({ user: { id: 'author' }, content: 'hello', privacy: 'friends' });
  assert.equal(created.privacy, 'friends');
});

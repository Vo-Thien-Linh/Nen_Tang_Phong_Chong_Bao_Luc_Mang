import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewerSeePost } from '../src/repositories/postVisibility.js';
import { createHashtagRepository } from '../src/repositories/hashtagRepository.js';
import { realtimeService } from '../src/services/realtimeService.js';
import { createPostService } from '../src/services/postService.js';
import fs from 'node:fs';
import { createReportsController } from '../src/controllers/reportsController.js';

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

test('create post rejects an invalid privacy', async () => {
  const service = createPostService({
    postRepository: { createPost: async () => { throw new Error('should not create'); } },
  });
  await assert.rejects(
    service.createPost({ user: { id: 'author' }, content: 'hello', privacy: 'followers' }),
    (error) => error.statusCode === 400 && error.message === 'Quyá»n riÃªng tÆ° khÃ´ng há»£p lá»‡'
  );
});

test('create post uses the default privacy when missing', async () => {
  let created;
  const service = createPostService({
    postRepository: {
      pool: { query: async () => ({ rows: [{ post_default_privacy: 'only_me' }] }) },
      createPost: async (input) => { created = input; return { id: 1, ...input }; },
    },
    moderationHook: { afterPostCreated: async () => {} },
  });
  await service.createPost({ user: { id: 'author' }, content: 'hello' });
  assert.equal(created.privacy, 'only_me');
});

test('author can change privacy without marking the post edited', async () => {
  let privacyUpdate;
  const service = createPostService({
    postRepository: {
      findByIdForOwnerAction: async () => ({ id: 1, author_id: 'author', content: 'hello', image_url: null, privacy: 'public', image_moderation_status: null, ai_status: 'approved' }),
      updatePostPrivacy: async (input) => { privacyUpdate = input; return { id: 1, privacy: input.privacy, edited_at: null }; },
    },
  });
  const result = await service.editPost({ user: { id: 'author' }, postId: 1, content: 'hello', imageUrl: null, privacy: 'friends' });
  assert.equal(privacyUpdate.privacy, 'friends');
  assert.equal(result.edited_at, null);
});

test('search uses accepted friendship privacy rules', () => {
  const source = fs.readFileSync(new URL('../app/routes/search.py', import.meta.url), 'utf8');
  assert.match(source, /Friendship\.status == "accepted"/);
  assert.match(source, /func\.coalesce\(Post\.privacy, "public"\)/);
});

test('cannot report an invisible post', async () => {
  let reported = false;
  const controller = createReportsController({
    postRepository: { findById: async () => null },
    reportRepository: { createReport: async () => { reported = true; return { data: {} }; } },
  });
  const next = (error) => { throw error; };
  await assert.rejects(
    controller.createReport({
      user: { id: 'viewer' },
      body: { targetType: 'post', targetId: 12 },
    }, {}, next),
    (error) => error.statusCode === 404
  );
  assert.equal(reported, false);
});

test('privacy sql uses valid columns', () => {
  const schema = fs.readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8');
  assert.match(schema, /privacy\s+VARCHAR\(20\)/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS friendships/i);
  assert.match(schema, /status IN \('pending', 'accepted', 'declined', 'blocked'\)/i);
});

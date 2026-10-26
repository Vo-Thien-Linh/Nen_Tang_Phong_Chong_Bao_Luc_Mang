import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('violent post is created as a permanent rejected hold', async () => {
  const now = new Date('2026-01-01T00:00:00Z');
  let args;
  const service = createPostService({
    clock: () => now,
    moderationHook: { afterPostCreated: async () => {} },
    imageModerationClient: async () => ({ decision: 'rejected', thresholds: {}, images: [] }),
    postRepository: { async createPost(value) { args = value; return value; } },
  });
  await service.createPost({ user: { id: 'u1' }, content: 'x', imageUrl: 'https://res.cloudinary.com/x.jpg' });
  assert.equal(args.imageModeration.decision, 'rejected_hold');
  assert.equal('moderationExpiresAt' in args.imageModeration, false);
});


import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';
import { sweepExpiredModeration } from '../src/services/moderationExpirySweeper.js';

test('violent post is created with rejected_hold and expiry', async () => {
  const now = new Date('2026-01-01T00:00:00Z');
  let args;
  const service = createPostService({
    clock: () => now,
    moderationHook: { afterPostCreated: async () => {} },
    imageModerationClient: async () => ({ decision: 'rejected', thresholds: { appeal_window_minutes: 10 }, images: [] }),
    postRepository: { async createPost(value) { args = value; return value; } },
  });
  await service.createPost({ user: { id: 'u1' }, content: 'x', imageUrl: 'https://res.cloudinary.com/x.jpg' });
  assert.equal(args.imageModeration.decision, 'rejected_hold');
  assert.equal(args.imageModeration.moderationExpiresAt, '2026-01-01T00:10:00.000Z');
});

test('sweeper deletes only expired held content', async () => {
  const queries = [];
  const client = { query: async (sql) => { queries.push(sql); return { rowCount: 1 }; }, release() {} };
  await sweepExpiredModeration({ connect: async () => client }, () => new Date('2026-01-01T00:10:00Z'));
  assert.match(queries[1], /comments/);
  assert.match(queries[2], /posts/);
  assert.equal(queries.at(-1), 'COMMIT');
});

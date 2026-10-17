import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';

test('returns the inserted post when the author re-read is hidden', async () => {
  const queries = [];
  const repository = createPostRepository({
    pool: {
      async query(sql, params) {
        queries.push({ sql, params });
        if (queries.length === 1) return { rows: [{ id: 42 }] };
        return { rows: [] };
      },
    },
  });

  const post = await repository.createPost({
    authorId: 'author-1',
    content: 'Violent image post',
    imageUrl: 'https://res.cloudinary.com/demo/image.jpg',
    imageModeration: {
      decision: 'rejected_hold',
      images: [{ scores: { safe: 0.01, nsfw: 0.04, violence: 0.95 } }],
      thresholds: { violence_reject: 0.8, appeal_window_minutes: 10 },
      moderationExpiresAt: '2030-01-01T00:10:00.000Z',
    },
  });

  assert.equal(queries[1].params[0], 42);
  assert.equal(queries[1].params[1], 'author-1');
  assert.equal(post.id, '42');
  assert.equal(post.author_id, 'author-1');
  assert.equal(post.image_moderation_status, 'rejected_hold');
  assert.equal(post.image_moderation_violence, 0.95);
});

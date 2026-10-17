import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';
import { mapPostToResponse } from '../src/controllers/postsController.js';

test('every moderation outcome returns the same success shape', async () => {
  const outcomes = [null, 'safe', 'sensitive', 'pending_review', 'rejected_hold'];
  const expectedKeys = [
    'id', 'content', 'image', 'imageModeration', 'createdAt', 'createdAtIso',
    'editedAt', 'isEdited', 'author', 'tags', 'likesCount', 'reactionCounts',
    'totalReactions', 'myReaction', 'sharesCount', 'comments', 'aiStatus',
    'moderationStatus', 'originalPost',
  ].sort();

  for (const decision of outcomes) {
    const repository = createPostRepository({
      pool: {
        async query(sql) {
          if (sql.includes('INSERT INTO posts')) return { rows: [{ id: 100 }] };
          return { rows: [] };
        },
      },
    });
    const post = await repository.createPost({
      authorId: 'author-1',
      content: 'post',
      imageUrl: decision ? 'https://res.cloudinary.com/demo/image.jpg' : null,
      imageModeration: decision ? {
        decision,
        images: [{ scores: { safe: 0.8, nsfw: 0.1, violence: 0.1 } }],
        thresholds: { appeal_window_minutes: 10 },
        moderationExpiresAt: decision === 'rejected_hold' ? '2030-01-01T00:10:00.000Z' : null,
      } : null,
    });

    assert.deepEqual(Object.keys(mapPostToResponse(post)).sort(), expectedKeys, decision || 'no image');
    assert.equal(mapPostToResponse(post).id, '100');
  }
});

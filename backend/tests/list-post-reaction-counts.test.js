import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPostToResponse } from '../src/controllers/postsController.js';
import { createPostRepository } from '../src/repositories/postRepository.js';

test('backend returns reaction counts and my reaction for each post', async () => {
  const calls = [];
  const repository = createPostRepository({
    pool: {
      async query(sql, params) {
        calls.push({ sql, params });

        if (calls.length === 1) {
          return {
            rows: [{
              id: 12,
              author_id: 'author-1',
              title: 'Hello',
              content: 'Post content',
              image_url: null,
              ai_label: 'Normal',
              ai_confidence: 0.99,
              ai_status: 'approved',
              likes_count: 3,
              shares_count: 0,
              created_at: new Date('2026-10-11T00:00:00.000Z'),
              username: 'author',
              full_name: 'Author',
              avatar_url: '/avatar.png',
              is_verified: true,
            }],
          };
        }

        if (calls.length === 2) {
          return {
            rows: [
              { post_id: 12, reaction_type: 'like', count: 2 },
              { post_id: 12, reaction_type: 'haha', count: 1 },
            ],
          };
        }

        return {
          rows: [{ post_id: 12, reaction_type: 'haha' }],
        };
      },
    },
  });

  const posts = await repository.findVisiblePosts({ viewerId: 'viewer-1' });
  const response = mapPostToResponse(posts[0]);

  assert.deepEqual(calls[1].params, [[12]]);
  assert.deepEqual(calls[2].params, ['viewer-1', [12]]);
  assert.deepEqual(response.reactionCounts, {
    like: 2,
    love: 0,
    haha: 1,
    wow: 0,
    sad: 0,
    angry: 0,
  });
  assert.equal(response.totalReactions, 3);
  assert.equal(response.myReaction, 'haha');
});

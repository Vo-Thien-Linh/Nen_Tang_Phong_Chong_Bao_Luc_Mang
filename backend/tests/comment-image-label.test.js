import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostsController } from '../src/controllers/postsController.js';

test('ignore client supplied moderation label', async () => {
  let received;
  const controller = createPostsController({
    postService: {},
    imageModerationClient: async () => ({ decision: 'safe', images: [{ scores: { safe: .9, nsfw: .05, violence: .05 } }] }),
    postRepository: {
      async createComment(args) {
        received = args;
        return { id: 1, author_id: 'u1', full_name: 'User', avatar_url: null, content: 'x', image_url: 'https://res.cloudinary.com/a.jpg', image_moderation_status: 'safe' };
      },
    },
  });
  const response = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
  await controller.createComment({ params: { postId: '1' }, user: { id: 'u1' }, body: { content: 'x', imageUrl: 'https://res.cloudinary.com/a.jpg', imageLabel: 'violence' } }, response, (error) => { throw error; });
  assert.equal(received.imageLabel, undefined);
  assert.equal(received.imageModeration.images[0].scores.safe, .9);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostsController } from '../src/controllers/postsController.js';

test('comment creation returns all image moderation outcomes without a re-read', async () => {
  for (const decision of ['sensitive', 'pending_review', 'rejected']) {
    let createCalls = 0;
    let moderationInput;
    const controller = createPostsController({
      postService: {},
      imageModerationClient: async () => ({
        decision,
        images: [{ scores: { safe: 0.05, nsfw: 0.1, violence: 0.85 } }],
        thresholds: { appeal_window_minutes: 10 },
      }),
      postRepository: {
        async createComment(input) {
          createCalls += 1;
          moderationInput = input.imageModeration;
          return {
            id: 7,
            author_id: 'u1',
            full_name: 'User',
            avatar_url: null,
            content: 'comment',
            image_url: 'https://res.cloudinary.com/demo/image.jpg',
            image_moderation_status: decision === 'rejected' ? 'rejected_hold' : decision,
            image_moderation_safe: 0.05,
            image_moderation_nsfw: 0.1,
            image_moderation_violence: 0.85,
            moderation_expires_at: decision === 'rejected' ? '2030-01-01T00:10:00.000Z' : null,
          };
        },
      },
    });
    const response = {
      statusCode: 0,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; },
    };

    await controller.createComment({
      params: { postId: '1' },
      user: { id: 'u1' },
      body: { content: 'comment', imageUrl: 'https://res.cloudinary.com/demo/image.jpg' },
    }, response, (error) => { throw error; });

    assert.equal(createCalls, 1, decision);
    assert.equal(response.statusCode, 201, decision);
    assert.equal(response.body.success, true, decision);
    assert.equal(response.body.data.imageModeration.status, decision === 'rejected' ? 'rejected_hold' : decision, decision);
    assert.equal(moderationInput.decision, decision === 'rejected' ? 'rejected_hold' : decision, decision);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('author can replace the image of a post', async () => {
  let saved;
  const service = createPostService({
    postRepository: {
      async findByIdForOwnerAction() { return { id: '1', author_id: 'u1', image_moderation_status: 'safe', ai_status: 'approved' }; },
      async updatePost(value) { saved = value; return { id: '1', author_id: 'u1', image_url: value.imageUrl }; },
    },
    moderationHook: { async afterPostEdited() {} },
    async imageModerationClient(url) { return { decision: 'safe', label: 'Safe', images: [{ scores: { safe: 0.99, nsfw: 0, violence: 0 } }] }; },
  });

  const post = await service.editPost({ user: { id: 'u1' }, postId: '1', content: 'updated', imageUrl: 'https://res.cloudinary.com/test/new.png' });
  assert.equal(saved.imageUrl, post.image_url);
  assert.equal(saved.imageModeration.decision, 'safe');
});

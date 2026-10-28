import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('edited image goes through image moderation', async () => {
  let moderatedUrl;
  let savedModeration;
  const service = createPostService({
    postRepository: {
      async findByIdForOwnerAction() { return { id: '1', author_id: 'u1', image_moderation_status: 'safe', ai_status: 'approved' }; },
      async updatePost(value) { savedModeration = value.imageModeration; return { id: '1', author_id: 'u1', image_url: value.imageUrl }; },
    },
    moderationHook: { async afterPostEdited() {} },
    async imageModerationClient(url) {
      moderatedUrl = url;
      return { decision: 'rejected', label: 'Violence', thresholds: {}, images: [{ scores: { safe: 0.1, nsfw: 0, violence: 0.95 } }] };
    },
  });

  await service.editPost({ user: { id: 'u1' }, postId: '1', content: 'updated', imageUrl: 'https://res.cloudinary.com/test/new.png' });
  assert.equal(moderatedUrl, 'https://res.cloudinary.com/test/new.png');
  assert.equal(savedModeration.decision, 'rejected_hold');
});

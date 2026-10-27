import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('editing with a new image still runs image moderation', async () => {
  let moderatedUrl = null;
  let savedModeration = null;
  const service = createPostService({
    postRepository: {
      async findByIdForOwnerAction() {
        return { id: '1', author_id: 'u1', image_moderation_status: 'safe', ai_status: 'approved' };
      },
      async updatePost({ imageModeration }) {
        savedModeration = imageModeration;
        return { id: '1', author_id: 'u1', image_url: 'new-image.jpg' };
      },
    },
    moderationHook: { async afterPostEdited() {} },
    async imageModerationClient(imageUrl) {
      moderatedUrl = imageUrl;
      return { decision: 'sensitive', thresholds: {}, images: [{ scores: { safe: 0.1, nsfw: 0.9, violence: 0 } }] };
    },
  });

  await service.editPost({ user: { id: 'u1' }, postId: '1', content: 'updated', imageUrl: 'new-image.jpg' });

  assert.equal(moderatedUrl, 'new-image.jpg');
  assert.equal(savedModeration.decision, 'sensitive');
});

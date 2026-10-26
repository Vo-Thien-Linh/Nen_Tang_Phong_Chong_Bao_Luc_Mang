import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('author can remove the image of a post', async () => {
  let saved;
  const service = createPostService({
    postRepository: {
      async findByIdForOwnerAction() { return { id: '1', author_id: 'u1', image_moderation_status: 'sensitive', ai_status: 'approved' }; },
      async updatePost(value) { saved = value; return { id: '1', author_id: 'u1', image_url: value.imageUrl }; },
    },
    moderationHook: { async afterPostEdited() {} },
  });

  const post = await service.editPost({ user: { id: 'u1' }, postId: '1', content: 'updated', imageUrl: null });
  assert.equal(saved.imageUrl, null);
  assert.deepEqual(saved.imageModeration, { decision: null, label: null, images: [], thresholds: null });
  assert.equal(post.image_url, null);
});

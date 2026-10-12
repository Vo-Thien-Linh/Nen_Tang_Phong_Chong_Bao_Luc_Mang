import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('remove image when image url is cleared', async () => {
  let savedImageUrl = 'old.jpg';
  const service = createPostService({
    postRepository: {
      async findById() {
        return { id: '1', author_id: 'u1', ai_status: 'approved' };
      },
      async updatePost({ imageUrl }) {
        savedImageUrl = imageUrl;
        return { id: '1', author_id: 'u1', image_url: imageUrl };
      },
    },
    moderationHook: { async afterPostEdited() {} },
  });

  await service.editPost({ user: { id: 'u1' }, postId: '1', content: 'new', imageUrl: '' });

  assert.equal(savedImageUrl, null);
});

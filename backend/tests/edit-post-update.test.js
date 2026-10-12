import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('update content and image while keeping original created time', async () => {
  const createdAt = new Date('2026-01-01T00:00:00Z');
  const service = createPostService({
    postRepository: {
      async findById() {
        return { id: '1', author_id: 'u1', ai_status: 'approved', created_at: createdAt };
      },
      async updatePost({ content, imageUrl }) {
        return { id: '1', author_id: 'u1', content, image_url: imageUrl, created_at: createdAt, edited_at: new Date() };
      },
    },
    moderationHook: { async afterPostEdited() {} },
  });

  const post = await service.editPost({ user: { id: 'u1' }, postId: '1', content: ' new ', imageUrl: 'image.jpg' });

  assert.equal(post.content, 'new');
  assert.equal(post.image_url, 'image.jpg');
  assert.equal(post.created_at, createdAt);
});

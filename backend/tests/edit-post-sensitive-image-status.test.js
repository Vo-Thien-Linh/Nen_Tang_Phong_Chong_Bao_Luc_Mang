import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('author can edit own sensitive post', async () => {
  let updated = false;
  const service = createPostService({
    postRepository: {
      async findByIdForOwnerAction() {
        return { id: '1', author_id: 'u1', image_moderation_status: 'sensitive', ai_status: 'approved' };
      },
      async updatePost() {
        updated = true;
        return { id: '1', author_id: 'u1', content: 'updated' };
      },
    },
    moderationHook: { async afterPostEdited() {} },
  });

  const result = await service.editPost({ user: { id: 'u1' }, postId: '1', content: 'updated', imageUrl: null });

  assert.equal(result.content, 'updated');
  assert.equal(updated, true);
});

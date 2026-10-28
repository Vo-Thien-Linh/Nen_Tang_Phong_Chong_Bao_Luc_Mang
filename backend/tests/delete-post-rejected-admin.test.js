import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('author can delete a rejected admin post', async () => {
  let deleted = false;
  const service = createPostService({
    postRepository: {
      async findByIdForOwnerAction() {
        return { id: '1', author_id: 'u1', image_moderation_status: 'rejected_admin' };
      },
      async deletePost() {
        deleted = true;
        return { id: '1' };
      },
    },
    moderationHook: {},
  });

  const result = await service.deletePost({ user: { id: 'u1' }, postId: '1' });

  assert.equal(result.id, '1');
  assert.equal(deleted, true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('other user cannot edit the post', async () => {
  let updated = false;
  const service = createPostService({
    postRepository: {
      async findByIdForOwnerAction() {
        return { id: '1', author_id: 'owner', image_moderation_status: 'safe', ai_status: 'approved' };
      },
      async updatePost() {
        updated = true;
      },
    },
    moderationHook: {},
  });

  await assert.rejects(
    () => service.editPost({ user: { id: 'other' }, postId: '1', content: 'changed', imageUrl: null }),
    (error) => error.statusCode === 403
  );
  assert.equal(updated, false);
});

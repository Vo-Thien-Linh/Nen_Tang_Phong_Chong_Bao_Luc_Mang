import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('other user cannot delete the post', async () => {
  let deleted = false;
  const service = createPostService({
    postRepository: {
      async findByIdForOwnerAction() {
        return { id: '1', author_id: 'owner', image_moderation_status: null };
      },
      async deletePost() {
        deleted = true;
        return { id: '1' };
      },
    },
    moderationHook: {},
  });

  await assert.rejects(
    () => service.deletePost({ user: { id: 'other' }, postId: '1' }),
    (error) => error.statusCode === 403
  );
  assert.equal(deleted, false);
});

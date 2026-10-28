import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('delete of a rejected final post returns not found', async () => {
  let deleted = false;
  const service = createPostService({
    postRepository: {
      async findByIdForOwnerAction() {
        return { id: '1', author_id: 'u1', image_moderation_status: 'rejected_final' };
      },
      async deletePost() {
        deleted = true;
        return { id: '1' };
      },
    },
    moderationHook: {},
  });

  await assert.rejects(
    () => service.deletePost({ user: { id: 'u1' }, postId: '1' }),
    (error) => error.statusCode === 404
  );
  assert.equal(deleted, false);
});

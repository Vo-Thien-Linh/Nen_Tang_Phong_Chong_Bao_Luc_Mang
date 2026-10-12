import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('delete own post together with its dependent data', async () => {
  let deleted = false;
  const service = createPostService({
    postRepository: {
      async findById() {
        return { id: '1', author_id: 'u1' };
      },
      async deletePost() {
        deleted = true;
      },
    },
    moderationHook: {},
  });

  await service.deletePost({ user: { id: 'u1' }, postId: '1' });

  assert.equal(deleted, true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('keep post and return failure message on system error', async () => {
  const service = createPostService({
    postRepository: {
      async findById() {
        return { id: '1', author_id: 'u1' };
      },
      async deletePost() {
        throw new Error('db down');
      },
    },
    moderationHook: {},
  });

  await assert.rejects(
    () => service.deletePost({ user: { id: 'u1' }, postId: '1' }),
    /db down/
  );
});

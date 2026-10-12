import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('reject edit when post is hidden', async () => {
  const service = createPostService({
    postRepository: {
      async findById() {
        return { id: '1', author_id: 'u1', ai_status: 'hidden' };
      },
    },
    moderationHook: {},
  });

  await assert.rejects(
    () => service.editPost({ user: { id: 'u1' }, postId: '1', content: 'new' }),
    (error) => {
      assert.equal(error.statusCode, 403);
      return true;
    }
  );
});

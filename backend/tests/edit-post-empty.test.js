import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('reject edit post when content is empty', async () => {
  const service = createPostService({
    postRepository: {
      async findById() {
        return { id: '1', author_id: 'u1', ai_status: 'approved' };
      },
    },
    moderationHook: {},
  });

  await assert.rejects(
    () => service.editPost({ user: { id: 'u1' }, postId: '1', content: '   ' }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, 'Nội dung không được để trống');
      return true;
    }
  );
});

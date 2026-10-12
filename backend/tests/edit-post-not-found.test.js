import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('reject edit with not found message when post does not exist', async () => {
  const service = createPostService({
    postRepository: { async findById() { return null; } },
    moderationHook: {},
  });

  await assert.rejects(
    () => service.editPost({ user: { id: 'u1' }, postId: '404', content: 'new' }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, 'Bài viết không tồn tại');
      return true;
    }
  );
});

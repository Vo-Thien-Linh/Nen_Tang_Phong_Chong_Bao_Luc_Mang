import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('return not found message when deleting or viewing a deleted post', async () => {
  const service = createPostService({
    postRepository: { async findById() { return null; } },
    moderationHook: {},
  });

  await assert.rejects(
    () => service.deletePost({ user: { id: 'u1' }, postId: '404' }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, 'Bài viết không tồn tại');
      return true;
    }
  );
  await assert.rejects(
    () => service.getVisiblePost({ user: { id: 'u1' }, postId: '404' }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, 'Bài viết không tồn tại');
      return true;
    }
  );
});

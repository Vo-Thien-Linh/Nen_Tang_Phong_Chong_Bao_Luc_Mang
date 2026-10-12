import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('reject delete post when user is not the post owner and keep post', async () => {
  let deleteCalled = false;
  const service = createPostService({
    postRepository: {
      async findById() {
        return { id: '1', author_id: 'owner' };
      },
      async deletePost() {
        deleteCalled = true;
      },
    },
    moderationHook: {},
  });

  await assert.rejects(
    () => service.deletePost({ user: { id: 'other' }, postId: '1' }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.message, 'Bạn không có quyền xóa bài viết này');
      return true;
    }
  );
  assert.equal(deleteCalled, false);
});

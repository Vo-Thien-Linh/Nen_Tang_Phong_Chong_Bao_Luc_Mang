import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('reject edit post when user is not the post owner and keep content unchanged', async () => {
  let updateCalled = false;
  const service = createPostService({
    postRepository: {
      async findById() {
        return { id: '1', author_id: 'owner', ai_status: 'approved', content: 'old' };
      },
      async updatePost() {
        updateCalled = true;
      },
    },
    moderationHook: {},
  });

  await assert.rejects(
    () => service.editPost({ user: { id: 'other' }, postId: '1', content: 'new' }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.message, 'Bạn không có quyền chỉnh sửa bài viết này');
      return true;
    }
  );
  assert.equal(updateCalled, false);
});

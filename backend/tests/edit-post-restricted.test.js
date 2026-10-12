import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('reject edit when user is restricted', async () => {
  const service = createPostService({
    postRepository: {
      async findById() {
        return { id: '1', author_id: 'u1', ai_status: 'approved' };
      },
    },
    moderationHook: {},
  });

  await assert.rejects(
    () => service.editPost({ user: { id: 'u1', status: 'cooldown' }, postId: '1', content: 'new' }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.message, 'Tài khoản của bạn đang bị hạn chế');
      return true;
    }
  );
});

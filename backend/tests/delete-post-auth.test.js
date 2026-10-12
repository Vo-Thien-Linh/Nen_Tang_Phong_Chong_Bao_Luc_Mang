import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('reject delete post when user is not authenticated', async () => {
  const service = createPostService({ postRepository: {}, moderationHook: {} });

  await assert.rejects(
    () => service.deletePost({ user: null, postId: '1' }),
    (error) => {
      assert.equal(error.statusCode, 401);
      return true;
    }
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('reject edit post when user is not authenticated', async () => {
  const service = createPostService({ postRepository: {}, moderationHook: {} });

  await assert.rejects(
    () => service.editPost({ user: null, postId: '1', content: 'new' }),
    (error) => {
      assert.equal(error.statusCode, 401);
      return true;
    }
  );
});

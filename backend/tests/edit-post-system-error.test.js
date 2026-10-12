import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('keep old content and return failure message on system error', async () => {
  const service = createPostService({
    postRepository: {
      async findById() {
        return { id: '1', author_id: 'u1', ai_status: 'approved', content: 'old' };
      },
      async updatePost() {
        throw new Error('db down');
      },
    },
    moderationHook: { async afterPostEdited() {} },
  });

  await assert.rejects(
    () => service.editPost({ user: { id: 'u1' }, postId: '1', content: 'new' }),
    /db down/
  );
});

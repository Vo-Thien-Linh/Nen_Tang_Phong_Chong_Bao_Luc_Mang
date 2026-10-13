import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('call moderation hook after post edit', async () => {
  let hookCalled = false;
  const service = createPostService({
    postRepository: {
      async findById() {
        return { id: '1', author_id: 'u1', ai_status: 'approved' };
      },
      async updatePost() {
        return { id: '1', author_id: 'u1' };
      },
    },
    moderationHook: { async afterPostEdited() { hookCalled = true; } },
  });

  await service.editPost({ user: { id: 'u1' }, postId: '1', content: 'new' });

  assert.equal(hookCalled, true);
});

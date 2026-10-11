import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('reject create post when user is not authenticated', async () => {
  const service = createPostService({
    postRepository: {
      async createPost() {
        throw new Error('should not save');
      },
    },
    moderationHook: {
      async afterPostCreated() {
        throw new Error('should not moderate');
      },
    },
  });

  await assert.rejects(
    () => service.createPost({ user: null, title: 'Title', content: 'Content' }),
    (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, 'Bạn cần đăng nhập để đăng bài');
      return true;
    }
  );
});

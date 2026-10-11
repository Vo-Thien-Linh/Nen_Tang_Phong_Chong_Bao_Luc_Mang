import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('reject create post when content is empty', async () => {
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
    () => service.createPost({ user: { id: 'user-1' }, content: '' }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, 'Nội dung là bắt buộc');
      return true;
    }
  );

  await assert.rejects(
    () => service.createPost({ user: { id: 'user-1' }, content: '   ' }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, 'Nội dung là bắt buộc');
      return true;
    }
  );
});

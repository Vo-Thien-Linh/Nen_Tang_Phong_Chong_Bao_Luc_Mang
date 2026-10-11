import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('allow create post with and without image', async () => {
  const savedInputs = [];
  const service = createPostService({
    postRepository: {
      async createPost(input) {
        savedInputs.push(input);
        return { id: savedInputs.length, ...input };
      },
    },
    moderationHook: {
      async afterPostCreated() {},
    },
  });

  await service.createPost({
    user: { id: 'user-1' },
    title: 'Không ảnh',
    content: 'Nội dung',
  });
  await service.createPost({
    user: { id: 'user-1' },
    title: 'Có ảnh',
    content: 'Nội dung',
    imageUrl: 'https://cdn.example.com/post.png',
  });

  assert.equal(savedInputs[0].imageUrl, null);
  assert.equal(savedInputs[1].imageUrl, 'https://cdn.example.com/post.png');
});

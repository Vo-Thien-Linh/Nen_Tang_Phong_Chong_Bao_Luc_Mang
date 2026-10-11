import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('call moderation hook after post creation', async () => {
  const savedPost = {
    id: 10,
    author_id: 'user-1',
    title: 'Tiêu đề',
    content: 'Nội dung',
  };
  let hookPost;

  const service = createPostService({
    postRepository: {
      async createPost() {
        return savedPost;
      },
    },
    moderationHook: {
      async afterPostCreated(post) {
        hookPost = post;
      },
    },
  });

  const post = await service.createPost({
    user: { id: 'user-1' },
    title: 'Tiêu đề',
    content: 'Nội dung',
  });

  assert.equal(post, savedPost);
  assert.equal(hookPost, savedPost);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('create post saves title content author and time', async () => {
  const createdAt = new Date('2026-10-11T08:00:00.000Z');
  let savedInput;

  const service = createPostService({
    clock: () => createdAt,
    postRepository: {
      async createPost(input) {
        savedInput = input;
        return {
          id: 1,
          title: input.title,
          content: input.content,
          author_id: input.authorId,
          created_at: input.createdAt,
        };
      },
    },
    moderationHook: {
      async afterPostCreated() {},
    },
  });

  const post = await service.createPost({
    user: { id: 'user-1' },
    title: '  Tiêu đề mới  ',
    content: '  Nội dung mới  ',
  });

  assert.deepEqual(savedInput, {
    authorId: 'user-1',
    title: 'Tiêu đề mới',
    content: 'Nội dung mới',
    imageUrl: null,
    createdAt,
  });
  assert.equal(post.title, 'Tiêu đề mới');
  assert.equal(post.content, 'Nội dung mới');
  assert.equal(post.author_id, 'user-1');
  assert.equal(post.created_at, createdAt);
});

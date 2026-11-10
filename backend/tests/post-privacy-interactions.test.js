import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostsController } from '../src/controllers/postsController.js';
import { createReactionRepository } from '../src/repositories/reactionRepository.js';

test('cannot comment on an invisible post', async () => {
  let created = false;
  const controller = createPostsController({
    postService: {
      getVisiblePost: async () => {
        const error = new Error('Bài viết không tồn tại');
        error.statusCode = 404;
        throw error;
      },
    },
    postRepository: { createComment: async () => { created = true; } },
  });
  const response = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await controller.createComment({
    params: { postId: '12' }, user: { id: 'viewer' }, body: { content: 'hello' },
  }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 404);
  assert.equal(created, false);
});

test('cannot list reactions for an invisible post', async () => {
  const repository = createReactionRepository({
    pool: { query: async () => ({ rows: [] }) },
  });

  await assert.rejects(
    repository.getPostReactions({ postId: '12', viewerId: 'viewer' }),
    (error) => error.statusCode === 404 && error.message === 'Bài viết không tồn tại'
  );
});

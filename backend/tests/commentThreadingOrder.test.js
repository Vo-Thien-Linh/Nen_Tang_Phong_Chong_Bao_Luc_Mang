import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostsController, mapPostToResponse } from '../src/controllers/postsController.js';

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('mapPostToResponse preserves parentId on comments', () => {
  const mapped = mapPostToResponse({
    id: 10,
    author_id: 'u1',
    content: 'Post',
    comments: [
      { id: 2, post_id: 10, parent_id: 1, content: 'Reply', author: { id: 'u2', name: 'User 2' }, created_at: new Date().toISOString() },
      { id: 1, post_id: 10, parent_id: null, content: 'Root', author: { id: 'u1', name: 'User 1' }, created_at: new Date().toISOString() },
    ],
  });

  assert.equal(mapped.comments[0].parentId, '1');
  assert.equal(mapped.comments[0].parent_id, '1');
  assert.equal(mapped.comments[1].parentId, null);
});

test('postsController.createComment persists parentId and rejects cross-post parent comment', async () => {
  let receivedArgs = null;
  const controller = createPostsController({
    postService: {},
    postRepository: {
      async findById() {
        return { id: '10', author_id: 'owner-1', privacy: 'public' };
      },
      async findCommentById(cid) {
        if (String(cid) === '50') return { id: 50, post_id: 10, is_hidden: false, ai_status: 'approved' };
        if (String(cid) === '99') return { id: 99, post_id: 20, is_hidden: false, ai_status: 'approved' };
        return null;
      },
      async createComment(args) {
        receivedArgs = args;
        return {
          id: 51,
          post_id: 10,
          parent_id: Number(args.parentId),
          author_id: args.authorId,
          full_name: 'Tester',
          avatar_url: '',
          content: args.content,
          ai_label: 'Normal',
          ai_status: 'approved',
          created_at: new Date().toISOString(),
        };
      },
    },
  });

  const okRes = createMockRes();
  await controller.createComment(
    { params: { postId: '10' }, user: { id: 'u-1', status: 'active' }, body: { content: 'Trả lời hợp lệ', parentId: '50' } },
    okRes,
    (err) => { throw err; }
  );

  assert.equal(okRes.statusCode, 201);
  assert.equal(receivedArgs.parentId, '50');
  assert.equal(okRes.body.data.parentId, '50');

  const wrongPostRes = createMockRes();
  await controller.createComment(
    { params: { postId: '10' }, user: { id: 'u-1', status: 'active' }, body: { content: 'Sai bài', parentId: '99' } },
    wrongPostRes,
    (err) => { throw err; }
  );
  assert.equal(wrongPostRes.statusCode, 404);
});


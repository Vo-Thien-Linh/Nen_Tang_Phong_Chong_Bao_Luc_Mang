import test from 'node:test';
import assert from 'node:assert/strict';
import { moderateTextContent } from '../src/utils/textModerator.js';
import { createPostService } from '../src/services/postService.js';
import { createPostsController } from '../src/controllers/postsController.js';

test('moderateTextContent: correctly categorizes violence, hate speech, toxic, and normal text', async () => {
  const violence = await moderateTextContent('Hành vi đánh đập và chém chết');
  assert.equal(violence.label, 'Violence');
  assert.equal(violence.action, 'hide');

  const toxic = await moderateTextContent('Mày ngu như chó đồ rác rưởi');
  assert.ok(['Toxic', 'Violence', 'Hate Speech'].includes(toxic.label));
  assert.ok(['warn', 'hide'].includes(toxic.action));

  const normal = await moderateTextContent('Chào bạn, hôm nay thời tiết đẹp quá!');
  assert.equal(normal.label, 'Normal');
  assert.equal(normal.action, 'allow');
});

test('createComment: rejects commenting when user is banned', async () => {
  const controller = createPostsController({
    postService: {},
    postRepository: {},
  });

  let errorResponse = null;
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      errorResponse = { statusCode: this.statusCode, body };
      return this;
    },
  };

  await controller.createComment(
    {
      params: { postId: '1' },
      user: { id: 'banned-user', status: 'banned' },
      body: { content: 'Bình luận thử nghiệm' },
    },
    mockRes,
    () => {}
  );

  assert.equal(errorResponse.statusCode, 403);
  assert.match(errorResponse.body.message, /Tài khoản của bạn đã bị khóa/i);
});

test('createComment: rejects commenting when user is in cooldown', async () => {
  const controller = createPostsController({
    postService: {},
    postRepository: {},
  });

  let errorResponse = null;
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      errorResponse = { statusCode: this.statusCode, body };
      return this;
    },
  };

  const futureCooldown = new Date(Date.now() + 86400000).toISOString();
  await controller.createComment(
    {
      params: { postId: '1' },
      user: { id: 'cooldown-user', status: 'cooldown', cooldown_until: futureCooldown },
      body: { content: 'Bình luận thử nghiệm' },
    },
    mockRes,
    () => {}
  );

  assert.equal(errorResponse.statusCode, 403);
  assert.match(errorResponse.body.message, /bị hạn chế đăng bài và bình luận/i);
});

test('createPost: rejects creating post when user is in cooldown', async () => {
  const futureCooldown = new Date(Date.now() + 86400000).toISOString();
  const service = createPostService({
    postRepository: {},
    moderationHook: {},
  });

  await assert.rejects(
    async () => {
      await service.createPost({
        user: { id: 'u1', status: 'cooldown', cooldown_until: futureCooldown },
        content: 'Bài viết mới',
      });
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /bị hạn chế đăng bài và bình luận/i);
      return true;
    }
  );
});

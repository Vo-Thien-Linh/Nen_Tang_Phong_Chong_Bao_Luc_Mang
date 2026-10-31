import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostsController } from '../src/controllers/postsController.js';

test('createComment: returns friendly nudge when comment contains author blacklisted keyword', async () => {
  let createdComment = null;
  const mockPostRepository = {
    async findById() {
      return { id: 'post-123', author_id: 'author-1' };
    },
    async createComment(data) {
      createdComment = data;
      return { id: 'cmt-1', ...data };
    }
  };

  const controller = createPostsController({
    postService: {},
    postRepository: mockPostRepository,
  });

  let responseData = null;
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      responseData = { statusCode: this.statusCode, body };
      return this;
    }
  };

  await controller.createComment(
    {
      params: { postId: 'post-123' },
      user: { id: 'visitor-2', status: 'active' },
      body: {
        content: 'Bài viết này nhìn rất rác rưởi luôn',
        authorFilterKeywords: ['rác rưởi', 'đồ khốn', 'xúc phạm']
      }
    },
    mockRes,
    () => {}
  );

  assert.equal(responseData.statusCode, 200);
  assert.equal(responseData.body.nudge, true);
  assert.equal(responseData.body.warningType, 'keyword_blacklist');
  assert.equal(responseData.body.matchedKeyword, 'rác rưởi');
  assert.match(responseData.body.message, /danh sách cấm của chủ bài viết/);
  assert.equal(createdComment, null); // Chưa được lưu vào DB khi bị chặn/nudge
});

test('createComment: automatically hides comment when forced with blacklisted keyword', async () => {
  let createdComment = null;
  const mockPostRepository = {
    async findById() {
      return { id: 'post-123', author_id: 'author-1' };
    },
    async createComment(data) {
      createdComment = data;
      return { id: 'cmt-1', ...data };
    }
  };

  const controller = createPostsController({
    postService: {},
    postRepository: mockPostRepository,
  });

  let responseData = null;
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      responseData = { statusCode: this.statusCode, body };
      return this;
    }
  };

  await controller.createComment(
    {
      params: { postId: 'post-123' },
      user: { id: 'visitor-2', status: 'active' },
      body: {
        content: 'Cố tình gửi nội dung rác rưởi',
        forceComment: true,
        authorFilterKeywords: ['rác rưởi']
      }
    },
    mockRes,
    () => {}
  );

  assert.equal(responseData.statusCode, 200);
  assert.equal(responseData.body.isAuthorBlacklisted, true);
  assert.ok(createdComment);
  assert.equal(createdComment.isHidden, true);
  assert.equal(createdComment.isSoftHidden, false);
  assert.equal(createdComment.aiStatus, 'hidden');
  assert.equal(createdComment.aiLabel, 'Author Blacklist');
});

test('createComment: allows post author to comment without being blocked by own keywords', async () => {
  let createdComment = null;
  const mockPostRepository = {
    async findById() {
      return { id: 'post-123', author_id: 'author-1' };
    },
    async createComment(data) {
      createdComment = data;
      return { id: 'cmt-1', ...data };
    }
  };

  const controller = createPostsController({
    postService: {},
    postRepository: mockPostRepository,
  });

  let responseData = null;
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      responseData = { statusCode: this.statusCode, body };
      return this;
    }
  };

  await controller.createComment(
    {
      params: { postId: 'post-123' },
      user: { id: 'author-1', status: 'active' }, // Chính chủ bài viết
      body: {
        content: 'Chủ bài viết tự nói về rác rưởi',
        authorFilterKeywords: ['rác rưởi']
      }
    },
    mockRes,
    () => {}
  );

  assert.equal(responseData.statusCode, 201);
  assert.equal(responseData.body.nudge, undefined);
  assert.ok(createdComment);
});

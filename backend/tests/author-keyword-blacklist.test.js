import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostsController } from '../src/controllers/postsController.js';
import { createPostRepository } from '../src/repositories/postRepository.js';

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
        content: 'Bài viết này chứa nội dung spoiler rất nhiều',
        authorFilterKeywords: ['spoiler', 'tiết lộ trước']
      }
    },
    mockRes,
    () => {}
  );

  assert.equal(responseData.statusCode, 200);
  assert.equal(responseData.body.nudge, true);
  assert.equal(responseData.body.warningType, 'keyword_blacklist');
  assert.equal(responseData.body.matchedKeyword, 'spoiler');
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
        content: 'Cố tình gửi nội dung spoiler',
        forceComment: true,
        authorFilterKeywords: ['spoiler']
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
        content: 'Chủ bài viết tự thảo luận về nội dung spoiler',
        authorFilterKeywords: ['spoiler']
      }
    },
    mockRes,
    () => {}
  );

  assert.equal(responseData.statusCode, 201);
  assert.equal(responseData.body.nudge, undefined);
  assert.ok(createdComment);
});

test('createComment: notifies commenter and completely hides comment when blacklisted keyword is forced', async () => {
  const executedDbQueries = [];
  const mockPool = {
    async query(sql, params) {
      executedDbQueries.push({ sql, params });
      return { rows: [] };
    }
  };

  const mockPostRepository = {
    pool: mockPool,
    async findById() {
      return { id: 'post-123', author_id: 'author-1' };
    },
    async createComment(data) {
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
        content: 'Nội dung chứa từ khóa cấm rác rưởi',
        forceComment: true,
        authorFilterKeywords: ['rác rưởi']
      }
    },
    mockRes,
    () => {}
  );

  assert.equal(responseData.statusCode, 200);
  assert.equal(responseData.body.isAuthorBlacklisted, true);
  assert.equal(responseData.body.data.isHidden, true);

  // Kiểm tra thông báo được gửi đến tài khoản người bình luận
  const notifQuery = executedDbQueries.find(q => /INSERT INTO notifications/i.test(q.sql));
  assert.ok(notifQuery, 'Phải có thông báo gửi về tài khoản người bình luận');
  assert.equal(notifQuery.params[0], 'visitor-2'); // recipient_id
  assert.match(notifQuery.params[2], /rác rưởi/);
});

test('postRepository: findById excludes hidden comments even when queried by comment author', async () => {
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('FROM posts p')) {
        return { rows: [{ id: 10, author_id: 'author-1', ai_status: 'approved', comments_count: 0 }] };
      }
      return { rows: [] };
    }
  };

  const repository = createPostRepository({ pool });
  await repository.findById(10, 'commenter-user');

  const commentQuery = queries.find(q => q.sql.includes('FROM comments c'));
  assert.ok(commentQuery);
  assert.match(commentQuery.sql, /c\.is_hidden = false/);
  assert.match(commentQuery.sql, /c\.ai_status != 'hidden'/);
  assert.doesNotMatch(commentQuery.sql, /c\.is_hidden = false OR c\.author_id/);
});

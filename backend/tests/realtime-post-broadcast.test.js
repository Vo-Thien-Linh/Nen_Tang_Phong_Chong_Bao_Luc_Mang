import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostsController } from '../src/controllers/postsController.js';
import { realtimeService } from '../src/services/realtimeService.js';

function createMockClient() {
  const events = [];
  return {
    events,
    write(chunk) {
      if (chunk.startsWith('data: ')) {
        const json = chunk.slice(6, -2);
        events.push(JSON.parse(json));
      }
    },
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('realtime broadcast: createPost broadcasts POST_CREATED for approved public posts', async () => {
  const client = createMockClient();
  realtimeService.addClient(client);

  try {
    const fakePost = {
      id: 'post-101',
      author_id: 'user-1',
      full_name: 'Nguyen Van A',
      content: 'Một ngày làm việc hiệu quả và an toàn!',
      created_at: new Date().toISOString(),
      ai_status: 'approved',
      image_moderation_status: null,
    };

    const controller = createPostsController({
      postService: {
        async createPost() {
          return fakePost;
        },
      },
      postRepository: {},
      imageModerationClient: async () => ({ decision: 'safe' }),
    });

    const res = createMockResponse();
    await controller.createPost(
      {
        user: { id: 'user-1', full_name: 'Nguyen Van A' },
        body: { content: fakePost.content },
      },
      res,
      () => {}
    );

    assert.equal(res.statusCode, 201);
    const postCreatedEvents = client.events.filter((e) => e.type === 'POST_CREATED');
    assert.equal(postCreatedEvents.length, 1);
    assert.equal(postCreatedEvents[0].post.id, 'post-101');
    assert.equal(postCreatedEvents[0].post.content, fakePost.content);
  } finally {
    realtimeService.removeClient(client);
  }
});

test('realtime broadcast: createPost does NOT broadcast when post is hidden by moderation', async () => {
  const client = createMockClient();
  realtimeService.addClient(client);

  try {
    const hiddenPost = {
      id: 'post-102',
      author_id: 'user-2',
      content: 'Chứa nội dung vi phạm bị ẩn',
      created_at: new Date().toISOString(),
      ai_status: 'hidden',
    };

    const controller = createPostsController({
      postService: {
        async createPost() {
          return hiddenPost;
        },
      },
      postRepository: {},
      imageModerationClient: async () => ({ decision: 'safe' }),
    });

    const res = createMockResponse();
    await controller.createPost(
      {
        user: { id: 'user-2' },
        body: { content: hiddenPost.content },
      },
      res,
      () => {}
    );

    assert.equal(res.statusCode, 201);
    const postCreatedEvents = client.events.filter((e) => e.type === 'POST_CREATED');
    assert.equal(postCreatedEvents.length, 0);
  } finally {
    realtimeService.removeClient(client);
  }
});

test('realtime broadcast: deletePost broadcasts POST_DELETED with postId', async () => {
  const client = createMockClient();
  realtimeService.addClient(client);

  try {
    const controller = createPostsController({
      postService: {
        async deletePost() {
          return true;
        },
      },
      postRepository: {},
    });

    const res = createMockResponse();
    await controller.deletePost(
      {
        user: { id: 'user-1' },
        params: { postId: 'post-555' },
      },
      res,
      () => {}
    );

    assert.equal(res.statusCode, 200);
    const deleteEvents = client.events.filter((e) => e.type === 'POST_DELETED');
    assert.equal(deleteEvents.length, 1);
    assert.equal(deleteEvents[0].postId, 'post-555');
  } finally {
    realtimeService.removeClient(client);
  }
});

test('realtime broadcast: createComment broadcasts COMMENT_CREATED for visible comments', async () => {
  const client = createMockClient();
  realtimeService.addClient(client);

  try {
    const fakeComment = {
      id: 'comm-12',
      author_id: 'user-3',
      full_name: 'Tran B',
      content: 'Bình luận tuyệt vời!',
      created_at: new Date().toISOString(),
      image_moderation_status: 'safe',
    };

    const controller = createPostsController({
      postService: {},
      postRepository: {
        async createComment() {
          return fakeComment;
        },
      },
      imageModerationClient: async () => ({ decision: 'safe' }),
    });

    const res = createMockResponse();
    await controller.createComment(
      {
        user: { id: 'user-3' },
        params: { postId: 'post-77' },
        body: { content: fakeComment.content },
      },
      res,
      () => {}
    );

    assert.equal(res.statusCode, 201);
    const commentEvents = client.events.filter((e) => e.type === 'COMMENT_CREATED');
    assert.equal(commentEvents.length, 1);
    assert.equal(commentEvents[0].postId, 'post-77');
    assert.equal(commentEvents[0].comment.id, 'comm-12');
  } finally {
    realtimeService.removeClient(client);
  }
});

test('realtime broadcast: sharePost broadcasts POST_SHARED with originalPostId and sharedPost', async () => {
  const client = createMockClient();
  realtimeService.addClient(client);

  try {
    const fakeSharedPost = {
      id: 'post-999',
      author_id: 'user-1',
      content: 'Chia sẻ bài viết hay',
      shared_post_id: 'post-11',
      created_at: new Date().toISOString(),
      ai_status: 'approved',
    };

    const controller = createPostsController({
      postService: {
        async sharePost() {
          return fakeSharedPost;
        },
      },
      postRepository: {},
    });

    const res = createMockResponse();
    await controller.sharePost(
      {
        user: { id: 'user-1' },
        params: { postId: 'post-11' },
        body: { content: 'Chia sẻ bài viết hay' },
      },
      res,
      () => {}
    );

    assert.equal(res.statusCode, 201);
    const shareEvents = client.events.filter((e) => e.type === 'POST_SHARED');
    assert.equal(shareEvents.length, 1);
    assert.equal(shareEvents[0].originalPostId, 'post-11');
    assert.equal(shareEvents[0].post.id, 'post-999');
  } finally {
    realtimeService.removeClient(client);
  }
});

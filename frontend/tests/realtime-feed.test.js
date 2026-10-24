import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRealtimeFeedEvent } from '../src/utils/realtimeFeedLogic.js';

test('realtime feed: POST_CREATED prepends the new post to the list', () => {
  const initialPosts = [
    { id: '1', content: 'Bài viết cũ' },
  ];
  const newPost = { id: '2', content: 'Bài viết mới' };

  const updated = handleRealtimeFeedEvent(initialPosts, {
    type: 'POST_CREATED',
    post: newPost,
  });

  assert.equal(updated.length, 2);
  assert.equal(updated[0].id, '2');
  assert.equal(updated[1].id, '1');
});

test('realtime feed: POST_CREATED does not duplicate already existing post', () => {
  const initialPosts = [
    { id: '1', content: 'Bài viết đã có' },
  ];

  const updated = handleRealtimeFeedEvent(initialPosts, {
    type: 'POST_CREATED',
    post: { id: '1', content: 'Bài viết đã có' },
  });

  assert.equal(updated.length, 1);
  assert.equal(updated, initialPosts);
});

test('realtime feed: POST_DELETED removes the post by postId', () => {
  const initialPosts = [
    { id: '1', content: 'Giữ lại' },
    { id: '2', content: 'Sẽ bị xóa' },
  ];

  const updated = handleRealtimeFeedEvent(initialPosts, {
    type: 'POST_DELETED',
    postId: '2',
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, '1');
});

test('realtime feed: COMMENT_CREATED appends comment and increments commentsCount', () => {
  const initialPosts = [
    { id: '1', content: 'Bài viết', commentsCount: 0, comments: [] },
  ];
  const newComment = { id: 'c-1', content: 'Bình luận hay' };

  const updated = handleRealtimeFeedEvent(initialPosts, {
    type: 'COMMENT_CREATED',
    postId: '1',
    comment: newComment,
  });

  assert.equal(updated[0].commentsCount, 1);
  assert.equal(updated[0].comments.length, 1);
  assert.equal(updated[0].comments[0].id, 'c-1');
});

test('realtime feed: COMMENT_CREATED does not duplicate existing comment', () => {
  const initialPosts = [
    { id: '1', content: 'Bài viết', commentsCount: 1, comments: [{ id: 'c-1', content: 'Bình luận' }] },
  ];

  const updated = handleRealtimeFeedEvent(initialPosts, {
    type: 'COMMENT_CREATED',
    postId: '1',
    comment: { id: 'c-1', content: 'Bình luận trùng' },
  });

  assert.equal(updated[0].commentsCount, 1);
  assert.equal(updated[0].comments.length, 1);
});

test('realtime feed: POST_SHARED increments original post sharesCount and prepends shared post', () => {
  const initialPosts = [
    { id: 'orig-1', content: 'Bài gốc', sharesCount: 2 },
  ];
  const sharedPost = { id: 'share-10', content: 'Chia sẻ nè', originalPostId: 'orig-1' };

  const updated = handleRealtimeFeedEvent(initialPosts, {
    type: 'POST_SHARED',
    originalPostId: 'orig-1',
    post: sharedPost,
  });

  assert.equal(updated.length, 2);
  assert.equal(updated[0].id, 'share-10');
  assert.equal(updated[1].id, 'orig-1');
  assert.equal(updated[1].sharesCount, 3);
});

test('realtime feed: returns unchanged posts list for unknown event type or invalid payload', () => {
  const initialPosts = [{ id: '1', content: 'Bài viết' }];
  assert.equal(handleRealtimeFeedEvent(initialPosts, null), initialPosts);
  assert.equal(handleRealtimeFeedEvent(initialPosts, { type: 'UNKNOWN_TYPE' }), initialPosts);
});

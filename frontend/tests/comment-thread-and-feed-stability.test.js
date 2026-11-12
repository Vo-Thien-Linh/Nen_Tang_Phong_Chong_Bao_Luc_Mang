import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommentTree } from '../src/utils/commentThreadLogic.js';
import { rankAndInterleaveFeed, selectHotPostIdsSnapshot } from '../src/utils/homeFeedOrder.js';

test('commentThreadLogic: sorts newest root comments first, nests multi-level replies, and keeps soft-hidden last', () => {
  const comments = [
    { id: '1', parentId: null, content: 'Bình luận cũ nhất', createdAt: '2026-11-12T10:00:00Z' },
    { id: '2', parentId: null, content: 'Bình luận Toxic', is_soft_hidden: true, ai_label: 'Toxic', createdAt: '2026-11-12T12:00:00Z' },
    { id: '3', parentId: '1', content: 'Trả lời cấp 1 cũ', createdAt: '2026-11-12T10:05:00Z' },
    { id: '4', parentId: null, content: 'Bình luận mới nhất', createdAt: '2026-11-12T11:00:00Z' },
    { id: '5', parentId: '1', content: 'Trả lời cấp 1 mới', createdAt: '2026-11-12T10:10:00Z' },
    { id: '6', parentId: '5', content: 'Trả lời cấp 2', createdAt: '2026-11-12T10:15:00Z' },
  ];

  const tree = buildCommentTree(comments);

  // Root level: newest normal ('4') -> older normal ('1') -> soft-hidden ('2')
  assert.deepEqual(tree.map((c) => c.id), ['4', '1', '2']);
  // Level 1 replies under '1': newest ('5') -> older ('3')
  assert.deepEqual(tree[1].replies.map((r) => r.id), ['5', '3']);
  // Level 2 reply nested under '5'
  assert.deepEqual(tree[1].replies[0].replies.map((r) => r.id), ['6']);
});

test('commentThreadLogic: promotes orphan comments to root safely', () => {
  const tree = buildCommentTree([
    { id: '10', parentId: '999', content: 'Orphan reply', createdAt: '2026-11-12T10:00:00Z' },
  ]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, '10');
});

test('homeFeedOrder: post stays in place when user adds a comment and replies to it', () => {
  const hot1 = { id: 'h1', commentsCount: 5, likesCount: 4, comments: new Array(5).fill({}) };
  const hot2 = { id: 'h2', commentsCount: 4, likesCount: 4, comments: new Array(4).fill({}) };
  const newestPost = { id: 'new-post', commentsCount: 0, likesCount: 0, comments: [] };
  const olderPost = { id: 'old-post', commentsCount: 0, likesCount: 0, comments: [] };

  const initialPosts = [newestPost, olderPost, hot1, hot2];
  const frozenHotIds = selectHotPostIdsSnapshot(initialPosts);
  assert.equal(frozenHotIds.has('new-post'), false);

  const initialOrder = rankAndInterleaveFeed(initialPosts, 0, frozenHotIds).map((p) => p.id);
  const initialIdx = initialOrder.indexOf('new-post');

  // Simulate user commenting + replying (2 comments -> score = 6 >= 6!)
  const afterCommentAndReply = [
    { ...newestPost, commentsCount: 2, comments: [{ id: 'c1' }, { id: 'c2', parentId: 'c1' }] },
    olderPost,
    hot1,
    hot2,
  ];
  const afterOrder = rankAndInterleaveFeed(afterCommentAndReply, 0, frozenHotIds).map((p) => p.id);

  assert.equal(afterOrder.indexOf('new-post'), initialIdx, 'Bài viết không được nhảy vị trí hay biến mất sau khi bình luận và trả lời');
});


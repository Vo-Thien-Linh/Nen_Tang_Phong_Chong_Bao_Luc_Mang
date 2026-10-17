import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendCreatedComment,
  canStartCreation,
  incrementPostCountOnce,
  prependCreatedPost,
} from '../src/utils/creationFlowLogic.js';

test('prepend created post inserts the server result at the top once', () => {
  const post = { id: 'new', content: 'server result' };
  assert.deepEqual(prependCreatedPost([{ id: 'old' }], post), [post, { id: 'old' }]);
  assert.deepEqual(prependCreatedPost([post], post), [post]);
});

test('post counter increments once for the author', () => {
  const user = { id: 'u1', postsCount: 3 };
  const post = { id: 'p1', author: { id: 'u1' } };
  assert.equal(incrementPostCountOnce(user, post, false).postsCount, 4);
  assert.equal(incrementPostCountOnce(user, post, true).postsCount, 3);
});

test('created comment appends and increments once', () => {
  const post = { id: 'p1', commentsCount: 1, comments: [{ id: 'c1' }] };
  const comment = { id: 'c2', content: 'new' };
  assert.equal(appendCreatedComment(post, comment).commentsCount, 2);
  assert.equal(appendCreatedComment({ ...post, comments: [...post.comments, comment] }, comment).commentsCount, 1);
});

test('creation is blocked while a request is pending', () => {
  assert.equal(canStartCreation(false), true);
  assert.equal(canStartCreation(true), false);
});

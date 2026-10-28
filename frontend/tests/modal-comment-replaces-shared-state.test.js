import test from 'node:test';
import assert from 'node:assert/strict';
import { replacePostComments } from '../src/utils/creationFlowLogic.js';

test('modal comment updates shared post immediately and keeps its counter once', () => {
  const post = { id: 'p1', commentsCount: 1, comments: [{ id: 'c1' }] };
  const newComment = { id: 'c2', content: 'new comment' };
  const updated = replacePostComments(post, [post.comments[0], newComment, newComment], 2);
  assert.deepEqual(updated.comments.map((comment) => comment.id), ['c1', 'c2']);
  assert.equal(updated.commentsCount, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRealtimeFeedEvent } from '../src/utils/realtimeFeedLogic.js';

test('realtime echo of own action does not duplicate the item', () => {
  const post = { id: 'p1', commentsCount: 1, comments: [{ id: 'c1' }] };
  const afterPostEcho = handleRealtimeFeedEvent([post], { type: 'POST_CREATED', post });
  const afterCommentEcho = handleRealtimeFeedEvent(afterPostEcho, {
    type: 'COMMENT_CREATED', postId: 'p1', comment: { id: 'c1' },
  });
  assert.equal(afterPostEcho.length, 1);
  assert.equal(afterCommentEcho[0].comments.length, 1);
  assert.equal(afterCommentEcho[0].commentsCount, 1);
});

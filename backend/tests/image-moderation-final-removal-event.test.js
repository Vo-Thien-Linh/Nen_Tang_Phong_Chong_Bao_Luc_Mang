import test from 'node:test';
import assert from 'node:assert/strict';
import { getFinalRejectionEvent } from '../src/services/imageModerationRealtimeEvents.js';

test('final rejection creates safe removal events for posts and comments', () => {
  assert.deepEqual(getFinalRejectionEvent({ id: 7, type: 'post' }), {
    type: 'POST_DELETED', postId: '7',
  });
  assert.deepEqual(getFinalRejectionEvent({ id: 8, type: 'comment', postId: 7 }), {
    type: 'COMMENT_DELETED', postId: '7', commentId: '8',
  });
  assert.equal(getFinalRejectionEvent({ id: 9, type: 'unknown' }), null);
});

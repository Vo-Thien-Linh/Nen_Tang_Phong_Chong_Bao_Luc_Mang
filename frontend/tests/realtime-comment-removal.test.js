import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRealtimeFeedEvent } from '../src/utils/realtimeFeedLogic.js';

test('final rejected comment disappears from the loaded feed', () => {
  const previous = [{ id: '7', commentsCount: 1, comments: [{ id: '8' }] }];
  const next = handleRealtimeFeedEvent(previous, {
    type: 'COMMENT_DELETED', postId: '7', commentId: '8',
  });

  assert.deepEqual(next, [{ id: '7', commentsCount: 0, comments: [] }]);
});

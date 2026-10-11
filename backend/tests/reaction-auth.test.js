import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactionService } from '../src/services/reactionService.js';

test('require login when unauthenticated user reacts to post', async () => {
  const service = createReactionService({
    reactionRepository: {
      async setReaction() {
        throw new Error('should not save');
      },
    },
  });

  await assert.rejects(
    () => service.reactToPost({ user: null, postId: '1', type: 'like' }),
    (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, 'Bạn cần đăng nhập để thả icon');
      return true;
    }
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactionService } from '../src/services/reactionService.js';

test('reject reaction type outside the six allowed types', async () => {
  const service = createReactionService({
    reactionRepository: {
      async setReaction() {
        throw new Error('should not save');
      },
    },
  });

  await assert.rejects(
    () => service.reactToPost({ user: { id: 'user-1' }, postId: '1', type: 'clap' }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, 'Loại cảm xúc không hợp lệ');
      return true;
    }
  );
});

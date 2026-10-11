import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactionService } from '../src/services/reactionService.js';

test('default to like when reaction type is not chosen', async () => {
  let savedInput;
  const service = createReactionService({
    reactionRepository: {
      async setReaction(input) {
        savedInput = input;
        return { action: 'created', myReaction: input.reactionType, totalCount: 1, counts: {} };
      },
    },
  });

  const result = await service.reactToPost({
    user: { id: 'user-1' },
    postId: '10',
  });

  assert.equal(savedInput.reactionType, 'like');
  assert.equal(result.myReaction, 'like');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactionService } from '../src/services/reactionService.js';
import { createPostReactionsController } from '../src/controllers/postReactionsController.js';

test('reactionService.reactToComment validates auth, reaction type, and removal', async () => {
  let lastCall = null;
  const service = createReactionService({
    reactionRepository: {
      async setCommentReaction(args) {
        lastCall = args;
        return {
          action: args.forceRemove ? 'removed' : 'created',
          postId: String(args.postId),
          commentId: String(args.commentId),
          myReaction: args.forceRemove ? null : args.reactionType,
          reactionCounts: args.forceRemove ? {} : { [args.reactionType]: 1 },
          totalReactions: args.forceRemove ? 0 : 1,
        };
      },
    },
  });

  await assert.rejects(
    () => service.reactToComment({ user: null, postId: '1', commentId: '2', type: 'like' }),
    (err) => err.statusCode === 401
  );

  await assert.rejects(
    () => service.reactToComment({ user: { id: 'u1' }, postId: '1', commentId: '2', type: 'invalid_emoji' }),
    (err) => err.statusCode === 400
  );

  const created = await service.reactToComment({ user: { id: 'u1' }, postId: '1', commentId: '2', type: 'love', action: 'set' });
  assert.equal(lastCall.reactionType, 'love');
  assert.equal(lastCall.forceRemove, false);
  assert.equal(created.myReaction, 'love');

  const removed = await service.reactToComment({ user: { id: 'u1' }, postId: '1', commentId: '2', type: null, action: 'remove' });
  assert.equal(lastCall.forceRemove, true);
  assert.equal(removed.myReaction, null);
  assert.equal(removed.totalReactions, 0);
});

test('postReactionsController.reactToComment forwards params and returns JSON data', async () => {
  const controller = createPostReactionsController({
    reactionService: {
      async reactToComment({ postId, commentId, type }) {
        return { postId, commentId, myReaction: type, totalReactions: 1 };
      },
    },
  });

  const res = {
    body: null,
    json(payload) { this.body = payload; },
  };
  await controller.reactToComment(
    { params: { postId: '10', commentId: '20' }, user: { id: 'u1' }, body: { type: 'haha', action: 'set' } },
    res,
    (err) => { throw err; }
  );

  assert.equal(res.body.success, true);
  assert.equal(res.body.data.myReaction, 'haha');
  assert.equal(res.body.data.commentId, '20');
});


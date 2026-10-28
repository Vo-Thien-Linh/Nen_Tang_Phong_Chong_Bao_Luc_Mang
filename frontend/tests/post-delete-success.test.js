import test from 'node:test';
import assert from 'node:assert/strict';
import { removePostFromList, runPostDeleteAction } from '../src/utils/postActionLogic.js';

test('post is removed only after delete succeeds', async () => {
  let posts = [{ id: '1', content: 'remove after confirmation' }];
  let finishRequest;
  const action = runPostDeleteAction({
    deleteRequest: () => new Promise((resolve) => { finishRequest = resolve; }),
    onSuccess: () => { posts = removePostFromList(posts, '1'); },
  });

  assert.equal(posts.length, 1);
  finishRequest({ success: true });
  await action;

  assert.deepEqual(posts, []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { removePostFromList, runPostDeleteAction } from '../src/utils/postActionLogic.js';

test('post is restored when delete request fails', async () => {
  const originalPost = { id: '1', content: 'keep me' };
  let posts = [originalPost];

  await assert.rejects(
    () => runPostDeleteAction({
      deleteRequest: async () => { throw new Error('server error'); },
      onSuccess: () => { posts = removePostFromList(posts, '1'); },
    }),
    /server error/
  );

  assert.deepEqual(posts, [originalPost]);
});

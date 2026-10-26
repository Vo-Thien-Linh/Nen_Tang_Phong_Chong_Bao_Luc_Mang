import test from 'node:test';
import assert from 'node:assert/strict';
import { removePostFromList, runPostDeleteAction } from '../src/utils/postActionLogic.js';

test('failed delete keeps the post in the lists', async () => {
  const original = { id: 'p1', content: 'still here' };
  let lists = [[original], [{ ...original }]];
  await assert.rejects(runPostDeleteAction({
    deleteRequest: async () => { throw new Error('delete failed'); },
    onSuccess: () => { lists = lists.map((list) => removePostFromList(list, 'p1')); },
  }), /delete failed/);
  assert.equal(lists[0][0].content, 'still here');
  assert.equal(lists[1][0].id, 'p1');
});

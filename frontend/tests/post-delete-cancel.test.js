import test from 'node:test';
import assert from 'node:assert/strict';
import { removePostFromList } from '../src/utils/postActionLogic.js';

test('cancel delete keeps post in list', () => {
  const posts = [{ id: '1' }];

  assert.deepEqual(posts, [{ id: '1' }]);
  assert.deepEqual(removePostFromList(posts, '2'), posts);
});

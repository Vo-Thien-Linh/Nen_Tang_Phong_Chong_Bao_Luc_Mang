import test from 'node:test';
import assert from 'node:assert/strict';
import { removePostFromList } from '../src/utils/postActionLogic.js';

test('confirm delete removes post from every list', () => {
  const posts = [{ id: '1' }, { id: '2' }];

  assert.deepEqual(removePostFromList(posts, '1'), [{ id: '2' }]);
});

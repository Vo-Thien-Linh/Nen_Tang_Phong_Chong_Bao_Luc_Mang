import test from 'node:test';
import assert from 'node:assert/strict';
import { removePostFromList } from '../src/utils/postActionLogic.js';

test('remove post from list when api says post does not exist', () => {
  const posts = [{ id: '1' }, { id: '2' }];

  assert.deepEqual(removePostFromList(posts, '2'), [{ id: '1' }]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { removePostFromList } from '../src/utils/postActionLogic.js';
import { countVisiblePosts } from '../src/utils/noticeLogic.js';

test('deleted post is removed from every list and counters decrease once', () => {
  const lists = [[{ id: 'p1' }, { id: 'p2' }], [{ id: 'p1' }, { id: 'p2' }]];
  const remaining = lists.map((list) => removePostFromList(list, 'p1'));
  assert.deepEqual(remaining, [[{ id: 'p2' }], [{ id: 'p2' }]]);
  assert.equal(countVisiblePosts(remaining[0]), 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { countVisiblePosts, markDeletedPostNotice } from '../src/utils/noticeLogic.js';

test('exclude deleted post from counts while notice is visible', () => {
  const posts = [markDeletedPostNotice({ id: '1' }), { id: '2' }];

  assert.equal(countVisiblePosts(posts), 1);
});

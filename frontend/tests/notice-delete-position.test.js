import test from 'node:test';
import assert from 'node:assert/strict';
import { markDeletedPostNotice } from '../src/utils/noticeLogic.js';

test('show delete success notice at the deleted post position', () => {
  const posts = [{ id: '1' }, { id: '2' }];
  const result = posts.map((post) => (post.id === '1' ? markDeletedPostNotice(post) : post));

  assert.equal(result[0].inlineNotice.message, 'Xóa bài viết thành công');
  assert.equal(result[1].id, '2');
});

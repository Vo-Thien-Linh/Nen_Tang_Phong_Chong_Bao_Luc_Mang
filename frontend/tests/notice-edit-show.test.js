import test from 'node:test';
import assert from 'node:assert/strict';
import { markEditPostNotice } from '../src/utils/noticeLogic.js';

test('show edit success notice on the updated post', () => {
  const post = markEditPostNotice({ id: '1' });

  assert.equal(post.inlineNotice.message, 'Cập nhật bài viết thành công');
  assert.equal(post.inlineNotice.tone, 'success');
});

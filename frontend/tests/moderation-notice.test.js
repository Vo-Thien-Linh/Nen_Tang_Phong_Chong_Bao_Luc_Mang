import test from 'node:test';
import assert from 'node:assert/strict';
import { moderationViolationNotice } from '../src/utils/moderationNoticeLogic.js';

test('post moderation notice names the post', () => {
  assert.equal(moderationViolationNotice('post'), 'Bài viết của bạn vi phạm quy định cộng đồng');
});

test('comment moderation notice names the comment', () => {
  assert.equal(moderationViolationNotice('comment'), 'Bình luận của bạn vi phạm quy định cộng đồng');
});

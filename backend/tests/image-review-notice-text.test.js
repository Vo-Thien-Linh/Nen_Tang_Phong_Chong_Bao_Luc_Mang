import test from 'node:test';
import assert from 'node:assert/strict';
import { getModerationNoticeText } from '../src/services/moderationNotificationText.js';

test('rejected admin post notice uses post wording', () => {
  assert.match(getModerationNoticeText('post', 'rejected_admin'), /^Bài viết của bạn/);
});

test('rejected admin comment notice uses comment wording', () => {
  assert.match(getModerationNoticeText('comment', 'rejected_admin'), /^Bình luận của bạn/);
});

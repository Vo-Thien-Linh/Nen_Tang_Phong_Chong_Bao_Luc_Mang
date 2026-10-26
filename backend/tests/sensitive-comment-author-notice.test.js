import test from 'node:test';
import assert from 'node:assert/strict';
import { formatImageModerationForViewer } from '../src/services/imageModerationResponse.js';

test('author sees own comment sensitive notice with comment wording', () => {
  const result = formatImageModerationForViewer({ status: 'sensitive' }, 'comment', 'author-1', 'author-1');
  assert.equal(result.noticeType, 'sensitive_author');
  assert.equal(result.noticeText, 'Bình luận của bạn được gắn nhãn nhạy cảm nên những người dùng khác sẽ thấy nội dung này bị che mờ.');
});

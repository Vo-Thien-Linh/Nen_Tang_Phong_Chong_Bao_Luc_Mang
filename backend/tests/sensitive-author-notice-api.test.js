import test from 'node:test';
import assert from 'node:assert/strict';
import { formatImageModerationForViewer } from '../src/services/imageModerationResponse.js';

test('author gets sensitive notice for own sensitive post', () => {
  const result = formatImageModerationForViewer({ status: 'sensitive', label: 'NSFW' }, 'post', 'author-1', 'author-1');
  assert.equal(result.noticeType, 'sensitive_author');
  assert.equal(result.noticeText, 'Ảnh trong bài viết của bạn được gắn nhãn nhạy cảm nên những người dùng khác sẽ thấy ảnh này bị che mờ.');
});

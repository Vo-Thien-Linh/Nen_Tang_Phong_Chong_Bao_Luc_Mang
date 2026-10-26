import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getModerationNoticeText } from '../src/services/moderationNotificationText.js';

test('no garbled notice text exists', async () => {
  const backendText = await readFile(new URL('../src/services/moderationNotificationText.js', import.meta.url), 'utf8');
  const sharedText = await readFile(new URL('../../shared/moderationNoticeText.js', import.meta.url), 'utf8');
  assert.doesNotMatch(backendText, /chứa ảnh bị từ chối sau khi quản trị viên xem xét/);
  assert.doesNotMatch(backendText, /vi phạm tiêu chuẩn cộng đồng nên chúng tôi không cho phép hiển thị/);
  assert.match(backendText, /Sau khi xem xét lại/);
  assert.equal(getModerationNoticeText('post', 'rejected_hold'), 'Bài viết của bạn đã vi phạm tiêu chuẩn cộng đồng.');
  assert.match(sharedText, /Bình luận của bạn đã vi phạm tiêu chuẩn cộng đồng\./);
});

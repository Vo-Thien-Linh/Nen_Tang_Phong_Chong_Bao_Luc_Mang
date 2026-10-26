import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getImageReviewNotice } from '../src/utils/imageModerationReviewLogic.js';

test('held item shows appeal button without countdown', async () => {
  const notice = getImageReviewNotice('rejected_hold', 'post', true);
  const source = await readFile(new URL('../src/components/PostCard.jsx', import.meta.url), 'utf8');

  assert.equal(notice.visible, true);
  assert.equal(notice.showAppealButton, true);
  assert.match(source, /post\.imageModeration\?\.status === 'rejected_hold'/);
  assert.match(source, /Khiếu nại/);
  assert.doesNotMatch(source, /remainingSeconds|Sẽ bị xóa sau/);
});

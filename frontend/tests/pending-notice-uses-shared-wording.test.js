import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getModerationNoticeText } from '../src/utils/moderationNoticeLogic.js';

test('pending review notice uses the shared wording', async () => {
  const source = await readFile(new URL('../src/components/PostCard.jsx', import.meta.url), 'utf8');
  assert.match(source, /getModerationNoticeText\('post', 'pending_review'\)/);
  assert.equal(getModerationNoticeText('post', 'pending_review'), 'Đang chờ quản trị viên duyệt.');
});

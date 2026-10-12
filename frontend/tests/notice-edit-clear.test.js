import test from 'node:test';
import assert from 'node:assert/strict';
import { clearPostNotice, markEditPostNotice } from '../src/utils/noticeLogic.js';

test('clear edit notice after timeout', () => {
  const posts = [markEditPostNotice({ id: '1' })];

  assert.equal(clearPostNotice(posts, '1')[0].inlineNotice, null);
});

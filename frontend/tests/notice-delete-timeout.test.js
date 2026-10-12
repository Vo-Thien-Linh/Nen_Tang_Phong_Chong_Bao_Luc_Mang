import test from 'node:test';
import assert from 'node:assert/strict';
import { markDeletedPostNotice, removeDeletedNotice } from '../src/utils/noticeLogic.js';

test('remove delete notice after timeout', () => {
  const posts = [markDeletedPostNotice({ id: '1' }), { id: '2' }];

  assert.deepEqual(removeDeletedNotice(posts, '1'), [{ id: '2' }]);
});

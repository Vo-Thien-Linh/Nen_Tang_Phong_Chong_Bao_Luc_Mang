import test from 'node:test';
import assert from 'node:assert/strict';
import { canReportPost } from '../src/utils/postActionLogic.js';

test('show report action on other users posts', () => {
  assert.equal(canReportPost({ author: { id: 'u2' } }, { id: 'u1' }), true);
});

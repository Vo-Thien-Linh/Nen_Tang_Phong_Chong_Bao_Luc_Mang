import test from 'node:test';
import assert from 'node:assert/strict';
import { canReportPost } from '../src/utils/postActionLogic.js';

test('hide report action on own post', () => {
  assert.equal(canReportPost({ author: { id: 'u1' } }, { id: 'u1' }), false);
});

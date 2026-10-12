import test from 'node:test';
import assert from 'node:assert/strict';
import { canDeletePost } from '../src/utils/postActionLogic.js';

test('show delete action only on own posts', () => {
  assert.equal(canDeletePost({ author: { id: 'u1' } }, { id: 'u1' }), true);
  assert.equal(canDeletePost({ author: { id: 'u2' } }, { id: 'u1' }), false);
});

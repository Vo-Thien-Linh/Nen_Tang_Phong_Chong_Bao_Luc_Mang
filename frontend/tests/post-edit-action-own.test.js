import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditPost } from '../src/utils/postActionLogic.js';

test('show edit action only on own posts', () => {
  assert.equal(canEditPost({ author: { id: 'u1' } }, { id: 'u1' }), true);
  assert.equal(canEditPost({ author: { id: 'u2' } }, { id: 'u1' }), false);
});

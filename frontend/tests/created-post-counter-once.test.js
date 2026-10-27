import test from 'node:test';
import assert from 'node:assert/strict';
import { incrementPostCountOnce } from '../src/utils/creationFlowLogic.js';

test('created post increases the profile counter once', () => {
  const user = { id: 'author', postsCount: 4 };
  const post = { id: 'new', author_id: 'author' };
  assert.equal(incrementPostCountOnce(user, post, false).postsCount, 5);
  assert.equal(incrementPostCountOnce(user, post, true).postsCount, 4);
});

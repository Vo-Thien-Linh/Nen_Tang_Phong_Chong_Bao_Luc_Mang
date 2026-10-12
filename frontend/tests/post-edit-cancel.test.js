import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelEditPost } from '../src/utils/postActionLogic.js';

test('cancel edit leaves post unchanged', () => {
  const post = { id: '1', content: 'old', image: 'old.jpg' };

  assert.equal(cancelEditPost(post), post);
});

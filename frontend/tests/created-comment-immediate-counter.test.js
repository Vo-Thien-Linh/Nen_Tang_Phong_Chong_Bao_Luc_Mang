import test from 'node:test';
import assert from 'node:assert/strict';
import { appendCreatedComment } from '../src/utils/creationFlowLogic.js';

test('created comment appears immediately and counter increases once', () => {
  const original = { id: 'p1', commentsCount: 2, comments: [{ id: 'c1' }, { id: 'c2' }] };
  const comment = { id: 'c3', content: 'just added' };
  const updated = appendCreatedComment(original, comment);
  const echoed = appendCreatedComment(updated, comment);
  assert.equal(updated.comments.at(-1), comment);
  assert.equal(updated.commentsCount, 3);
  assert.equal(echoed.commentsCount, 3);
});

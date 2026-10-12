import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUpdatedPostToList } from '../src/utils/postActionLogic.js';

test('apply updated post to list and show edited label', () => {
  const posts = [{ id: '1', content: 'old', isEdited: false }];
  const result = applyUpdatedPostToList(posts, { id: '1', content: 'new', isEdited: true });

  assert.equal(result[0].content, 'new');
  assert.equal(result[0].isEdited, true);
});

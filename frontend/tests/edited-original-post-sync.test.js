import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUpdatedPostToList } from '../src/utils/postActionLogic.js';

test('edit updates the matching original post inside shared cards', () => {
  const posts = [{ id: 'share-1', originalPost: { id: 'original-1', content: 'old', image: 'old.png' } }];
  const updated = applyUpdatedPostToList(posts, { id: 'original-1', content: 'new', image: 'new.png' });
  assert.equal(updated[0].originalPost.content, 'new');
  assert.equal(updated[0].originalPost.image, 'new.png');
});

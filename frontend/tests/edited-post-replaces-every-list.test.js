import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUpdatedPostToList } from '../src/utils/postActionLogic.js';

test('edited post replaces the item in every list', () => {
  const old = { id: 'p1', content: 'before', image: '/old.png', imageModeration: { status: 'clear' } };
  const updated = { id: 'p1', content: 'after', image_url: '/new.png', imageModeration: { status: 'pending_review' }, isEdited: true };
  const lists = [[old], [{ ...old }], [{ ...old }]];
  const replaced = lists.map((list) => applyUpdatedPostToList(list, updated));
  for (const [list] of replaced) {
    assert.equal(list.content, 'after');
    assert.equal(list.image, '/new.png');
    assert.equal(list.imageModeration.status, 'pending_review');
    assert.equal(list.isEdited, true);
  }
});

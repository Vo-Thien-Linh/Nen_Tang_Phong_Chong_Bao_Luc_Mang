import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUpdatedPostToList } from '../src/utils/postActionLogic.js';

test('appeal updates the item in every list', () => {
  const old = { id: 'p1', imageModeration: { status: 'rejected_hold' } };
  const appealed = { id: 'p1', imageModeration: { status: 'appeal_pending', noticeText: 'Under review' } };
  const lists = [[old], [{ ...old }], [{ ...old }]];
  for (const list of lists.map((items) => applyUpdatedPostToList(items, appealed))) {
    assert.equal(list[0].imageModeration.status, 'appeal_pending');
    assert.equal(list[0].imageModeration.noticeText, 'Under review');
  }
});

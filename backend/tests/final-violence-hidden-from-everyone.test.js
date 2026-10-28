import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPostToResponse } from '../src/controllers/postsController.js';

test('final violence removes the item for everyone including the author', () => {
  const row = { id: 44, author_id: 'author-1', image_moderation_status: 'rejected_final', comments: [] };

  assert.equal(mapPostToResponse(row, 'author-1').imageModeration, null);
  assert.equal(mapPostToResponse(row, 'viewer-2').imageModeration, null);
});

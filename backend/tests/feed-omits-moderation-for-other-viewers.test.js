import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPostToResponse } from '../src/controllers/postsController.js';

test('feed omits moderation state for other viewers', () => {
  const response = mapPostToResponse({
    id: 10,
    author_id: 'author-1',
    image_moderation_status: 'rejected_admin',
    image_moderation_label: 'Violence',
    image_moderation_appealed_at: null,
    moderation_expires_at: null,
    comments: [],
  }, 'viewer-2');

  assert.equal(response.imageModeration, null);
});

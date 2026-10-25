import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPostToResponse } from '../src/controllers/postsController.js';

test('other users receive no review status on posts or comments', () => {
  const response = mapPostToResponse({
    id: 1,
    author_id: 'author',
    image_moderation_status: 'rejected_admin',
    comments: [{ id: 2, author: { id: 'comment-author' }, imageModeration: { status: 'appeal_pending' } }],
  }, 'viewer');
  assert.equal(response.imageModeration, null);
  assert.equal(response.comments[0].imageModeration, null);
});

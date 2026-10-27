import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPostToResponse } from '../src/controllers/postsController.js';

test('appeal pending item shows under review label in the feed', () => {
  const response = mapPostToResponse({
    id: 13,
    author_id: 'author-1',
    image_moderation_status: 'appeal_pending',
    image_moderation_label: 'Violence',
    comments: [],
  }, 'author-1');

  assert.equal(response.imageModeration.status, 'appeal_pending');
  assert.equal(response.imageModeration.noticeType, 'appeal_pending');
  assert.match(response.imageModeration.noticeText, /xem xÃ©t|xem xét/i);
  assert.equal(response.imageModeration.canAppeal, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPostToResponse } from '../src/controllers/postsController.js';

test('feed mapper keeps moderation fields', () => {
  const response = mapPostToResponse({
    id: 11,
    author_id: 'author-1',
    image_moderation_status: 'rejected_hold',
    image_moderation_label: 'Violence',
    image_moderation_safe: 0.1,
    image_moderation_nsfw: 0.2,
    image_moderation_violence: 0.9,
    image_moderation_thresholds: { violence: 0.8 },
    image_moderation_appealed_at: '2026-10-20T00:00:00Z',
    moderation_expires_at: '2026-10-27T00:00:00Z',
    comments: [],
  }, 'author-1');

  assert.equal(response.imageModeration.status, 'rejected_hold');
  assert.equal(response.imageModeration.label, 'Violence');
  assert.deepEqual(response.imageModeration.scores, { safe: 0.1, nsfw: 0.2, violence: 0.9 });
  assert.deepEqual(response.imageModeration.thresholds, { violence: 0.8 });
  assert.equal(response.imageModeration.appealedAt, '2026-10-20T00:00:00Z');
  assert.equal(response.imageModeration.canAppeal, true);
  assert.equal('moderationExpiresAt' in response.imageModeration, false);
  assert.equal('remainingSeconds' in response.imageModeration, false);
});

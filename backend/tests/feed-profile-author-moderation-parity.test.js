import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPostToResponse } from '../src/controllers/postsController.js';
import { formatImageModerationForViewer } from '../src/services/imageModerationResponse.js';

test('feed and profile produce the same author state for a rejected admin post', () => {
  const row = {
    id: 12,
    author_id: 'author-1',
    image_moderation_status: 'rejected_admin',
    image_moderation_label: 'Violence',
    image_moderation_safe: 0.1,
    image_moderation_nsfw: 0.1,
    image_moderation_violence: 0.9,
    image_moderation_thresholds: {},
    image_moderation_appealed_at: null,
    moderation_expires_at: null,
    comments: [],
  };
  const feedState = mapPostToResponse(row, 'author-1').imageModeration;
  const profileState = formatImageModerationForViewer({
    status: row.image_moderation_status,
    label: row.image_moderation_label,
    scores: { safe: 0.1, nsfw: 0.1, violence: 0.9 },
    thresholds: {},
    appealedAt: null,
  }, 'post', row.author_id, 'author-1');

  assert.deepEqual(feedState, profileState);
});

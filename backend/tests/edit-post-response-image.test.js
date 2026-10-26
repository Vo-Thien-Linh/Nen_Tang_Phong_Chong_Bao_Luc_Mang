import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPostToResponse } from '../src/controllers/postsController.js';

test('edit response contains the new image', () => {
  const response = mapPostToResponse({
    id: 12,
    author_id: 'author-1',
    content: 'updated post',
    image_url: 'https://res.cloudinary.com/test/new.png',
    image_moderation_status: 'sensitive',
    image_moderation_label: 'NSFW',
    ai_status: 'approved',
    created_at: new Date('2026-10-20T12:00:00.000Z'),
    full_name: 'Author',
  }, 'author-1');

  assert.equal(response.image, 'https://res.cloudinary.com/test/new.png');
  assert.equal(response.imageModeration.status, 'sensitive');
});

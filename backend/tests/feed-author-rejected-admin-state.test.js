import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostsController } from '../src/controllers/postsController.js';

const rejectedAdminPost = {
  id: 9,
  author_id: 'author-1',
  content: 'post text',
  image_url: '/image.jpg',
  image_moderation_status: 'rejected_admin',
  image_moderation_label: 'Violence',
  image_moderation_safe: 0.1,
  image_moderation_nsfw: 0.1,
  image_moderation_violence: 0.9,
  image_moderation_thresholds: {},
  image_moderation_appealed_at: null,
  moderation_expires_at: null,
  ai_label: 'Normal',
  ai_confidence: 0.99,
  ai_status: 'approved',
  created_at: new Date('2026-10-20T00:00:00Z'),
  full_name: 'Author',
  username: 'author',
  avatar_url: null,
  is_verified: false,
  comments: [],
};

test('feed returns moderation state for the author’s rejected admin post', async () => {
  let response;
  const controller = createPostsController({
    postService: { async listVisiblePosts() { return [rejectedAdminPost]; } },
    postRepository: {},
    imageModerationClient: async () => null,
  });

  await controller.listPosts({ user: { id: 'author-1' } }, { json(value) { response = value; } }, (error) => { throw error; });

  assert.equal(response.data[0].imageModeration.status, 'rejected_admin');
  assert.equal(response.data[0].imageModeration.noticeType, 'rejected_admin');
  assert.equal(response.data[0].imageModeration.canAppeal, true);
  assert.match(response.data[0].imageModeration.noticeText, /vi phạm tiêu chuẩn cộng đồng/);
});

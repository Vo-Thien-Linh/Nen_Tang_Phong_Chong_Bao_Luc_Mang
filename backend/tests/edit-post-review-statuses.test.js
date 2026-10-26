import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('edit is blocked for review statuses with a clear message', async () => {
  const blockedStatuses = ['pending_review', 'rejected_hold', 'rejected_admin', 'appeal_pending', 'rejected_final'];

  for (const image_moderation_status of blockedStatuses) {
    let updated = false;
    const service = createPostService({
      postRepository: {
        async findByIdForOwnerAction() {
          return { id: '1', author_id: 'u1', image_moderation_status, ai_status: 'approved' };
        },
        async updatePost() {
          updated = true;
        },
      },
      moderationHook: {},
    });

    await assert.rejects(
      () => service.editPost({ user: { id: 'u1' }, postId: '1', content: 'updated', imageUrl: null }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.message, 'Không thể chỉnh sửa nội dung đang trong quy trình duyệt');
        return true;
      },
      image_moderation_status
    );
    assert.equal(updated, false, image_moderation_status);
  }
});

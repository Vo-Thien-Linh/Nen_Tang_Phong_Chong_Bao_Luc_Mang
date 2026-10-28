import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('createPost returns nudge for negative/violating content when forcePost is false', async () => {
  const service = createPostService({
    postRepository: {
      async createPost() {
        throw new Error('Should not reach createPost without forcePost');
      },
    },
    moderationHook: { async afterPostCreated() {} },
  });

  const res = await service.createPost({
    user: { id: 'u1' },
    content: 'Mày ngu như chó đồ rác rưởi',
    forcePost: false,
  });

  assert.equal(res.nudge, true);
  assert.ok(['toxic', 'hate_speech'].includes(res.warningType));
  assert.ok(Boolean(res.message));
});

test('createPost creates flagged post when forcePost is true', async () => {
  let saved = null;
  const service = createPostService({
    postRepository: {
      async createPost(input) {
        saved = input;
        return { id: '1', ...input };
      },
    },
    moderationHook: { async afterPostCreated() {} },
  });

  const res = await service.createPost({
    user: { id: 'u1' },
    content: 'Mày ngu như chó đồ rác rưởi',
    forcePost: true,
  });

  assert.equal(res.id, '1');
  assert.ok(['Toxic', 'Hate Speech'].includes(saved.aiLabel));
});

test('editPost returns nudge when editing content to negative without forcePost', async () => {
  const service = createPostService({
    postRepository: {
      async findByIdForOwnerAction() {
        return { id: '1', author_id: 'u1', ai_status: 'approved', ai_label: 'Normal' };
      },
      async updatePost() {
        throw new Error('Should not reach updatePost without forcePost');
      },
    },
    moderationHook: { async afterPostEdited() {} },
  });

  const res = await service.editPost({
    user: { id: 'u1' },
    postId: '1',
    content: 'Mày ngu như chó đồ rác rưởi',
    forcePost: false,
  });

  assert.equal(res.nudge, true);
  assert.ok(['toxic', 'hate_speech'].includes(res.warningType));
  assert.match(res.message, /chỉnh sửa/);
});

test('editPost clears toxic and restores Normal when edited with clean content', async () => {
  let updatedInput = null;
  const service = createPostService({
    postRepository: {
      async findByIdForOwnerAction() {
        return { id: '1', author_id: 'u1', ai_status: 'approved', ai_label: 'Toxic' };
      },
      async updatePost(input) {
        updatedInput = input;
        return { id: '1', ...input };
      },
    },
    moderationHook: { async afterPostEdited() {} },
  });

  const res = await service.editPost({
    user: { id: 'u1' },
    postId: '1',
    content: 'Chúc mọi người một ngày làm việc thật vui vẻ và bình an!',
    forcePost: false,
  });

  assert.equal(res.id, '1');
  assert.equal(updatedInput.aiLabel, 'Normal');
  assert.equal(updatedInput.aiStatus, 'approved');
});

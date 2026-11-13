import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';
import { createPostsController, mapPostToResponse } from '../src/controllers/postsController.js';

test('mapPostToResponse correctly maps isSaved boolean', () => {
  const post1 = { id: 10, content: 'Hello', is_saved: true };
  const mapped1 = mapPostToResponse(post1);
  assert.equal(mapped1.isSaved, true);

  const post2 = { id: 11, content: 'World', isSaved: false };
  const mapped2 = mapPostToResponse(post2);
  assert.equal(mapped2.isSaved, false);

  const post3 = { id: 12, content: 'Test' };
  const mapped3 = mapPostToResponse(post3);
  assert.equal(mapped3.isSaved, false);
});

test('toggleSavePost throws 401 when user is not authenticated', async () => {
  const repo = createPostRepository({ pool: {} });
  await assert.rejects(
    () => repo.toggleSavePost({ userId: null, postId: '123' }),
    (err) => {
      assert.equal(err.statusCode, 401);
      assert.match(err.message, /đăng nhập/);
      return true;
    }
  );
});

test('toggleSavePost inserts when not present, and deletes when present', async () => {
  const savedDb = new Map();
  const mockPool = {
    async query(sql, params) {
      if (sql.includes('CREATE TABLE')) {
        return { rows: [] };
      }
      if (sql.includes('SELECT id FROM saved_posts')) {
        const [userId, postId] = params;
        const key = `${userId}:${postId}`;
        return savedDb.has(key) ? { rows: [{ id: 1 }] } : { rows: [] };
      }
      if (sql.includes('INSERT INTO saved_posts')) {
        const [userId, postId] = params;
        const key = `${userId}:${postId}`;
        savedDb.set(key, true);
        return { rows: [] };
      }
      if (sql.includes('DELETE FROM saved_posts')) {
        const [userId, postId] = params;
        const key = `${userId}:${postId}`;
        savedDb.delete(key);
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const repo = createPostRepository({ pool: mockPool });
  const userId = 'u-test-123';
  const postId = '456';

  // Lần 1: Lưu bài viết
  const saveRes = await repo.toggleSavePost({ userId, postId });
  assert.equal(saveRes.isSaved, true);
  assert.equal(saveRes.postId, '456');

  // Lần 2: Bỏ lưu bài viết
  const unsaveRes = await repo.toggleSavePost({ userId, postId });
  assert.equal(unsaveRes.isSaved, false);
  assert.equal(unsaveRes.postId, '456');
});

test('postsController toggleSavePost and getSavedPosts', async () => {
  let toggled = false;
  const mockRepo = {
    async toggleSavePost({ userId, postId }) {
      toggled = !toggled;
      return { isSaved: toggled, postId };
    },
    async getSavedPosts({ userId }) {
      return [
        {
          id: 101,
          content: 'Saved post',
          author_id: 'a1',
          full_name: 'Author One',
          is_saved: true,
        },
      ];
    },
  };

  const controller = createPostsController({
    postService: {},
    postRepository: mockRepo,
    imageModerationService: {},
  });

  // Test toggle controller
  let resStatus = 0;
  let resJson = null;
  const res = {
    status(code) {
      resStatus = code;
      return this;
    },
    json(data) {
      resJson = data;
      return this;
    },
  };

  await controller.toggleSavePost(
    { params: { postId: '101' }, user: { id: 'u1' } },
    res,
    () => {}
  );
  assert.equal(resStatus, 200);
  assert.equal(resJson.success, true);
  assert.equal(resJson.isSaved, true);

  // Test getSavedPosts controller
  await controller.getSavedPosts(
    { user: { id: 'u1' } },
    res,
    () => {}
  );
  assert.equal(resStatus, 200);
  assert.equal(resJson.success, true);
  assert.equal(resJson.data.length, 1);
  assert.equal(resJson.data[0].id, '101');
  assert.equal(resJson.data[0].isSaved, true);
});

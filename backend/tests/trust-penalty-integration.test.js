import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostService } from '../src/services/postService.js';

test('createPost: applies trust penalty when publishing a toxic post with forcePost', async () => {
  const penaltyQueries = [];
  const mockPool = {
    async query(sql, params) {
      penaltyQueries.push({ sql, params });
      if (/UPDATE users[\s\S]*trust_score = GREATEST/i.test(sql)) {
        return { rows: [{ id: 'user-1', trust_score: 95, status: 'active' }] };
      }
      return { rows: [] };
    },
  };

  const service = createPostService({
    postRepository: {
      pool: mockPool,
      async createPost(input) {
        return { id: 101, ...input };
      },
    },
    moderationHook: {
      async afterPostCreated() {},
    },
  });

  // Post containing toxic content with forcePost: true
  const post = await service.createPost({
    user: { id: 'user-1' },
    content: 'Đồ chó ngu ngốc',
    forcePost: true,
  });

  assert.equal(post.id, 101);
  // Verify trust penalty query was executed
  const penaltyUpdate = penaltyQueries.find(q => /UPDATE users[\s\S]*trust_score = GREATEST/i.test(q.sql));
  assert.ok(penaltyUpdate, 'applyTrustPenalty query should be executed');
  assert.ok(penaltyUpdate.params[0] > 0, 'Deduction should be greater than 0');
  assert.equal(penaltyUpdate.params[1], 'user-1');
});

test('createPost: applies violence trust penalty (-35) and puts user on cooldown', async () => {
  const penaltyQueries = [];
  const mockPool = {
    async query(sql, params) {
      penaltyQueries.push({ sql, params });
      if (/UPDATE users[\s\S]*trust_score = GREATEST/i.test(sql)) {
        return { rows: [{ id: 'user-1', trust_score: 65, status: 'cooldown' }] };
      }
      return { rows: [] };
    },
  };

  const service = createPostService({
    postRepository: {
      pool: mockPool,
      async createPost(input) {
        return { id: 102, ...input };
      },
    },
    moderationHook: {
      async afterPostCreated() {},
    },
  });

  // Post containing violent threat with forcePost: true
  await assert.rejects(
    async () => {
      await service.createPost({
        user: { id: 'user-1' },
        content: 'Tao sẽ giết mày và đánh đập mày',
        forcePost: true,
      });
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /bạo lực/i);
      return true;
    }
  );

  const penaltyUpdate = penaltyQueries.find(q => /UPDATE users[\s\S]*trust_score = GREATEST/i.test(q.sql));
  assert.ok(penaltyUpdate, 'applyTrustPenalty query should be executed for violence');
  assert.equal(penaltyUpdate.params[0], 35); // 35 points deducted for Violence
  assert.equal(penaltyUpdate.params[1], 'user-1');
});

test('editPost: applies trust penalty when editing to a violating post with forcePost', async () => {
  const penaltyQueries = [];
  const mockPool = {
    async query(sql, params) {
      penaltyQueries.push({ sql, params });
      if (/UPDATE users[\s\S]*trust_score = GREATEST/i.test(sql)) {
        return { rows: [{ id: 'user-1', trust_score: 80, status: 'active' }] };
      }
      return { rows: [] };
    },
  };

  const service = createPostService({
    postRepository: {
      pool: mockPool,
      async findById(id) {
        return { id, author_id: 'user-1', content: 'Safe content' };
      },
      async updatePost(input) {
        return { ...input, id: input.postId };
      },
    },
    moderationHook: {
      async afterPostEdited() {},
    },
  });

  const updated = await service.editPost({
    user: { id: 'user-1' },
    postId: 200,
    content: 'Đồ chó khốn nạn',
    forcePost: true,
  });

  assert.equal(updated.id, 200);
  const penaltyUpdate = penaltyQueries.find(q => /UPDATE users[\s\S]*trust_score = GREATEST/i.test(q.sql));
  assert.ok(penaltyUpdate, 'applyTrustPenalty should be called on violating edit');
  assert.ok([5, 20].includes(penaltyUpdate.params[0]), 'Should deduct 5 (Toxic) or 20 (Hate Speech)');
  assert.equal(penaltyUpdate.params[1], 'user-1');
});

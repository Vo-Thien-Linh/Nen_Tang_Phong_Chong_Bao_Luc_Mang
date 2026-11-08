import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVideoFrames, moderateStoryMedia } from '../src/services/storyModerationService.js';
import { createStoryService } from '../src/services/storyService.js';

test('extractVideoFrames: correctly generates snapshot frame URLs from Cloudinary video URL', () => {
  const videoUrl = 'https://res.cloudinary.com/demo/video/upload/v1612345678/stories/my_video.mp4';
  const frames = extractVideoFrames(videoUrl);

  assert.equal(frames.length, 3);
  assert.ok(frames[0].includes('so_1,w_720,c_limit,f_jpg'));
  assert.ok(frames[1].includes('so_5,w_720,c_limit,f_jpg'));
  assert.ok(frames[2].includes('so_auto,w_720,c_limit,f_jpg'));
});

test('moderateStoryMedia: correctly aggregates violence and nsfw scores across video frames', async () => {
  const videoUrl = 'https://res.cloudinary.com/demo/video/upload/v123/violent_clip.mp4';
  
  // Giả lập frame 1 an toàn, frame 2 bạo lực
  const mockImageClient = async (url) => {
    if (url.includes('so_5')) {
      return {
        decision: 'rejected_hold',
        label: 'violence',
        scores: { safe: 0.1, nsfw: 0.05, violence: 0.88 },
      };
    }
    return {
      decision: 'safe',
      label: 'safe',
      scores: { safe: 0.95, nsfw: 0.02, violence: 0.03 },
    };
  };

  const result = await moderateStoryMedia({
    mediaUrl: videoUrl,
    storyType: 'video',
    imageModerationClient: mockImageClient,
  });

  assert.equal(result.decision, 'rejected_hold');
  assert.equal(result.label, 'violence');
  assert.equal(result.scores.violence, 0.88);
});

test('createStory: rejects unauthenticated user', async () => {
  const service = createStoryService({
    storyRepository: {},
  });

  await assert.rejects(
    () => service.createStory({ user: null, storyType: 'text', textContent: 'Hello' }),
    (err) => {
      assert.equal(err.statusCode, 401);
      assert.match(err.message, /đăng nhập/i);
      return true;
    }
  );
});

test('createStory: rejects banned user or user currently in cooldown', async () => {
  const service = createStoryService({
    storyRepository: {},
  });

  await assert.rejects(
    () => service.createStory({
      user: { id: 'u1', status: 'banned' },
      storyType: 'text',
      textContent: 'Chào mọi người',
    }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /hạn chế/i);
      return true;
    }
  );

  const futureCooldown = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await assert.rejects(
    () => service.createStory({
      user: { id: 'u2', status: 'cooldown', cooldown_until: futureCooldown },
      storyType: 'text',
      textContent: 'Chào mọi người',
    }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /hạn chế/i);
      return true;
    }
  );
});

test('createStory: validates required inputs according to storyType', async () => {
  const service = createStoryService({
    storyRepository: {},
  });

  // Loại tin không hợp lệ
  await assert.rejects(
    () => service.createStory({
      user: { id: 'u1' },
      storyType: 'unknown',
    }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /Loại tin không hợp lệ/i);
      return true;
    }
  );

  // Tin text thiếu nội dung
  await assert.rejects(
    () => service.createStory({
      user: { id: 'u1' },
      storyType: 'text',
      textContent: '   ',
    }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /Nội dung văn bản là bắt buộc/i);
      return true;
    }
  );

  // Tin video thiếu mediaUrl
  await assert.rejects(
    () => service.createStory({
      user: { id: 'u1' },
      storyType: 'video',
      mediaUrl: '',
    }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /tải lên tệp video/i);
      return true;
    }
  );
});

test('createStory: triggers Friendly Nudge when text is toxic/violent and forcePost is false', async () => {
  const service = createStoryService({
    storyRepository: {},
  });

  const nudgeResult = await service.createStory({
    user: { id: 'u1' },
    storyType: 'text',
    textContent: 'Mày là đồ ngu xuẩn rác rưởi',
    forcePost: false,
  });

  assert.equal(nudgeResult.nudge, true);
  assert.equal(nudgeResult.warningType, 'toxic');
  assert.ok(nudgeResult.message.includes('xem lại'));
});

test('createStory: triggers Violence Cooldown 10 mins when violent story is forced', async () => {
  const usersUpdated = [];
  const notificationsCreated = [];
  let savedStory = null;

  const mockPool = {
    async query(sql, params) {
      if (sql.includes('UPDATE users')) {
        usersUpdated.push({ sql, params });
        return { rowCount: 1, rows: [{ id: 'u-violent', trust_score: 65, status: 'cooldown' }] };
      }
      if (sql.includes('INSERT INTO notifications')) {
        notificationsCreated.push({ sql, params });
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('user_trust_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    },
  };

  const mockRepo = {
    pool: mockPool,
    async createStory(input) {
      savedStory = { id: 99, ...input };
      return savedStory;
    },
  };

  const service = createStoryService({
    storyRepository: mockRepo,
  });

  await assert.rejects(
    () => service.createStory({
      user: { id: 'u-violent' },
      storyType: 'text',
      textContent: 'Tao sẽ chém giết hết cả nhà mày',
      forcePost: true,
    }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.ok(err.cooldown);
      assert.equal(err.cooldown.status, 'cooldown');
      assert.equal(savedStory.aiStatus, 'hidden');
      assert.ok(usersUpdated.length >= 1);
      return true;
    }
  );
});

test('createStory: marks toxic story as sensitive and notifies author when forced', async () => {
  const notificationsCreated = [];
  let savedInput = null;

  const mockPool = {
    async query(sql, params) {
      if (sql.includes('INSERT INTO notifications')) {
        notificationsCreated.push({ sql, params });
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('user_trust_logs') || sql.includes('UPDATE users')) {
        return { rowCount: 1, rows: [{ id: 'u-toxic', trust_score: 95 }] };
      }
      return { rows: [] };
    },
  };

  const mockRepo = {
    pool: mockPool,
    async createStory(input) {
      savedInput = input;
      return {
        id: 'story-toxic-1',
        ...input,
        ai_status: input.aiStatus || 'approved',
        ai_label: input.aiLabel || 'Normal',
      };
    },
  };

  const service = createStoryService({
    storyRepository: mockRepo,
  });

  const res = await service.createStory({
    user: { id: 'u-toxic' },
    storyType: 'text',
    textContent: 'thằng thần kinh này',
    forcePost: true,
  });

  assert.equal(res.id, 'story-toxic-1');
  assert.equal(savedInput.aiStatus, 'sensitive');
  assert.equal(savedInput.aiLabel, 'Toxic');
  assert.ok(notificationsCreated.length >= 1);
  assert.ok(notificationsCreated.some((n) => /gắn nhãn nhạy cảm/i.test(n.params[2])));
});

test('createStory: successfully creates normal text, image, and video stories', async () => {
  const createdStories = [];
  const mockRepo = {
    pool: null,
    async createStory(input) {
      const story = {
        id: String(createdStories.length + 1),
        ...input,
        views_count: 0,
        reactions_count: 0,
      };
      createdStories.push(story);
      return story;
    },
  };

  const service = createStoryService({
    storyRepository: mockRepo,
    imageModerationClient: async () => ({ decision: 'safe', label: 'safe', scores: { safe: 0.99, violence: 0, nsfw: 0 } }),
  });

  // 1. Tạo Text Story
  const textStory = await service.createStory({
    user: { id: 'u1' },
    storyType: 'text',
    textContent: 'Hôm nay trời đẹp quá!',
    backgroundStyle: { background: 'linear-gradient(to right, #4facfe, #00f2fe)' },
  });
  assert.equal(textStory.storyType, 'text');
  assert.equal(textStory.textContent, 'Hôm nay trời đẹp quá!');

  // 2. Tạo Image Story
  const imageStory = await service.createStory({
    user: { id: 'u1' },
    storyType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-123.jpg',
  });
  assert.equal(imageStory.storyType, 'image');

  // 3. Tạo Video Story
  const videoStory = await service.createStory({
    user: { id: 'u1' },
    storyType: 'video',
    mediaUrl: 'https://res.cloudinary.com/demo/video/upload/v1/fun.mp4',
  });
  assert.equal(videoStory.storyType, 'video');
  assert.equal(videoStory.mediaUrl, 'https://res.cloudinary.com/demo/video/upload/v1/fun.mp4');
});

test('viewStory: records viewer and getStoryViewers restricts access to story author', async () => {
  const viewers = [
    { viewer_id: 'viewer-1', username: 'v1', full_name: 'Viewer 1' },
  ];

  const mockRepo = {
    async markStoryAsViewed({ storyId, viewerId }) {
      return true;
    },
    async getStoryViewers({ storyId, authorId }) {
      if (authorId !== 'author-1') {
        const error = new Error('Bạn không có quyền');
        error.statusCode = 403;
        throw error;
      }
      return viewers;
    },
  };

  const service = createStoryService({ storyRepository: mockRepo });

  // Đánh dấu đã xem
  const viewRes = await service.viewStory({ user: { id: 'viewer-1' }, storyId: 10 });
  assert.equal(viewRes.success, true);
  assert.equal(viewRes.recorded, true);

  // Tác giả xem danh sách người xem -> Thành công
  const authorView = await service.getStoryViewers({ user: { id: 'author-1' }, storyId: 10 });
  assert.equal(authorView.length, 1);
  assert.equal(authorView[0].username, 'v1');

  // Người lạ xem danh sách người xem -> 403
  await assert.rejects(
    () => service.getStoryViewers({ user: { id: 'stranger-2' }, storyId: 10 }),
    (err) => {
      assert.equal(err.statusCode, 403);
      return true;
    }
  );
});

test('reactToStory: adds reaction and validates reaction type', async () => {
  const mockRepo = {
    pool: null,
    async getStoryById(id, userId) {
      return { id, author_id: 'author-1' };
    },
    async reactToStory({ storyId, userId, reactionType }) {
      if (!['like', 'love', 'haha', 'wow', 'sad', 'angry'].includes(reactionType)) {
        throw new Error('Invalid reaction');
      }
      return { reactionType, reactionsCount: 1 };
    },
  };

  const service = createStoryService({ storyRepository: mockRepo });

  const res = await service.reactToStory({
    user: { id: 'user-2' },
    storyId: 10,
    reactionType: 'love',
  });
  assert.equal(res.reactionType, 'love');
  assert.equal(res.reactionsCount, 1);
});

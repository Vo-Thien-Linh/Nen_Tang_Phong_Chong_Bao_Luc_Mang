import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import { createStoryRepository } from '../src/repositories/storyRepository.js';
import { createStoryService } from '../src/services/storyService.js';

test('Integration Test: Full lifecycle of Stories (Create, Moderation, Feed 24h, View, Reaction, Delete)', async () => {
  const storyRepository = createStoryRepository({ pool });
  const storyService = createStoryService({
    storyRepository,
    imageModerationClient: async () => ({
      decision: 'safe',
      label: 'safe',
      scores: { safe: 0.99, violence: 0.01, nsfw: 0.01 },
    }),
  });

  // 1. Lấy 2 người dùng mẫu có sẵn trong DB để thực hiện test
  const usersRes = await pool.query('SELECT id, full_name, username, status FROM users LIMIT 2');
  assert.ok(usersRes.rows.length >= 2, 'Cần ít nhất 2 user mẫu trong database để chạy integration test');

  const author = usersRes.rows[0];
  const viewer = usersRes.rows[1];

  let createdStoryId = null;

  try {
    // 2. Tạo tin văn bản (Text Story)
    const textStory = await storyService.createStory({
      user: author,
      storyType: 'text',
      textContent: 'Tin chào buổi sáng từ Integration Test!',
      backgroundStyle: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
      privacy: 'public',
    });

    assert.ok(textStory.id);
    createdStoryId = textStory.id;
    assert.equal(textStory.story_type, 'text');
    assert.equal(textStory.ai_status, 'approved');

    // Kiểm tra thời hạn: expires_at phải cách created_at xấp xỉ 24 giờ
    const createdTime = new Date(textStory.created_at).getTime();
    const expiresTime = new Date(textStory.expires_at).getTime();
    const diffHours = (expiresTime - createdTime) / (1000 * 60 * 60);
    assert.ok(Math.abs(diffHours - 24) < 0.1, 'Thời gian tồn tại của tin phải chuẩn xác 24 giờ');

    // 3. Tạo tin Video ngắn (Video Story)
    const videoStory = await storyService.createStory({
      user: author,
      storyType: 'video',
      mediaUrl: 'https://res.cloudinary.com/demo/video/upload/v1/test_story.mp4',
      privacy: 'public',
    });
    assert.equal(videoStory.story_type, 'video');

    // 4. Lấy danh sách Feed Stories cho Viewer
    const feedTrays = await storyService.listFeedStories({ user: viewer });
    assert.ok(Array.isArray(feedTrays), 'Feed stories phải trả về danh sách mảng');

    const authorTray = feedTrays.find((t) => t.author.id === author.id);
    assert.ok(authorTray, 'Tác giả phải có mặt trong danh sách Story Tray');
    assert.ok(authorTray.stories.length >= 2, 'Author phải có ít nhất 2 tin');
    assert.equal(authorTray.hasUnviewedStories, true, 'Viewer chưa xem nên hasUnviewedStories phải là true');

    // 5. Viewer xem tin
    const viewRes = await storyService.viewStory({ user: viewer, storyId: createdStoryId });
    assert.equal(viewRes.success, true);

    // Xem lại lần 2 để kiểm tra tính Idempotent (không tính trùng)
    const viewAgainRes = await storyService.viewStory({ user: viewer, storyId: createdStoryId });
    assert.equal(viewAgainRes.recorded, false, 'Xem lại không được tính trùng lượt xem');

    // 6. Tác giả kiểm tra danh sách người đã xem (Viewers List)
    const viewersList = await storyService.getStoryViewers({ user: author, storyId: createdStoryId });
    assert.ok(Array.isArray(viewersList));
    const foundViewer = viewersList.find((v) => v.viewer_id === viewer.id);
    assert.ok(foundViewer, 'Viewer phải xuất hiện trong danh sách người đã xem của tác giả');

    // Người lạ không được xem danh sách viewers
    await assert.rejects(
      () => storyService.getStoryViewers({ user: viewer, storyId: createdStoryId }),
      (err) => {
        assert.equal(err.statusCode, 403);
        return true;
      }
    );

    // 7. Viewer thả cảm xúc 'love' cho tin
    const reactRes = await storyService.reactToStory({
      user: viewer,
      storyId: createdStoryId,
      reactionType: 'love',
    });
    assert.equal(reactRes.reactionType, 'love');
    assert.equal(reactRes.reactionsCount, 1);

    // 8. Tác giả xóa tin
    const deleteRes = await storyService.deleteStory({ user: author, storyId: createdStoryId });
    assert.equal(deleteRes, true);

    // Tin đã xóa không còn xuất hiện trong Feed
    const feedAfterDelete = await storyService.listFeedStories({ user: viewer });
    const authorTrayAfter = feedAfterDelete.find((t) => t.author.id === author.id);
    const storyStillExists = authorTrayAfter?.stories.some((s) => s.id === String(createdStoryId));
    assert.equal(storyStillExists, false, 'Tin đã bị xóa không được xuất hiện trên Feed');

  } finally {
    // Dọn dẹp dữ liệu test khỏi database
    if (createdStoryId) {
      await pool.query('DELETE FROM stories WHERE id = $1', [createdStoryId]);
    }
    await pool.query("DELETE FROM stories WHERE text_content = 'Tin chào buổi sáng từ Integration Test!'");
    await pool.query("DELETE FROM stories WHERE media_url = 'https://res.cloudinary.com/demo/video/upload/v1/test_story.mp4'");
  }
});

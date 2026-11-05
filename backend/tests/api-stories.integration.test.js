import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import { createStoryRepository } from '../src/repositories/storyRepository.js';
import { createStoryService } from '../src/services/storyService.js';

test('Integration Test: Full lifecycle of Stories (Create, Moderation, Feed 24h, View, Reaction, Delete)', async (t) => {
  // Kiểm tra an toàn cho môi trường CI / GitHub Actions
  if (!process.env.DATABASE_URL) {
    if (t?.skip) t.skip('Bỏ qua: Chưa cấu hình biến môi trường DATABASE_URL trong GitHub Secrets');
    return;
  }

  try {
    const healthCheck = await pool.query('SELECT NOW()');
    if (!healthCheck?.rows?.length) {
      if (t?.skip) t.skip('Bỏ qua: Không thể kết nối cơ sở dữ liệu');
      return;
    }
  } catch (err) {
    if (t?.skip) t.skip('Bỏ qua: Kết nối CSDL thất bại (' + err.message + ')');
    return;
  }

  // Tự động bảo đảm các bảng Story tồn tại trước khi chạy Integration Test
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        story_type VARCHAR(20) NOT NULL DEFAULT 'image',
        media_url TEXT,
        text_content TEXT,
        background_style JSONB,
        privacy VARCHAR(20) NOT NULL DEFAULT 'public',
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        ai_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        ai_label VARCHAR(50),
        ai_confidence FLOAT DEFAULT 0,
        media_moderation_status VARCHAR(20) DEFAULT 'unreviewed',
        media_moderation_label VARCHAR(50),
        media_moderation_safe FLOAT DEFAULT 1.0,
        media_moderation_nsfw FLOAT DEFAULT 0.0,
        media_moderation_violence FLOAT DEFAULT 0.0,
        media_moderation_thresholds JSONB,
        media_moderation_appealed_at TIMESTAMP WITH TIME ZONE,
        views_count INT NOT NULL DEFAULT 0,
        reactions_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS story_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(story_id, viewer_id)
      );
      CREATE TABLE IF NOT EXISTS story_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reaction_type VARCHAR(20) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(story_id, user_id)
      );
    `);
  } catch (migrationErr) {
    console.warn('Khởi tạo bảng stories trong test:', migrationErr.message);
  }

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
  let usersRes;
  try {
    usersRes = await pool.query('SELECT id, full_name, username, status FROM users LIMIT 2');
  } catch (err) {
    if (t?.skip) t.skip('Bỏ qua: Lỗi truy vấn bảng users (' + err.message + ')');
    return;
  }

  if (!usersRes?.rows || usersRes.rows.length < 2) {
    if (t?.skip) t.skip('Bỏ qua: Cần ít nhất 2 user mẫu trong database để chạy integration test');
    return;
  }

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


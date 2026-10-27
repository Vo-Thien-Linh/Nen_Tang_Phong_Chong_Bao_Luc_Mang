import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewImageModeration } from '../src/services/imageModerationReviewService.js';

test('final violence notification contains the content snapshot', async () => {
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.startsWith('SELECT')) return { rows: [{
        id: 44,
        author_id: 'author-1',
        content: 'A saved post before removal',
        image_url: 'https://cdn.example/image.jpg',
        created_at: '2026-10-20T12:00:00.000Z',
        image_moderation_status: 'appeal_pending',
        image_moderation_violence: 0.95,
      }] };
      if (sql.startsWith('UPDATE')) return { rows: [{ id: 44, author_id: 'author-1', image_moderation_status: 'rejected_final' }] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const result = await reviewImageModeration({
    pool: { async connect() { return client; } },
    contentType: 'post',
    contentId: 44,
    stage: 'final',
    decision: 'violence',
    reviewerId: 'moderator',
  });
  const notification = queries.find(({ sql }) => sql.includes('INSERT INTO notifications'));

  assert.equal(result.data.status, 'rejected_final');
  assert.match(notification.values[1], /bài viết của bạn vẫn vi phạm tiêu chuẩn cộng đồng nên đã bị xóa/);
  assert.deepEqual(JSON.parse(notification.values[3]), {
    type: 'moderation_removal',
    contentType: 'post',
    content: 'A saved post before removal',
    imageUrls: ['https://cdn.example/image.jpg'],
    createdAt: '2026-10-20T12:00:00.000Z',
    excerpt: 'A saved post before removal',
  });
});

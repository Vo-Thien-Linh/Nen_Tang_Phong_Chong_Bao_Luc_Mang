import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewImageModeration } from '../src/services/imageModerationReviewService.js';

test('comment final violence notification uses comment wording and snapshot', async () => {
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.startsWith('SELECT')) return { rows: [{
        id: 9,
        post_id: 44,
        author_id: 'author-1',
        content: 'A saved comment before removal',
        image_url: 'https://cdn.example/comment.jpg',
        created_at: '2026-10-21T12:00:00.000Z',
        image_moderation_status: 'appeal_pending',
        image_moderation_violence: 0.92,
        is_hidden: false,
      }] };
      if (sql.startsWith('UPDATE')) return { rows: [{ id: 9, author_id: 'author-1', image_moderation_status: 'rejected_final' }] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  await reviewImageModeration({
    pool: { async connect() { return client; } },
    contentType: 'comment',
    contentId: 9,
    stage: 'final',
    decision: 'violence',
    reviewerId: 'moderator',
  });
  const notification = queries.find(({ sql }) => sql.includes('INSERT INTO notifications'));

  assert.equal(notification.values[2], 44);
  assert.match(notification.values[1], /bình luận của bạn vẫn vi phạm tiêu chuẩn cộng đồng nên đã bị xóa/);
  assert.deepEqual(JSON.parse(notification.values[3]), {
    type: 'moderation_removal',
    contentType: 'comment',
    content: 'A saved comment before removal',
    imageUrls: ['https://cdn.example/comment.jpg'],
    createdAt: '2026-10-21T12:00:00.000Z',
    excerpt: 'A saved comment before removal',
  });
});

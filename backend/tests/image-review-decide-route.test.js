import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageModerationRouter } from '../src/routes/imageModerationRouter.js';

function makePool(contentType) {
  const item = { id: 4, author_id: 'author', content: 'image post', image_url: '/image.jpg', image_moderation_status: 'pending_review', image_moderation_safe: 0.9, image_moderation_nsfw: 0.05, image_moderation_violence: 0.05, ai_status: 'approved', is_hidden: false, ...(contentType === 'comment' ? { post_id: 12 } : {}) };
  return {
    async connect() {
      return {
        async query(sql) {
          if (sql.startsWith('SELECT')) return { rows: [item] };
          if (sql.startsWith('UPDATE')) return { rows: [{ id: item.id, author_id: item.author_id }] };
          return { rows: [] };
        },
        release() {},
      };
    },
    async query(sql) {
      if (sql.includes('FROM posts p')) return { rows: [{ ...item, image_moderation_status: 'safe', full_name: 'Author', username: 'author', is_verified: false }] };
      if (sql.includes('FROM comments c')) return { rows: [{ ...item, image_moderation_status: 'safe', full_name: 'Author', username: 'author', is_verified: false }] };
      if (sql.includes('SELECT id, ai_status FROM posts')) return { rows: [{ id: 12, ai_status: 'approved' }] };
      return { rows: [] };
    },
  };
}

test('valid safe decisions return 200 for post and comment items', async () => {
  for (const contentType of ['post', 'comment']) {
    const router = createImageModerationRouter({ pool: makePool(contentType) });
    const route = router.stack.find((layer) => layer.route?.path === '/:contentType/:id/decide').route;
    const handler = route.stack.at(-1).handle;
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({ user: { id: 'moderator' }, params: { contentType, id: '4' }, body: { stage: 'first', decision: 'safe' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200, contentType);
    assert.equal(res.body.data.status, 'safe', contentType);
    assert.equal(res.body.data.published, true, contentType);
  }
});

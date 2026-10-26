import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';

test('existing hold with an old expiry stays visible to its author', async () => {
  const legacyHeldPost = {
    id: 6,
    author_id: 'author-1',
    image_moderation_status: 'rejected_hold',
    moderation_expires_at: '2020-01-01T00:00:00.000Z',
    content: 'legacy held post',
    full_name: 'Author',
  };
  let queryText = '';
  const repository = createPostRepository({ pool: { async query(sql) {
    queryText = sql;
    return { rows: [legacyHeldPost] };
  } } });

  const posts = await repository.findVisiblePosts({ viewerId: 'author-1' });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].moderation_expires_at, legacyHeldPost.moderation_expires_at);
  assert.doesNotMatch(queryText, /moderation_expires_at\s*>/i);
});

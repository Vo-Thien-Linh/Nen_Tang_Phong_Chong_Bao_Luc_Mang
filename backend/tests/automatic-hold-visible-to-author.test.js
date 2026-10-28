import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';

test('automatic hold item stays visible to its author', async () => {
  const heldPost = {
    id: 5,
    author_id: 'author-1',
    image_moderation_status: 'rejected_hold',
    image_moderation_label: 'Violence',
    image_moderation_violence: 0.95,
    content: 'held post',
    full_name: 'Author',
    ai_status: 'approved',
  };
  const repository = createPostRepository({ pool: { async query(sql) {
    if (sql.includes('FROM posts p')) return { rows: [heldPost] };
    return { rows: [] };
  } } });

  const posts = await repository.findVisiblePosts({ viewerId: 'author-1' });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].image_moderation_status, 'rejected_hold');
});

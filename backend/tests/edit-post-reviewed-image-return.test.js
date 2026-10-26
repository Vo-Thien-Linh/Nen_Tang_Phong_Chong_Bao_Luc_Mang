import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRepository } from '../src/repositories/postRepository.js';

test('edited image held for review is returned to its author', async () => {
  const post = { id: 1, author_id: 'u1', content: 'updated', image_url: 'image.jpg', image_moderation_status: 'rejected_hold' };
  const queries = [];
  const repository = createPostRepository({
    pool: {
      async query(sql, values) {
        queries.push({ sql, values });
        if (sql.startsWith('UPDATE posts')) return { rows: [{ id: 1 }] };
        if (sql.includes('FROM posts p')) return { rows: values?.[1] === 'u1' ? [post] : [] };
        return { rows: [] };
      },
    },
  });

  const result = await repository.updatePost({
    postId: '1',
    authorId: 'u1',
    content: 'updated',
    imageUrl: 'image.jpg',
    imageModeration: {
      decision: 'rejected_hold',
      images: [{ scores: { safe: 0.1, nsfw: 0, violence: 0.9 } }],
    },
  });

  assert.equal(result.image_moderation_status, 'rejected_hold');
  const postRead = queries.find(({ sql }) => sql.includes('FROM posts p'));
  assert.equal(postRead.values[1], 'u1');
});

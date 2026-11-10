import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostsController } from '../src/controllers/postsController.js';
import { realtimeService } from '../src/services/realtimeService.js';

function client() {
  const events = [];
  return { events, write(chunk) { events.push(JSON.parse(chunk.slice(6, -2))); } };
}

test('privacy change emits removal to viewers who lose access', async () => {
  const author = client();
  const friend = client();
  const stranger = client();
  realtimeService.addClient(author, 'author');
  realtimeService.addClient(friend, 'friend');
  realtimeService.addClient(stranger, 'stranger');
  try {
    const controller = createPostsController({
      postRepository: {
        async findByIdForOwnerAction() { return { id: 4, author_id: 'author', privacy: 'friends' }; },
        async findAcceptedFriendIds() { return ['friend']; },
      },
      postService: {
        async editPost() {
          return { id: 4, author_id: 'author', privacy: 'only_me', content: 'updated', ai_status: 'approved' };
        },
      },
    });
    const response = { json(body) { this.body = body; } };

    await controller.editPost({
      params: { postId: '4' }, user: { id: 'author' }, body: { content: 'updated', privacy: 'only_me' },
    }, response, (error) => { throw error; });

    assert.ok(author.events.some((event) => event.type === 'POST_DELETED'));
    assert.ok(author.events.some((event) => event.type === 'POST_CREATED'));
    assert.ok(friend.events.some((event) => event.type === 'POST_DELETED'));
    assert.equal(friend.events.some((event) => event.type === 'POST_CREATED'), false);
    assert.equal(stranger.events.length, 0);
  } finally {
    realtimeService.removeClient(author);
    realtimeService.removeClient(friend);
    realtimeService.removeClient(stranger);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { prependCreatedPost } from '../src/utils/creationFlowLogic.js';
import { getProfilePosts } from '../src/utils/profilePostLogic.js';

test('created post appears in feed and profile lists', () => {
  const created = { id: 'new', author: { id: 'author' }, imageModeration: { status: 'pending_review' } };
  const feed = prependCreatedPost([{ id: 'older' }], created);
  const profile = getProfilePosts({ isOwnProfile: true, posts: feed, targetUserId: 'author' });
  assert.equal(feed[0], created);
  assert.deepEqual(profile, [created]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getProfilePosts } from '../src/utils/profilePostLogic.js';

test('own profile uses shared feed posts so removals appear without reload', () => {
  const shared = [{ id: '1', author_id: 'author-1' }];
  const localFetched = [{ id: '1', author_id: 'author-1' }, { id: '2', author_id: 'author-1' }];

  assert.deepEqual(getProfilePosts({ isOwnProfile: true, posts: shared, profilePosts: localFetched, targetUserId: 'author-1' }), shared);
  assert.deepEqual(getProfilePosts({ isOwnProfile: false, posts: shared, profilePosts: localFetched, targetUserId: 'author-1' }), localFetched);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeViewSource = readFileSync(new URL('../src/components/HomeView.jsx', import.meta.url), 'utf8');
const groupPostCardSource = readFileSync(new URL('../src/components/GroupPostCard.jsx', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../src/api/client.js', import.meta.url), 'utf8');
const groupsRouterSource = readFileSync(new URL('../../services/post-service/src/routes/communityGroupsRouter.js', import.meta.url), 'utf8');

test('home feed loads and labels approved posts from groups the viewer belongs to', () => {
  assert.match(clientSource, /export async function fetchCommunityGroupFeed/);
  assert.match(groupsRouterSource, /router\.get\('\/feed', optionalAuth/);
  assert.match(homeViewSource, /fetchCommunityGroupFeed\(/);
  assert.match(homeViewSource, /import GroupPostCard from '.\/GroupPostCard'/);
  assert.match(homeViewSource, /<GroupPostCard[\s\S]*?showGroup/);
  assert.match(groupPostCardSource, /Đã đăng trong nhóm/);
  assert.match(homeViewSource, /post\.isGroupPost/);
});

test('search can find public group posts without adding them to the regular guest feed', () => {
  assert.match(clientSource, /fetchCommunityGroupFeed\(\{ search = '' \} = \{\}\)/);
  assert.match(clientSource, /fetchCommunityGroups\(\)/);
  assert.match(clientSource, /fetchCommunityGroupPosts\(group\.id\)/);
  assert.match(clientSource, /post\.status === 'approved'/);
  assert.match(clientSource, /group\.membershipStatus === 'active' \|\| \(normalizedSearch && group\.privacy === 'public'\)/);
  assert.doesNotMatch(clientSource, /request\(`\/api\/groups\/feed/);
  assert.match(groupsRouterSource, /service\.listHomePosts\(\{ user: req\.user, search: req\.query\.search \}\)/);
  assert.match(homeViewSource, /if \(!currentUser\?\.id && !search\)/);
  assert.match(homeViewSource, /fetchCommunityGroupFeed\(\{ search \}\)/);
  assert.match(homeViewSource, /setGroupFeedError\(error\.message/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const groupPostCardSource = readFileSync(new URL('../src/components/GroupPostCard.jsx', import.meta.url), 'utf8');
const groupReactionsModalSource = readFileSync(new URL('../src/components/PostReactionsModal.jsx', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../src/api/client.js', import.meta.url), 'utf8');
const groupsRouterSource = readFileSync(new URL('../../services/post-service/src/routes/communityGroupsRouter.js', import.meta.url), 'utf8');

test('group posts expose the same hover and press reaction picker and show real reactors', () => {
  assert.ok(/onMouseEnter=\{handleOpenReactionPicker\}/.test(groupPostCardSource));
  assert.ok(/onPointerDown=\{handleReactionPointerDown\}/.test(groupPostCardSource));
  assert.doesNotMatch(groupPostCardSource, /aria-label="Chọn biểu tượng cảm xúc"/);
  assert.doesNotMatch(groupPostCardSource, /onClick=\{\(\) => setReactionPickerOpen\(\(open\) => !open\)\}/);
  assert.ok(/data-reaction-id=\{item\.id\}/.test(groupPostCardSource));
  assert.ok(/PostReactionsModal/.test(groupPostCardSource));
  assert.ok(/aria-label="Xem ai đã bày tỏ cảm xúc"/.test(groupPostCardSource));
  assert.ok(/fetchCommunityGroupPostReactions/.test(groupReactionsModalSource));
  assert.ok(/groupId/.test(groupReactionsModalSource));
});

test('group reactors are fetched from the group-scoped approved-post endpoint', () => {
  assert.ok(/export async function fetchCommunityGroupPostReactions/.test(clientSource));
  assert.ok(/\/reactions/.test(clientSource));
  assert.ok(/router\.get\('\/:groupId\/posts\/:postId\/reactions', optionalAuth/.test(groupsRouterSource));
});

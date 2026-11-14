import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveFriendshipStatus } from '../src/utils/friendshipStatus.js';
import { createReactionRepository } from '../src/repositories/reactionRepository.js';
import { createCommunityGroupsRepository } from '../src/repositories/communityGroupsRepository.js';

const relationCases = [
  ['self', { viewerId: 'viewer', reactorId: 'viewer' }],
  ['friends', { viewerId: 'viewer', reactorId: 'friend', status: 'accepted', requesterId: 'friend', addresseeId: 'viewer' }],
  ['pending_sent', { viewerId: 'viewer', reactorId: 'target', status: 'pending', requesterId: 'viewer', addresseeId: 'target' }],
  ['pending_received', { viewerId: 'viewer', reactorId: 'sender', status: 'pending', requesterId: 'sender', addresseeId: 'viewer' }],
  ['blocked', { viewerId: 'viewer', reactorId: 'blocked', status: 'blocked', requesterId: 'viewer', addresseeId: 'blocked' }],
  ['none', { viewerId: 'viewer', reactorId: 'stranger' }],
];

for (const [expected, input] of relationCases) {
  test(`reaction friendship status maps ${expected}`, () => {
    assert.equal(deriveFriendshipStatus(input), expected);
  });
}

test('reaction list joins friendship rows without per-row queries', async () => {
  const queries = [];
  const repository = createReactionRepository({
    pool: {
      async query(sql, params) {
        queries.push({ sql, params });
        if (queries.length === 1) return { rows: [{ id: 7 }] };
        return {
          rows: [{
            id: 'friend',
            name: 'Friend',
            avatar: '/friend.png',
            username: 'friend',
            reaction_type: 'like',
            created_at: '2026-11-14T00:00:00.000Z',
            friendship_status: 'accepted',
            friendship_requester_id: 'friend',
            friendship_addressee_id: 'viewer',
          }],
        };
      },
    },
  });

  const result = await repository.getPostReactions({ postId: '7', viewerId: 'viewer' });

  assert.equal(result[0].friendshipStatus, 'friends');
  assert.equal(queries.length, 2);
  assert.match(queries[1].sql, /LEFT JOIN friendships f/i);
  assert.match(queries[1].sql, /f\.requester_id = \$2/i);
  assert.match(queries[1].sql, /f\.addressee_id = u\.id/i);
  assert.deepEqual(queries[1].params, [7, 'viewer']);
});

test('friendship join uses the existing schema columns', () => {
  const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS friendships/i);
  assert.match(schema, /requester_id UUID NOT NULL/i);
  assert.match(schema, /addressee_id UUID NOT NULL/i);
  assert.match(schema, /status VARCHAR\(20\)/i);
  assert.match(schema, /CHECK \(status IN \('pending', 'accepted', 'declined', 'blocked'\)\)/i);
});

test('group reaction status does not expose friendship join columns', async () => {
  const repository = createCommunityGroupsRepository({
    pool: {
      async query() {
        return {
          rows: [{
            userId: 'friend',
            name: 'Friend',
            username: 'friend',
            avatar: '/friend.png',
            reactionType: 'like',
            createdAt: '2026-11-14T00:00:00.000Z',
            friendshipStatus: 'accepted',
            friendshipRequesterId: 'friend',
            friendshipAddresseeId: 'viewer',
          }],
        };
      },
    },
  });

  const [row] = await repository.listPostReactions({ groupId: '1', postId: '2', viewerId: 'viewer' });
  assert.equal(row.friendshipStatus, 'friends');
  assert.equal('friendshipRequesterId' in row, false);
  assert.equal('friendshipAddresseeId' in row, false);
});

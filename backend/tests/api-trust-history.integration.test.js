import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createUsersRouter } from '../src/routes/usersRouter.js';

test('API Integration: GET /api/users/:userId/trust-history security and responses', async () => {
  const user1Id = '11111111-1111-4111-a111-111111111111';
  const user2Id = '22222222-2222-4222-a222-222222222222';
  const adminId = '99999999-9999-4999-a999-999999999999';

  const mockUsers = {
    [user1Id]: { id: user1Id, username: 'user1', full_name: 'User 1', role: 'user', status: 'active', trust_score: 95 },
    [user2Id]: { id: user2Id, username: 'user2', full_name: 'User 2', role: 'user', status: 'active', trust_score: 100 },
    [adminId]: { id: adminId, username: 'admin1', full_name: 'Admin', role: 'admin', status: 'active', trust_score: 100 },
  };

  const mockLogs = [
    { id: 1, user_id: user1Id, change_amount: -5, new_score: 95, reason: 'Vi phạm Toxic', action_type: 'post_violation' },
  ];

  const mockPool = {
    async query(sql, params) {
      if (/FROM users\s+WHERE id =/i.test(sql)) {
        const u = mockUsers[params[0]];
        return { rows: u ? [u] : [] };
      }
      if (/FROM user_trust_logs/i.test(sql)) {
        return { rows: mockLogs };
      }
      return { rows: [] };
    },
  };

  const app = express();
  app.use(express.json());

  const router = createUsersRouter({ pool: mockPool });
  app.use('/api/users', router);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/users`;

  try {
    // 1. Chưa đăng nhập (không có x-user-id header) -> 401 Unauthorized
    const resNoAuth = await fetch(`${baseUrl}/${user1Id}/trust-history`);
    assert.equal(resNoAuth.status, 401);

    // 2. User 2 cố tình xem lịch sử điểm của User 1 -> 403 Forbidden
    const resForbidden = await fetch(`${baseUrl}/${user1Id}/trust-history`, {
      headers: {
        'x-user-id': user2Id,
      },
    });
    assert.equal(resForbidden.status, 403);
    const forbiddenBody = await resForbidden.json();
    assert.equal(forbiddenBody.success, false);
    assert.match(forbiddenBody.message, /không có quyền/i);

    // 3. Chính chủ User 1 xem lịch sử của mình -> 200 OK
    const resOwner = await fetch(`${baseUrl}/${user1Id}/trust-history`, {
      headers: {
        'x-user-id': user1Id,
      },
    });
    assert.equal(resOwner.status, 200);
    const ownerBody = await resOwner.json();
    assert.equal(ownerBody.success, true);
    assert.equal(ownerBody.data.length, 1);
    assert.equal(ownerBody.data[0].change_amount, -5);

    // 4. Admin xem lịch sử của User 1 -> 200 OK (Admin có quyền xem)
    const resAdmin = await fetch(`${baseUrl}/${user1Id}/trust-history`, {
      headers: {
        'x-user-id': adminId,
      },
    });
    assert.equal(resAdmin.status, 200);
    const adminBody = await resAdmin.json();
    assert.equal(adminBody.success, true);
    assert.equal(adminBody.data[0].new_score, 95);

  } finally {
    server.close();
  }
});

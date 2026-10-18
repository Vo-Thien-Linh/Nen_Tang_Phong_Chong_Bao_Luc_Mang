import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserRepository } from '../src/repositories/userRepository.js';

test('updateVerification: updates is_verified status for target user', async () => {
  let executedQuery = '';
  let queryParams = [];

  const mockPool = {
    async query(sql, params) {
      executedQuery = sql;
      queryParams = params;
      return {
        rows: [{
          id: params[1],
          username: 'wings_user',
          full_name: 'Wings User',
          is_verified: params[0],
        }],
      };
    },
  };

  const userRepo = createUserRepository({ pool: mockPool });
  userRepo.findById = async (id) => ({ id, username: 'wings_user', is_verified: false });

  const result = await userRepo.updateVerification({
    targetUserId: 'user-123',
    isVerified: true,
  });

  assert.equal(result.is_verified, true);
  assert.equal(queryParams[0], true);
  assert.equal(queryParams[1], 'user-123');
  assert.match(executedQuery, /UPDATE users/i);
  assert.match(executedQuery, /is_verified = \$1/i);
});

test('updateVerification: throws 404 when user not found', async () => {
  const mockPool = {
    async query() {
      return { rows: [] };
    },
  };

  const userRepo = createUserRepository({ pool: mockPool });
  userRepo.findById = async () => null;

  await assert.rejects(
    async () => {
      await userRepo.updateVerification({
        targetUserId: 'missing-user',
        isVerified: true,
      });
    },
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.match(err.message, /Không tìm thấy người dùng/i);
      return true;
    }
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserRepository } from '../src/repositories/userRepository.js';

test('updateSanctionStatus: temporary ban sets status, banned_until, and reason', async () => {
  let executedQuery = '';
  let queryParams = [];

  const mockPool = {
    async query(sql, params) {
      executedQuery = sql;
      queryParams = params;
      return {
        rows: [{
          id: params[6],
          status: params[0],
          banned_until: params[1],
          ban_reason: params[2],
        }],
      };
    },
  };

  const userRepo = createUserRepository({ pool: mockPool });
  userRepo.findById = async (id) => ({ id, status: 'active' });

  const result = await userRepo.updateSanctionStatus({
    targetUserId: 'user-to-ban',
    action: 'ban',
    durationDays: 3,
    reason: 'Vi phạm ngôn từ',
    actorId: 'admin-1',
  });

  assert.equal(result.status, 'banned');
  assert.equal(queryParams[0], 'banned');
  assert.ok(queryParams[1] !== null); // banned_until is set
  assert.equal(queryParams[2], 'Vi phạm ngôn từ');
  assert.equal(queryParams[6], 'user-to-ban');
  assert.match(executedQuery, /UPDATE users/i);
});

test('updateSanctionStatus: permanent ban sets banned_until to null', async () => {
  let queryParams = [];

  const mockPool = {
    async query(sql, params) {
      queryParams = params;
      return {
        rows: [{
          id: params[6],
          status: params[0],
          banned_until: params[1],
          ban_reason: params[2],
        }],
      };
    },
  };

  const userRepo = createUserRepository({ pool: mockPool });
  userRepo.findById = async (id) => ({ id, status: 'active' });

  const result = await userRepo.updateSanctionStatus({
    targetUserId: 'user-permanent-ban',
    action: 'ban',
    durationDays: null,
    reason: 'Vi phạm nghiêm trọng',
    actorId: 'admin-1',
  });

  assert.equal(result.status, 'banned');
  assert.equal(queryParams[0], 'banned');
  assert.equal(queryParams[1], null);
  assert.equal(queryParams[2], 'Vi phạm nghiêm trọng');
});

test('updateSanctionStatus: unban restores status to active and clears ban info', async () => {
  let queryParams = [];

  const mockPool = {
    async query(sql, params) {
      queryParams = params;
      return {
        rows: [{
          id: params[6],
          status: params[0],
          banned_until: params[1],
          ban_reason: params[2],
        }],
      };
    },
  };

  const userRepo = createUserRepository({ pool: mockPool });
  userRepo.findById = async (id) => ({ id, status: 'banned', banned_until: '2026-10-20' });

  const result = await userRepo.updateSanctionStatus({
    targetUserId: 'user-banned',
    action: 'unban',
    actorId: 'admin-1',
  });

  assert.equal(result.status, 'active');
  assert.equal(queryParams[0], 'active');
  assert.equal(queryParams[1], null);
  assert.equal(queryParams[2], null);
});

test('updateSanctionStatus: clear_cooldown resets cooldown to 0 and restores active status', async () => {
  let queryParams = [];

  const mockPool = {
    async query(sql, params) {
      queryParams = params;
      return {
        rows: [{
          id: params[6],
          status: params[0],
          cooldown_until: params[3],
          cooldown_reason: params[4],
        }],
      };
    },
  };

  const userRepo = createUserRepository({ pool: mockPool });
  userRepo.findById = async (id) => ({ 
    id, 
    status: 'cooldown', 
    cooldown_until: new Date(Date.now() + 86400000).toISOString(),
    cooldown_reason: 'Bị gắn violence oan' 
  });

  const result = await userRepo.updateSanctionStatus({
    targetUserId: 'user-falsely-accused',
    action: 'clear_cooldown',
    actorId: 'admin-1',
  });

  assert.equal(result.status, 'active');
  assert.equal(queryParams[0], 'active');
  assert.equal(queryParams[3], null); // cooldown_until reset to null (countdown = 0)
  assert.equal(queryParams[4], null); // cooldown_reason reset
});

test('updateSanctionStatus: prevents admin from banning themselves', async () => {
  const mockPool = {
    async query() {
      return { rows: [] };
    },
  };

  const userRepo = createUserRepository({ pool: mockPool });
  userRepo.findById = async (id) => ({ id, status: 'active' });

  await assert.rejects(
    async () => {
      await userRepo.updateSanctionStatus({
        targetUserId: 'admin-1',
        action: 'ban',
        actorId: 'admin-1',
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /không thể tự khóa tài khoản/i);
      return true;
    }
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRole, normalizeRole, ROLES, ROLE_HIERARCHY } from '../src/utils/rbac.js';
import { createUserRepository } from '../src/repositories/userRepository.js';

test('RBAC: hasRole respects role hierarchy (admin > moderator > user)', () => {
  const adminUser = { role: 'admin' };
  const moderatorUser = { role: 'moderator' };
  const regularUser = { role: 'user' };

  // Admin có toàn bộ quyền
  assert.equal(hasRole(adminUser, ROLES.USER), true);
  assert.equal(hasRole(adminUser, ROLES.MODERATOR), true);
  assert.equal(hasRole(adminUser, ROLES.ADMIN), true);

  // Moderator có quyền của moderator và user, nhưng không có quyền admin
  assert.equal(hasRole(moderatorUser, ROLES.USER), true);
  assert.equal(hasRole(moderatorUser, ROLES.MODERATOR), true);
  assert.equal(hasRole(moderatorUser, ROLES.ADMIN), false);

  // User chỉ có quyền user
  assert.equal(hasRole(regularUser, ROLES.USER), true);
  assert.equal(hasRole(regularUser, ROLES.MODERATOR), false);
  assert.equal(hasRole(regularUser, ROLES.ADMIN), false);
});

test('RBAC: normalizeRole handles case-insensitivity and defaults to user', () => {
  assert.equal(normalizeRole('ADMIN'), 'admin');
  assert.equal(normalizeRole('Moderator'), 'moderator');
  assert.equal(normalizeRole('USER'), 'user');
  assert.equal(normalizeRole('invalid_role'), 'user');
  assert.equal(normalizeRole(null), 'user');
  assert.equal(normalizeRole(undefined), 'user');
});

test('RBAC: prevent admin from demoting themselves', async () => {
  const mockPool = {
    async query() {
      return { rows: [] };
    }
  };

  const userRepo = createUserRepository({ pool: mockPool });
  userRepo.findById = async (id) => ({ id, role: 'admin', full_name: 'Test Admin' });
  userRepo.countAdmins = async () => 2;

  await assert.rejects(
    async () => {
      await userRepo.updateUserRole({
        targetUserId: 'user-admin-1',
        newRole: 'moderator',
        actorId: 'user-admin-1', // Cùng một người
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /không thể tự hạ vai trò/i);
      return true;
    }
  );
});

test('RBAC: prevent demoting the last admin in the system', async () => {
  const mockPool = {
    async query() {
      return { rows: [] };
    }
  };

  const userRepo = createUserRepository({ pool: mockPool });
  userRepo.findById = async (id) => ({ id, role: 'admin', full_name: 'Sole Admin' });
  userRepo.countAdmins = async () => 1; // Chỉ còn 1 admin duy nhất

  await assert.rejects(
    async () => {
      await userRepo.updateUserRole({
        targetUserId: 'sole-admin-id',
        newRole: 'user',
        actorId: 'other-actor-id',
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /quản trị viên duy nhất/i);
      return true;
    }
  );
});

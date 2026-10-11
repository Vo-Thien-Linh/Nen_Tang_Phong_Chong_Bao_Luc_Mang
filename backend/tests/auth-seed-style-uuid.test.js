import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthMiddleware } from '../src/middleware/auth.js';

test('accept seed style uuid that is not rfc 4122 compliant', async () => {
  const seedUserId = 'a0000000-0000-0000-0000-000000000001';
  let queriedUserId;
  let nextCalled = false;
  const user = { id: seedUserId, username: 'seed_user' };
  const { requireAuth } = createAuthMiddleware({
    userRepository: {
      async findById(userId) {
        queriedUserId = userId;
        return user;
      },
    },
  });

  const req = {
    user: null,
    header(name) {
      return name === 'x-user-id' ? seedUserId : undefined;
    },
  };
  const res = {
    status() {
      throw new Error('response should not be used');
    },
  };

  await requireAuth(req, res, (error) => {
    if (error) throw error;
    nextCalled = true;
  });

  assert.equal(queriedUserId, seedUserId);
  assert.equal(req.user, user);
  assert.equal(nextCalled, true);
});

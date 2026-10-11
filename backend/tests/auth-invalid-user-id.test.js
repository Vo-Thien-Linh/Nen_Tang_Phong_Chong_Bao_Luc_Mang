import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthMiddleware } from '../src/middleware/auth.js';

test('reject malformed x-user-id before querying users', async () => {
  let queried = false;
  const { requireAuth } = createAuthMiddleware({
    userRepository: {
      async findById() {
        queried = true;
        throw new Error('should not query malformed uuid');
      },
    },
  });

  const req = {
    header(name) {
      return name === 'x-user-id' ? '<a0000000-0000-0000-0000-000000000001>' : undefined;
    },
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await requireAuth(req, res, (error) => {
    throw error || new Error('next should not be called');
  });

  assert.equal(queried, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    message: 'Bạn cần đăng nhập để tiếp tục',
  });
});

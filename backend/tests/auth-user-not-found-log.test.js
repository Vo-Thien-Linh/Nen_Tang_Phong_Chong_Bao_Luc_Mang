import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthMiddleware } from '../src/middleware/auth.js';

test('log reason when user is not found', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);

  try {
    const { requireAuth } = createAuthMiddleware({
      userRepository: {
        async findById() {
          return null;
        },
      },
    });

    const req = {
      header(name) {
        return name === 'x-user-id' ? 'a0000000-0000-0000-0000-000000000099' : undefined;
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

    assert.equal(res.statusCode, 401);
    assert.equal(warnings.some((message) => message.includes('không tìm thấy user trong DB')), true);
  } finally {
    console.warn = originalWarn;
  }
});

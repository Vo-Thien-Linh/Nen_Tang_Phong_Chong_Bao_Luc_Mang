import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthMiddleware } from '../src/middleware/auth.js';

test('log reason when user id header is missing', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);

  try {
    const { requireAuth } = createAuthMiddleware({
      userRepository: {
        async findById() {
          throw new Error('should not query without x-user-id');
        },
      },
    });

    const req = {
      header() {
        return undefined;
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
    assert.equal(warnings.some((message) => message.includes('thiếu header x-user-id')), true);
  } finally {
    console.warn = originalWarn;
  }
});

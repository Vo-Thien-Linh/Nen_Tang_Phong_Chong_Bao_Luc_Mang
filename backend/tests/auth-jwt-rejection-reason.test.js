import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createAuthMiddleware } from '../src/middleware/auth.js';

const userId = 'a0000000-0000-0000-0000-000000000001';

async function getAuthWarning(token) {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);

  try {
    const { requireAuth } = createAuthMiddleware({
      userRepository: {
        async findById() {
          throw new Error('invalid token must not query the database');
        },
      },
    });
    const req = {
      header(name) {
        return name === 'authorization' ? `Bearer ${token}` : undefined;
      },
    };
    const res = {
      status() { return this; },
      json() { return this; },
    };

    await requireAuth(req, res, (error) => {
      throw error || new Error('next should not be called');
    });
    return warnings[0];
  } finally {
    console.warn = originalWarn;
  }
}

test('reports an invalid signature separately from an expired token', async () => {
  const previousSecret = process.env.JWT_SECRET_KEY;
  process.env.JWT_SECRET_KEY = 'test-secret-that-is-long-enough-for-validation';

  try {
    const invalidSignatureToken = jwt.sign({ sub: userId, exp: Math.floor(Date.now() / 1000) + 60 }, 'a-different-long-enough-secret');
    const expiredToken = jwt.sign({ sub: userId, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET_KEY);

    assert.match(await getAuthWarning(invalidSignatureToken), /sai định dạng hoặc chữ ký không khớp/);
    assert.match(await getAuthWarning(expiredToken), /đã hết hạn/);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET_KEY;
    else process.env.JWT_SECRET_KEY = previousSecret;
  }
});

test('reports a missing JWT secret as a configuration error', async () => {
  const previousSecret = process.env.JWT_SECRET_KEY;
  delete process.env.JWT_SECRET_KEY;

  try {
    const token = jwt.sign({ sub: userId, exp: Math.floor(Date.now() / 1000) + 60 }, 'test-secret-that-is-long-enough-for-validation');
    assert.match(await getAuthWarning(token), /JWT_SECRET_KEY chưa được cấu hình hợp lệ/);
  } finally {
    if (previousSecret !== undefined) process.env.JWT_SECRET_KEY = previousSecret;
  }
});

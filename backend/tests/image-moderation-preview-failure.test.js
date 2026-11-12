import test from 'node:test';
import assert from 'node:assert/strict';
import { previewImageBytes } from '../src/services/imageModerationClient.js';

test('image byte preview marks an unavailable moderation service as failed', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 503 });
  try {
    const result = await previewImageBytes({ buffer: Buffer.from('image'), mimetype: 'image/png', originalname: 'image.png' });
    assert.equal(result.category, 'PENDING_REVIEW');
    assert.equal(result.failed, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

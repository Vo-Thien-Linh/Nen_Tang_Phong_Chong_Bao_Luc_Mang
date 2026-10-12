import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageFile } from '../src/utils/imageLogic.js';

test('accept supported image within size limit', () => {
  const result = validateImageFile({
    name: 'photo.webp',
    type: 'image/webp',
    size: 1024,
  });

  assert.deepEqual(result, { valid: true, message: '' });
});

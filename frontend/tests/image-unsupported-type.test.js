import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageFile } from '../src/utils/imageLogic.js';

test('reject image with unsupported file type', () => {
  const result = validateImageFile({
    name: 'document.pdf',
    type: 'application/pdf',
    size: 1024,
  });

  assert.equal(result.valid, false);
  assert.equal(result.message, 'Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF');
});

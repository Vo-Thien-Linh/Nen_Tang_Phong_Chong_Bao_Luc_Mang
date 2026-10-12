import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMAGE_SIZE_BYTES, validateImageFile } from '../src/utils/imageLogic.js';

test('reject image larger than size limit', () => {
  const result = validateImageFile({
    name: 'photo.jpg',
    type: 'image/jpeg',
    size: MAX_IMAGE_SIZE_BYTES + 1,
  });

  assert.equal(result.valid, false);
  assert.equal(result.message, 'Ảnh không được vượt quá 10MB');
});

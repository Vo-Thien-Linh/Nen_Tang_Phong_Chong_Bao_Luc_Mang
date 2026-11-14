import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getFilePickerLabel } from '../src/utils/filePicker.js';

const composerSource = readFileSync(new URL('../src/components/CreatePostCard.jsx', import.meta.url), 'utf8');

test('file picker shows vietnamese button label', () => {
  assert.match(composerSource, />\s*Chọn tệp\s*</);
  assert.match(composerSource, /aria-label="Chọn tệp hình ảnh"/);
  assert.equal(getFilePickerLabel(null), 'Chưa chọn tệp nào');
});

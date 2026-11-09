import test from 'node:test';
import assert from 'node:assert/strict';
import { maskSensitiveData, hasSensitiveData, detectSensitiveDataTypes } from '../src/utils/privacyMask.js';

test('Frontend Privacy Mask: masks Vietnamese phone numbers with asterisks', () => {
  const sample = 'Gọi cho tôi theo số 0901234567 nhé bạn';
  const masked = maskSensitiveData(sample);
  assert.equal(masked, 'Gọi cho tôi theo số 090****67 nhé bạn');
  assert.equal(hasSensitiveData(sample), true);
  assert.deepEqual(detectSensitiveDataTypes(sample), ['Số điện thoại']);
});

test('Frontend Privacy Mask: masks email and credit card', () => {
  const sample = 'Email: customer@wings.vn và thẻ 9704-1111-2222-3333';
  const masked = maskSensitiveData(sample);
  assert.ok(masked.includes('cu***@wings.vn'));
  assert.ok(masked.includes('****-****-****-3333'));
  const types = detectSensitiveDataTypes(sample);
  assert.ok(types.includes('Email'));
  assert.ok(types.includes('Số thẻ ngân hàng'));
});

test('Frontend Privacy Mask: preserves clean text without alteration', () => {
  const clean = 'Chào bạn, dự án của chúng ta đang tiến triển rất tốt vào ngày 12/10/2026.';
  const masked = maskSensitiveData(clean);
  assert.equal(masked, clean);
  assert.equal(hasSensitiveData(clean), false);
  assert.deepEqual(detectSensitiveDataTypes(clean), []);
});


import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBackendProfileUpdate } from '../src/utils/profileValidation.js';

test('backend profileValidation: accepts partial avatar update and valid workplace fields', () => {
  const avatarOnly = validateBackendProfileUpdate({
    avatar_url: 'https://cdn.example.com/a.png',
  });
  assert.equal(avatarOnly.valid, true);
  assert.deepEqual(avatarOnly.sanitized, {
    avatar_url: 'https://cdn.example.com/a.png',
  });

  const fullProfile = validateBackendProfileUpdate({
    bio: '  Phát triển hệ thống phân tán  ',
    workplace: 'Viettel Solutions',
    jobTitle: 'Kỹ sư hệ thống',
    location: 'Hà Nội',
    hometown: 'Nghệ An',
    education: 'Đại học Bách Khoa Hà Nội',
    highSchool: 'THPT Chuyên Phan Bội Châu',
    relationship: 'Độc thân',
  });

  assert.equal(fullProfile.valid, true, JSON.stringify(fullProfile.errors));
  assert.equal(fullProfile.sanitized.workplace, 'Viettel Solutions');
  assert.equal(fullProfile.sanitized.job_title, 'Kỹ sư hệ thống');
  assert.equal(fullProfile.sanitized.high_school, 'THPT Chuyên Phan Bội Châu');
  assert.equal(fullProfile.sanitized.relationship_status, 'Độc thân');
});

test('backend profileValidation: rejects nonsense input on location, hometown, and workplace', () => {
  const res = validateBackendProfileUpdate({
    location: '123456',
    hometown: 'asdfghjkl',
    workplace: '@@@@@',
    education: 'aaaaa',
  });

  assert.equal(res.valid, false);
  assert.ok(res.errors.location);
  assert.ok(res.errors.hometown);
  assert.ok(res.errors.workplace);
  assert.ok(res.errors.education);
  assert.ok(res.message.length > 0);
});


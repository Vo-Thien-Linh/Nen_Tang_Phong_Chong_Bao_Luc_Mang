import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RELATIONSHIP_OPTIONS,
  validateProfileField,
  validateProfileForm,
} from '../src/utils/profileValidation.js';

test('profileValidation: accepts valid Vietnamese and English profile fields', () => {
  const result = validateProfileForm({
    avatar_url: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
    cover_url: '/default-cover.jpg',
    bio: '  Kỹ sư phần mềm yêu thích công nghệ AI & nhiếp ảnh.  ',
    workplace: '  Công ty Cổ phần FPT  ',
    jobTitle: 'Kỹ sư phần mềm & R&D',
    location: 'Quận 1, TP. Hồ Chí Minh',
    hometown: 'Bà Rịa - Vũng Tàu',
    education: 'Đại học Bách Khoa TP.HCM - CNTT',
    highSchool: 'Trường THPT Hòa Hội',
    relationship: RELATIONSHIP_OPTIONS[0],
  });

  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.sanitized.workplace, 'Công ty Cổ phần FPT');
  assert.equal(result.sanitized.location, 'Quận 1, TP. Hồ Chí Minh');
  assert.equal(result.sanitized.bio, 'Kỹ sư phần mềm yêu thích công nghệ AI & nhiếp ảnh.');
});

test('profileValidation: allows empty optional fields so user can clear info', () => {
  const result = validateProfileForm({
    avatar_url: '',
    cover_url: '',
    bio: '   ',
    workplace: '',
    jobTitle: '',
    location: '',
    hometown: '',
    education: '',
    highSchool: '',
    relationship: '',
  });

  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.sanitized.location, '');
  assert.equal(result.sanitized.workplace, '');
});

test('profileValidation: rejects gibberish, numbers-only, symbols, and repeated-char spam', () => {
  const badLocations = ['123456', '!@#$%', 'aaaaa', 'asdfghjkl', 'qwertyuiop', 'bcdfghj', 'a', 'TP @@@ HCM'];
  for (const val of badLocations) {
    const err = validateProfileField('location', val);
    assert.ok(err.length > 0, `Expected location "${val}" to be rejected`);
  }

  const badWorkplaces = ['99999', 'zzzzz', 'zxcvbnm', '???'];
  for (const val of badWorkplaces) {
    const err = validateProfileField('workplace', val);
    assert.ok(err.length > 0, `Expected workplace "${val}" to be rejected`);
  }

  assert.ok(validateProfileField('bio', '123456789').length > 0);
  assert.ok(validateProfileField('bio', '!!!!!!').length > 0);
  assert.ok(validateProfileField('relationship', 'Không hợp lệ đâu').length > 0);
  assert.ok(validateProfileField('avatar_url', 'not-a-valid-url').length > 0);
});


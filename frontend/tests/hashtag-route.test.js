import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHashtagHash, parseHashtagHash } from '../src/utils/hashtagRouteLogic.js';

test('hashtag route normalizes a typed tag', () => {
  assert.equal(parseHashtagHash('#hashtag/SinhVien'), 'sinhvien');
});


import test from 'node:test';
import assert from 'node:assert/strict';
import { closePostMenu } from '../src/utils/menuLogic.js';

test('close menu on escape key', () => {
  assert.equal(closePostMenu(), null);
});

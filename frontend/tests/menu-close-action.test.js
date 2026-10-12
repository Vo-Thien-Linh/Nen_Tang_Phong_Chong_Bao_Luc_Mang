import test from 'node:test';
import assert from 'node:assert/strict';
import { closePostMenu } from '../src/utils/menuLogic.js';

test('close menu after choosing an action', () => {
  assert.equal(closePostMenu(), null);
});

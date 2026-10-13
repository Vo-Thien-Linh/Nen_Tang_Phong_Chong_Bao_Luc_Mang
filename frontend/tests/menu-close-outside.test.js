import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldClosePostMenuForPointer } from '../src/utils/menuLogic.js';

test('close menu when clicking outside', () => {
  const target = {};
  const menuElement = { contains: () => false };
  const triggerElement = { contains: () => false };

  assert.equal(shouldClosePostMenuForPointer({ target, menuElement, triggerElement }), true);
});

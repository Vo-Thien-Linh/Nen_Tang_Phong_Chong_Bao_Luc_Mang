import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldClosePostMenuForPointer } from '../src/utils/menuLogic.js';

test('keep menu open when clicking inside menu or its trigger', () => {
  const target = {};

  assert.equal(shouldClosePostMenuForPointer({
    target,
    menuElement: { contains: () => true },
    triggerElement: { contains: () => false },
  }), false);
  assert.equal(shouldClosePostMenuForPointer({
    target,
    menuElement: { contains: () => false },
    triggerElement: { contains: () => true },
  }), false);
});

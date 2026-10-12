import test from 'node:test';
import assert from 'node:assert/strict';
import { computePopoverPlacement } from '../src/utils/popoverLogic.js';

test('keep popover inside viewport horizontally', () => {
  const result = computePopoverPlacement({
    anchorRect: { top: 300, bottom: 330, left: 360 },
    popoverSize: { width: 180, height: 100 },
    viewport: { width: 390, height: 700 },
    gap: 8,
  });

  assert.equal(result.left, 202);
});

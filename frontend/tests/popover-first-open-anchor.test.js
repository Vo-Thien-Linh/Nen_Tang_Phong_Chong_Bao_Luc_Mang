import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMeasuredPopoverPlacement } from '../src/utils/popoverLogic.js';

test('anchor popover to the measured anchor rect on first open', () => {
  const result = computeMeasuredPopoverPlacement({
    anchorRect: { top: 300, bottom: 330, left: 96 },
    popoverSize: { width: 180, height: 100 },
    viewport: { width: 390, height: 700 },
    gap: 8,
  });

  assert.equal(result.ready, true);
  assert.equal(result.left, 96);
  assert.equal(result.top, 192);
});

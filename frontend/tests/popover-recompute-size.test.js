import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMeasuredPopoverPlacement } from '../src/utils/popoverLogic.js';

test('recompute placement when popover size changes', () => {
  const anchorRect = { top: 300, bottom: 330, left: 80 };
  const viewport = { width: 390, height: 700 };
  const small = computeMeasuredPopoverPlacement({
    anchorRect,
    popoverSize: { width: 180, height: 80 },
    viewport,
    gap: 8,
  });
  const large = computeMeasuredPopoverPlacement({
    anchorRect,
    popoverSize: { width: 180, height: 120 },
    viewport,
    gap: 8,
  });

  assert.equal(small.top, 212);
  assert.equal(large.top, 172);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { computePopoverPlacement } from '../src/utils/popoverLogic.js';

test('flip popover below anchor when there is no space above', () => {
  const result = computePopoverPlacement({
    anchorRect: { top: 40, bottom: 70, left: 80 },
    popoverSize: { width: 180, height: 100 },
    viewport: { width: 390, height: 700 },
    gap: 8,
  });

  assert.equal(result.placement, 'bottom');
  assert.equal(result.top, 78);
});

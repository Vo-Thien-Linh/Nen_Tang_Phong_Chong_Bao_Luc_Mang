import test from 'node:test';
import assert from 'node:assert/strict';
import { computePopoverPlacement } from '../src/utils/popoverLogic.js';

test('place reaction popover above anchor when space is enough', () => {
  const result = computePopoverPlacement({
    anchorRect: { top: 300, bottom: 330, left: 80 },
    popoverSize: { width: 180, height: 100 },
    viewport: { width: 390, height: 700 },
    gap: 8,
  });

  assert.equal(result.placement, 'top');
  assert.equal(result.top, 192);
  assert.equal(result.left, 80);
});

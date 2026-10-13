import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMeasuredPopoverPlacement } from '../src/utils/popoverLogic.js';

test('treat popover placement as not ready until size is measured', () => {
  const result = computeMeasuredPopoverPlacement({
    anchorRect: { top: 300, bottom: 330, left: 80 },
    popoverSize: { width: 0, height: 0 },
    viewport: { width: 390, height: 700 },
  });

  assert.equal(result.ready, false);
});

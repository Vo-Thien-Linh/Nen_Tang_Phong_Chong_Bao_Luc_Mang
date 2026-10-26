import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldHideContentForViewer } from '../src/utils/imageModerationReviewLogic.js';

test('other users still see the overlay for a sensitive post', () => {
  assert.equal(shouldHideContentForViewer({ isAuthor: false, status: 'sensitive', isSensitive: true }), true);
});

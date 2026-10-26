import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldHideContentForViewer } from '../src/utils/imageModerationReviewLogic.js';

test('text moderation overlay is not shown to the author', () => {
  assert.equal(shouldHideContentForViewer({ isAuthor: true, status: null, isSensitive: true }), false);
  assert.equal(shouldHideContentForViewer({ isAuthor: false, status: null, isSensitive: true }), true);
});

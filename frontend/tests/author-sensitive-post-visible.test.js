import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldHideContentForViewer } from '../src/utils/imageModerationReviewLogic.js';

test('author sees own sensitive post without overlay', () => {
  assert.equal(shouldHideContentForViewer({ isAuthor: true, status: 'sensitive', isSensitive: true }), false);
});

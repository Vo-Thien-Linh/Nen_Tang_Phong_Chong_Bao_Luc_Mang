import test from 'node:test';
import assert from 'node:assert/strict';
import { formatImageModerationForViewer } from '../src/services/imageModerationResponse.js';

test('other viewers get no author sensitive notice', () => {
  const result = formatImageModerationForViewer({ status: 'sensitive', label: 'NSFW' }, 'post', 'author-1', 'viewer-2');
  assert.equal(result.status, 'sensitive');
  assert.equal('noticeText' in result, false);
  assert.equal('noticeType' in result, false);
});

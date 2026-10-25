import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getImageReviewNotice,
  canSubmitImageAppeal,
  applyImageReviewQueueResult,
  areImageReviewActionsDisabled,
  getPreviousImageDecisionLabel,
} from '../src/utils/imageModerationReviewLogic.js';

test('rejected admin item shows its in-place notice and appeal button', () => {
  const notice = getImageReviewNotice('rejected_admin', 'post');
  assert.equal(notice.visible, true);
  assert.match(notice.text, /Bài viết/);
  assert.equal(notice.showAppealButton, true);
});

test('appeal button is hidden after an appeal is submitted', () => {
  assert.equal(getImageReviewNotice('appeal_pending', 'comment').showAppealButton, false);
});

test('appealed item shows the under review label', () => {
  assert.match(getImageReviewNotice('appeal_pending').text, /đang được xem xét/);
});

test('final rejection removes the item from the author feed', () => {
  assert.equal(getImageReviewNotice('rejected_final').removeFromFeed, true);
});

test('appeal submission is blocked while another request is pending', () => {
  assert.equal(canSubmitImageAppeal('rejected_admin', true), false);
  assert.equal(canSubmitImageAppeal('rejected_admin', false), true);
  assert.equal(canSubmitImageAppeal('appeal_pending', false), false);
});

test('queue item is removed after a successful review', () => {
  const items = [{ id: 1, type: 'post' }, { id: 2, type: 'comment' }];
  assert.deepEqual(applyImageReviewQueueResult(items, items[0], { succeeded: true }), [items[1]]);
});

test('queue item is removed after a conflict response', () => {
  const items = [{ id: 1, type: 'post' }, { id: 2, type: 'post' }];
  assert.deepEqual(applyImageReviewQueueResult(items, items[0], { status: 409 }), [items[1]]);
});

test('queue item remains after a server error', () => {
  const items = [{ id: 1, type: 'post' }];
  assert.equal(applyImageReviewQueueResult(items, items[0], { status: 500 }), items);
});

test('all review buttons are disabled while a request is pending', () => {
  assert.equal(areImageReviewActionsDisabled('post-1'), true);
  assert.equal(areImageReviewActionsDisabled(null), false);
});

test('appeal queue exposes the previous review label', () => {
  assert.equal(getPreviousImageDecisionLabel({ previousDecision: { label: 'Violence' } }), 'Violence');
  assert.equal(getPreviousImageDecisionLabel({}), null);
});

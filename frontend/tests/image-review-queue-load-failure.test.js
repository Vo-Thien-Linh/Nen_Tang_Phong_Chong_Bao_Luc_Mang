import test from 'node:test';
import assert from 'node:assert/strict';
import { getImageReviewLoadFailure } from '../src/utils/imageModerationReviewLogic.js';

test('image review queue load failure returns a clear Vietnamese error toast', () => {
  assert.deepEqual(getImageReviewLoadFailure(), {
    type: 'error',
    message: 'Không thể tải hàng đợi duyệt ảnh. Vui lòng thử lại.',
  });
});

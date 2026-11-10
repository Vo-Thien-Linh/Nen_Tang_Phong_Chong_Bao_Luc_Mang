import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPostVisibilityPredicate, canViewerSeePost } from '../src/repositories/postVisibility.js';

test('feed hides friends posts from strangers', () => {
  assert.equal(canViewerSeePost({
    viewerId: 'stranger', authorId: 'author', privacy: 'friends', friendshipStatus: 'pending',
  }), false);
  const sql = buildPostVisibilityPredicate('$1');
  assert.match(sql, /f\."status" = 'accepted'/);
  assert.match(sql, /COALESCE\(p\.privacy, 'public'\)/);
});

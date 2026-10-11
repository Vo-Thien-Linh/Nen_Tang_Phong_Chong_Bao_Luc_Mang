import test from 'node:test';
import assert from 'node:assert/strict';
import { getSummaryReactions } from '../src/utils/reactionLogic.js';

test('show top three reaction types by count for viewer without reaction', () => {
  const result = getSummaryReactions({
    counts: {
      like: 4,
      love: 8,
      haha: 2,
      wow: 8,
      sad: 1,
      angry: 7,
    },
    myReaction: null,
  });

  assert.deepEqual(result.map((reaction) => reaction.id), ['love', 'wow', 'angry']);
});

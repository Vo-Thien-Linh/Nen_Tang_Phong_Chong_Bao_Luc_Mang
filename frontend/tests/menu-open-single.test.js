import test from 'node:test';
import assert from 'node:assert/strict';
import { togglePostMenu } from '../src/utils/menuLogic.js';

test('opening a post menu closes the menu of another post', () => {
  assert.equal(togglePostMenu('post-1', 'post-2'), 'post-2');
});

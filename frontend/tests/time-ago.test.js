import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRelativeTime } from '../src/utils/timeAgo.js';

test('formatRelativeTime: returns empty string for empty input', () => {
  assert.equal(formatRelativeTime(null), '');
  assert.equal(formatRelativeTime(''), '');
  assert.equal(formatRelativeTime(undefined), '');
});

test('formatRelativeTime: returns existing relative time string untouched', () => {
  assert.equal(formatRelativeTime('5 phút trước'), '5 phút trước');
  assert.equal(formatRelativeTime('Vừa xong'), 'Vừa xong');
  assert.equal(formatRelativeTime('Hôm qua'), 'Hôm qua');
  assert.equal(formatRelativeTime('2 ngày trước'), '2 ngày trước');
});

test('formatRelativeTime: < 1 minute returns "Vừa xong"', () => {
  const date = new Date(Date.now() - 20_000); // 20s ago
  assert.equal(formatRelativeTime(date), 'Vừa xong');
});

test('formatRelativeTime: < 60 minutes returns "X phút trước"', () => {
  const date = new Date(Date.now() - 15 * 60_000); // 15 mins ago
  assert.equal(formatRelativeTime(date), '15 phút trước');
});

test('formatRelativeTime: < 24 hours returns "X giờ trước"', () => {
  const date = new Date(Date.now() - 4 * 3600_000); // 4 hours ago
  assert.equal(formatRelativeTime(date), '4 giờ trước');
});

test('formatRelativeTime: under 1 week (1 - 6 days) returns "1 ngày trước", "2 ngày trước", ...', () => {
  const oneDayAgo = new Date(Date.now() - 24 * 3600_000);
  assert.equal(formatRelativeTime(oneDayAgo), '1 ngày trước');

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600_000);
  assert.equal(formatRelativeTime(twoDaysAgo), '2 ngày trước');

  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 3600_000);
  assert.equal(formatRelativeTime(sixDaysAgo), '6 ngày trước');
});

test('formatRelativeTime: 1 week to < 30 days returns "tuần trước", "2 tuần trước", "3 tuần trước"', () => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
  assert.equal(formatRelativeTime(oneWeekAgo), 'tuần trước');

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600_000);
  assert.equal(formatRelativeTime(twoWeeksAgo), '2 tuần trước');

  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 3600_000);
  assert.equal(formatRelativeTime(threeWeeksAgo), '3 tuần trước');
});

test('formatRelativeTime: 1 month to < 1 year returns "1 tháng trước", "2 tháng trước", ...', () => {
  const oneMonthAgo = new Date(Date.now() - 35 * 24 * 3600_000);
  assert.equal(formatRelativeTime(oneMonthAgo), '1 tháng trước');

  const twoMonthsAgo = new Date(Date.now() - 65 * 24 * 3600_000);
  assert.equal(formatRelativeTime(twoMonthsAgo), '2 tháng trước');

  const fiveMonthsAgo = new Date(Date.now() - 150 * 24 * 3600_000);
  assert.equal(formatRelativeTime(fiveMonthsAgo), '5 tháng trước');
});

test('formatRelativeTime: >= 1 year displays specific date "dd/mm/yyyy"', () => {
  const specificDate = new Date(Date.now() - 400 * 24 * 3600_000);
  const day = String(specificDate.getDate()).padStart(2, '0');
  const month = String(specificDate.getMonth() + 1).padStart(2, '0');
  const year = specificDate.getFullYear();
  const expected = `${day}/${month}/${year}`;

  assert.equal(formatRelativeTime(specificDate), expected);
});

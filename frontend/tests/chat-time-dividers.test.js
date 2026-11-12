import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateBadge,
  getMessageDateDivider,
  getMessageTimeDivider,
  formatFullTimestamp
} from '../src/utils/chatTimeDividers.js';

describe('chatTimeDividers utility', () => {
  const now = new Date();
  const todayIso = now.toISOString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayIso = yesterday.toISOString();

  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(now.getDate() - 3);
  const threeDaysAgoIso = threeDaysAgo.toISOString();

  describe('formatDateBadge', () => {
    it('returns "Hôm nay" for today in Vietnamese and "Today" in English', () => {
      assert.equal(formatDateBadge(todayIso, false), 'Hôm nay');
      assert.equal(formatDateBadge(todayIso, true), 'Today');
    });

    it('returns "Hôm qua" for yesterday in Vietnamese and "Yesterday" in English', () => {
      assert.equal(formatDateBadge(yesterdayIso, false), 'Hôm qua');
      assert.equal(formatDateBadge(yesterdayIso, true), 'Yesterday');
    });

    it('returns weekday and date for other days in same year', () => {
      const badgeVi = formatDateBadge(threeDaysAgoIso, false);
      assert.ok(badgeVi.includes('tháng'));

      const badgeEn = formatDateBadge(threeDaysAgoIso, true);
      assert.ok(typeof badgeEn === 'string' && badgeEn.length > 0);
    });

    it('returns full date including year for different year', () => {
      const pastDate = new Date(2023, 4, 15);
      assert.equal(formatDateBadge(pastDate.toISOString(), false), '15 tháng 5, 2023');
      assert.ok(formatDateBadge(pastDate.toISOString(), true).includes('2023'));
    });

    it('returns null for empty or invalid dates', () => {
      assert.equal(formatDateBadge(null), null);
      assert.equal(formatDateBadge('invalid-date'), null);
    });
  });

  describe('getMessageDateDivider', () => {
    it('shows date divider on the very first message', () => {
      const firstMsg = { id: 1, text: 'Hello', createdAt: todayIso };
      assert.equal(getMessageDateDivider(firstMsg, null, false), 'Hôm nay');
      assert.equal(getMessageDateDivider(firstMsg, null, true), 'Today');
    });

    it('returns null when two messages are on the same day', () => {
      const msg1 = { id: 1, text: 'Hello', createdAt: todayIso };
      const msg2 = { id: 2, text: 'Hi', createdAt: todayIso };
      assert.equal(getMessageDateDivider(msg2, msg1), null);
    });

    it('shows date divider when day changes between messages', () => {
      const msgYesterday = { id: 1, text: 'Yesterday chat', createdAt: yesterdayIso };
      const msgToday = { id: 2, text: 'Today chat', createdAt: todayIso };
      assert.equal(getMessageDateDivider(msgToday, msgYesterday, false), 'Hôm nay');
      assert.equal(getMessageDateDivider(msgToday, msgYesterday, true), 'Today');
    });

    it('falls back gracefully if message has no createdAt', () => {
      assert.equal(getMessageDateDivider({ id: 1 }, null, false), 'Hôm nay');
      assert.equal(getMessageDateDivider(null, null), null);
    });
  });

  describe('getMessageTimeDivider', () => {
    it('returns null if gap is less than default 20 minutes', () => {
      const baseTime = new Date('2026-11-11T14:00:00Z');
      const nextTime = new Date('2026-11-11T14:10:00Z'); // 10 mins
      const msg1 = { id: 1, createdAt: baseTime.toISOString(), time: '21:00' };
      const msg2 = { id: 2, createdAt: nextTime.toISOString(), time: '21:10' };

      assert.equal(getMessageTimeDivider(msg2, msg1), null);
    });

    it('returns time string if gap is >= 20 minutes in same day', () => {
      const baseTime = new Date('2026-11-11T14:00:00Z');
      const nextTime = new Date('2026-11-11T14:35:00Z'); // 35 mins
      const msg1 = { id: 1, createdAt: baseTime.toISOString(), time: '21:00' };
      const msg2 = { id: 2, createdAt: nextTime.toISOString(), time: '21:35' };

      assert.equal(getMessageTimeDivider(msg2, msg1), '21:35');
    });

    it('returns null if messages are on different days (date divider takes precedence)', () => {
      const msgYesterday = { id: 1, createdAt: yesterdayIso, time: '10:00' };
      const msgToday = { id: 2, createdAt: todayIso, time: '11:00' };

      assert.equal(getMessageTimeDivider(msgToday, msgYesterday), null);
    });

    it('handles missing or invalid inputs cleanly', () => {
      assert.equal(getMessageTimeDivider(null, null), null);
      assert.equal(getMessageTimeDivider({ id: 1 }, { id: 2 }), null);
    });
  });

  describe('formatFullTimestamp', () => {
    it('formats timestamp with both time and date for tooltips', () => {
      const sample = new Date('2026-11-11T07:28:00Z');
      const formatted = formatFullTimestamp(sample.toISOString(), false);
      assert.ok(formatted.includes('11/11/2026'));
      assert.ok(formatted.includes(':'));
    });

    it('returns empty string for invalid dates', () => {
      assert.equal(formatFullTimestamp(null), '');
      assert.equal(formatFullTimestamp('invalid'), '');
    });
  });
});


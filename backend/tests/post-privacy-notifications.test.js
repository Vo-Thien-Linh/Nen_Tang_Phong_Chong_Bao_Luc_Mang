import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationRepository } from '../../services/notification-service/src/repositories/notificationRepository.js';

test('notification listing excludes target posts the recipient cannot see', async () => {
  let listSql = '';
  let countSql = '';
  const repository = createNotificationRepository({
    pool: {
      async query(sql) {
        if (/COUNT\(\*\)/.test(sql)) countSql = sql;
        else listSql = sql;
        return { rows: [{ count: 0 }] };
      },
    },
  });

  await repository.listByUser({ recipientId: 'viewer' });
  await repository.getUnreadCount('viewer');

  for (const sql of [listSql, countSql]) {
    assert.match(sql, /n\.target_post_id IS NULL OR/);
    assert.match(sql, /COALESCE\(p\.privacy, 'public'\)/);
    assert.match(sql, /f\."status" = 'accepted'/);
  }
});

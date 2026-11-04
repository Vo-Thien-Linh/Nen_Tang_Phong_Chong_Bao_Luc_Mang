import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { attachRealtimePublisher, startRealtimeListener } from '../src/services/postgresRealtimeBridge.js';
import { realtimeService } from '../src/services/realtimeService.js';

test('realtime publisher sends an event through PostgreSQL NOTIFY', async () => {
  let notification;
  const pool = {
    async query(sql, values) {
      notification = { sql, values };
    },
  };

  attachRealtimePublisher({ pool, realtimeService });
  realtimeService.broadcast({ type: 'POST_CREATED', postId: '17' });
  await new Promise((resolve) => setImmediate(resolve));
  realtimeService.setPublisher(null);

  assert.equal(notification.sql, 'SELECT pg_notify($1, $2)');
  assert.equal(notification.values[0], 'nexussocial_realtime');
  assert.deepEqual(JSON.parse(notification.values[1]).event, { type: 'POST_CREATED', postId: '17' });
});

test('realtime listener forwards remote events to local SSE clients without echoing own events', async () => {
  let ownEnvelope;
  attachRealtimePublisher({
    pool: { async query(_sql, values) { ownEnvelope = JSON.parse(values[1]); } },
    realtimeService,
  });
  realtimeService.broadcast({ type: 'SELF_EVENT' });
  await new Promise((resolve) => setImmediate(resolve));
  realtimeService.setPublisher(null);

  let listenerReady;
  const ready = new Promise((resolve) => { listenerReady = resolve; });
  const listener = new EventEmitter();
  listener.query = async (sql) => {
    if (sql.startsWith('LISTEN')) listenerReady();
  };
  listener.release = () => {};

  const pool = { async connect() { return listener; } };
  const sseClient = { writes: [], write(payload) { this.writes.push(payload); } };
  realtimeService.addClient(sseClient);
  const stop = startRealtimeListener({ pool, realtimeService });
  await ready;

  listener.emit('notification', {
    channel: 'nexussocial_realtime',
    payload: JSON.stringify({ source: ownEnvelope.source, event: ownEnvelope.event }),
  });
  assert.equal(sseClient.writes.length, 0);

  listener.emit('notification', {
    channel: 'nexussocial_realtime',
    payload: JSON.stringify({ source: 'another-service', event: { type: 'POST_DELETED', postId: '17' } }),
  });

  assert.equal(sseClient.writes.length, 1);
  assert.match(sseClient.writes[0], /POST_DELETED/);
  await stop();
  realtimeService.removeClient(sseClient);
});

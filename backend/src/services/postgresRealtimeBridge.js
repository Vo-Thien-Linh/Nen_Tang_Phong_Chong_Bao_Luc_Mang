import { randomUUID } from 'crypto';

const CHANNEL = 'nexussocial_realtime';
const MAX_NOTIFY_BYTES = 7900;
const instanceId = randomUUID();

export function attachRealtimePublisher({ pool, realtimeService }) {
  realtimeService.setPublisher(async (event) => {
    const payload = JSON.stringify({ source: instanceId, event });
    if (Buffer.byteLength(payload, 'utf8') > MAX_NOTIFY_BYTES) {
      throw new Error('Realtime event exceeds PostgreSQL NOTIFY payload limit');
    }
    await pool.query('SELECT pg_notify($1, $2)', [CHANNEL, payload]);
  });
}

export function startRealtimeListener({ pool, realtimeService, retryDelayMs = 3000 }) {
  let stopped = false;
  let client = null;
  let retryTimer = null;

  const scheduleReconnect = () => {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, retryDelayMs);
    retryTimer.unref?.();
  };

  const connect = async () => {
    if (stopped) return;
    try {
      const listener = await pool.connect();
      client = listener;
      listener.on('notification', (message) => {
        if (message.channel !== CHANNEL || !message.payload) return;
        try {
          const envelope = JSON.parse(message.payload);
          if (envelope.source !== instanceId && envelope.event) {
            realtimeService.broadcastLocal(envelope.event);
          }
        } catch {
          console.warn('[Realtime] Ignored malformed database event');
        }
      });
      listener.on('error', (error) => {
        console.warn('[Realtime] Database listener disconnected:', error.message);
        if (client === listener) client = null;
        listener.release(error);
        scheduleReconnect();
      });
      await listener.query(`LISTEN ${CHANNEL}`);
    } catch (error) {
      if (client) {
        client.release();
        client = null;
      }
      console.warn('[Realtime] Could not start database listener:', error.message);
      scheduleReconnect();
    }
  };

  void connect();

  return async () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (client) {
      try { await client.query(`UNLISTEN ${CHANNEL}`); } catch {}
      client.release();
      client = null;
    }
  };
}

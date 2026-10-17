export async function sweepExpiredModeration(db, clock = () => new Date()) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const now = clock();
    await client.query(`DELETE FROM comments WHERE image_moderation_status = 'rejected_hold' AND moderation_expires_at <= $1`, [now]);
    const result = await client.query(`DELETE FROM posts WHERE image_moderation_status = 'rejected_hold' AND moderation_expires_at <= $1`, [now]);
    await client.query('COMMIT');
    return result.rowCount || 0;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function startModerationExpirySweeper(db, { intervalMs = 60_000, clock = () => new Date(), logger = console } = {}) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await sweepExpiredModeration(db, clock); } catch (error) { logger.error('[image moderation sweeper]', error); } finally { running = false; }
  };
  const interval = setInterval(run, intervalMs);
  return () => clearInterval(interval);
}

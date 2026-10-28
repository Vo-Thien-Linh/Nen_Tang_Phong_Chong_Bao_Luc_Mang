export async function restoreReportedTextModeration(pool, { targetType, targetId }) {
  if (targetType === 'post') {
    await pool.query(
      `UPDATE posts
       SET ai_label = 'Normal', ai_status = 'approved'
       WHERE id = $1`,
      [targetId]
    );
    return;
  }

  if (targetType === 'comment') {
    await pool.query(
      `UPDATE comments
       SET ai_label = 'Normal', is_hidden = FALSE
       WHERE id = $1`,
      [targetId]
    );
  }
}

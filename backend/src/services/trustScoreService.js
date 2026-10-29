/**
 * Service Quản lý Điểm Uy Tín người dùng (User Trust & Reputation Score)
 * 
 * Thang điểm: 0 - 100
 * - 90 - 100: Thành viên xuất sắc (Good Standing)
 * - 70 - 89: Bình thường (Fair)
 * - 50 - 69: Cảnh báo (Warning)
 * - Dưới 50: Hạn chế / Nguy cơ bị khóa (Restricted)
 */

export const TRUST_TIERS = {
  GOOD: 'good',           // 90 - 100
  FAIR: 'fair',           // 70 - 89
  WARNING: 'warning',     // 50 - 69
  RESTRICTED: 'restricted'// 0 - 49
};

export function getTrustTier(score = 100) {
  const num = Number(score) || 0;
  if (num >= 90) return TRUST_TIERS.GOOD;
  if (num >= 70) return TRUST_TIERS.FAIR;
  if (num >= 50) return TRUST_TIERS.WARNING;
  return TRUST_TIERS.RESTRICTED;
}

/**
 * Tính toán mức điểm trừ dựa trên kiểm duyệt Đa phương thức (Multimodal: Text + Ảnh)
 */
export function calculateTrustDeduction(textLabel, imageStatus) {
  const textPenaltyMap = {
    'Normal': 0,
    'Toxic': 5,
    'Hate Speech': 20,
    'Violence': 35,
  };

  const imagePenaltyMap = {
    'safe': 0,
    'pending_review': 0, // Đang phân vân chờ duyệt thì chưa trừ
    'sensitive': 10,     // Ảnh nhạy cảm (NSFW)
    'rejected_hold': 35, // Ảnh bạo lực
    'rejected_admin': 35,
    'rejected_final': 35,
  };

  const textPenalty = textPenaltyMap[textLabel] || 0;
  const imagePenalty = imagePenaltyMap[imageStatus] || 0;

  // Nếu cả 2 đều vi phạm -> Nhân hệ số tăng nặng 1.4
  if (textPenalty > 0 && imagePenalty > 0) {
    return Math.min(50, Math.round(Math.max(textPenalty, imagePenalty) * 1.4));
  }

  // Nếu chỉ 1 trong 2 vi phạm -> Trừ theo mức cao nhất
  return Math.max(textPenalty, imagePenalty);
}

/**
 * Trừ điểm uy tín người dùng và ghi nhật ký
 */
export async function applyTrustPenalty({ pool, userId, amount, reason, actionType = 'violation', contentId = null }) {
  if (!pool || !userId || !amount || amount <= 0) return null;

  try {
    const updateRes = await pool.query(
      `UPDATE users
       SET trust_score = GREATEST(0, COALESCE(trust_score, 100) - $1),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, trust_score, status`,
      [amount, userId]
    );

    const user = updateRes.rows[0];
    if (!user) return null;

    const newScore = Number(user.trust_score);

    // Ghi nhật ký trừ điểm vào bảng user_trust_logs
    await pool.query(
      `INSERT INTO user_trust_logs (user_id, change_amount, new_score, reason, action_type, content_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, -amount, newScore, reason || 'Vi phạm Tiêu chuẩn Cộng đồng', actionType, contentId]
    );

    // Tự động áp dụng hạn chế nếu điểm tụt xuống quá thấp
    if (newScore < 30 && user.status !== 'banned') {
      const cooldownHours = newScore === 0 ? 72 : 24;
      await pool.query(
        `UPDATE users
         SET status = 'cooldown',
             cooldown_until = CURRENT_TIMESTAMP + ($1 || ' hours')::INTERVAL,
             cooldown_reason = 'Điểm uy tín dưới 30/100 do nhiều lần vi phạm',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [cooldownHours, userId]
      );
    }

    // Gửi thông báo hệ thống về việc trừ điểm
    try {
      await pool.query(
        `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
         VALUES ($1, $2, 'ai_moderation', $3, $4)`,
        [
          userId,
          null,
          `Điểm uy tín của bạn bị trừ ${amount} điểm do: ${reason}. Điểm hiện tại: ${newScore}/100.`,
          contentId ? Number(String(contentId).replace(/\D/g, '')) || null : null
        ]
      );
    } catch (notifErr) {
      console.warn('Không thể gửi thông báo trừ điểm:', notifErr.message);
    }

    return {
      userId,
      deducted: amount,
      trustScore: newScore,
      trustTier: getTrustTier(newScore),
    };
  } catch (error) {
    console.error('Lỗi khi trừ điểm uy tín:', error.message);
    return null;
  }
}

/**
 * Hoàn lại điểm uy tín khi kháng cáo thành công (Appeal Approved)
 */
export async function refundTrustPoints({ pool, userId, amount = 20, reason = 'Kháng cáo thành công, minh oan nội dung', contentId = null }) {
  if (!pool || !userId || !amount || amount <= 0) return null;

  try {
    const updateRes = await pool.query(
      `UPDATE users
       SET trust_score = LEAST(100, COALESCE(trust_score, 100) + $1),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, trust_score`,
      [amount, userId]
    );

    const user = updateRes.rows[0];
    if (!user) return null;

    const newScore = Number(user.trust_score);

    await pool.query(
      `INSERT INTO user_trust_logs (user_id, change_amount, new_score, reason, action_type, content_id)
       VALUES ($1, $2, $3, $4, 'appeal_refund', $5)`,
      [userId, amount, newScore, reason, contentId]
    );

    try {
      await pool.query(
        `INSERT INTO notifications (recipient_id, actor_id, type, content, target_post_id)
         VALUES ($1, $2, 'ai_moderation', $3, $4)`,
        [
          userId,
          null,
          `Kháng cáo thành công! Bạn đã được hoàn lại ${amount} điểm uy tín. Điểm hiện tại: ${newScore}/100.`,
          contentId ? Number(String(contentId).replace(/\D/g, '')) || null : null
        ]
      );
    } catch (notifErr) {
      console.warn('Không thể gửi thông báo hoàn điểm:', notifErr.message);
    }

    return {
      userId,
      refunded: amount,
      trustScore: newScore,
      trustTier: getTrustTier(newScore),
    };
  } catch (error) {
    console.error('Lỗi khi hoàn điểm uy tín:', error.message);
    return null;
  }
}

/**
 * Tự động hồi phục điểm uy tín nếu người dùng sinh hoạt lành mạnh (Mỗi 3 ngày +3 điểm)
 */
export async function checkAndRecoverTrustScore({ pool, userId }) {
  if (!pool || !userId) return null;

  try {
    const userRes = await pool.query(
      `SELECT id, trust_score, last_trust_recovery_at,
              COALESCE(trust_score, 100) AS current_score
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = userRes.rows[0];
    if (!user) return null;

    const currentScore = Number(user.current_score);
    if (currentScore >= 100) return { trustScore: 100, recovered: false };

    // Kiểm tra thời gian từ lần hồi phục cuối
    const lastRecovery = user.last_trust_recovery_at ? new Date(user.last_trust_recovery_at) : new Date(0);
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const now = new Date();

    if (now - lastRecovery < threeDaysMs) {
      return { trustScore: currentScore, recovered: false };
    }

    // Kiểm tra xem trong 3 ngày qua có bị trừ điểm lần nào không
    const violationCheck = await pool.query(
      `SELECT id FROM user_trust_logs
       WHERE user_id = $1 AND change_amount < 0 AND created_at > $2
       LIMIT 1`,
      [userId, lastRecovery.toISOString()]
    );

    if (violationCheck.rows.length > 0) {
      // Có vi phạm -> Cập nhật lại mốc thời gian bắt đầu tính 3 ngày mới
      await pool.query(`UPDATE users SET last_trust_recovery_at = CURRENT_TIMESTAMP WHERE id = $1`, [userId]);
      return { trustScore: currentScore, recovered: false };
    }

    // Hồi phục +3 điểm
    const updateRes = await pool.query(
      `UPDATE users
       SET trust_score = LEAST(100, COALESCE(trust_score, 100) + 3),
           last_trust_recovery_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING trust_score`,
      [userId]
    );

    const newScore = Number(updateRes.rows[0]?.trust_score || currentScore);

    await pool.query(
      `INSERT INTO user_trust_logs (user_id, change_amount, new_score, reason, action_type)
       VALUES ($1, 3, $2, 'Hồi phục điểm uy tín sau 3 ngày sinh hoạt lành mạnh', 'periodic_recovery')`,
      [userId, newScore]
    );

    return { trustScore: newScore, recovered: true, added: 3 };
  } catch (error) {
    console.error('Lỗi khi kiểm tra hồi phục điểm uy tín:', error.message);
    return null;
  }
}

/**
 * Lấy lịch sử biến động điểm uy tín của người dùng
 */
export async function getUserTrustHistory({ pool, userId, limit = 20 }) {
  if (!pool || !userId) return [];

  try {
    const res = await pool.query(
      `SELECT id, change_amount, new_score, reason, action_type, content_id, created_at
       FROM user_trust_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return res.rows;
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử điểm uy tín:', error.message);
    return [];
  }
}

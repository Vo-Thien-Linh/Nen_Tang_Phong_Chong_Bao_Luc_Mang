import { refundTrustPoints } from '../services/trustScoreService.js';
import { appealsStore, aiOverrideLogsStore } from './memoryStore.js';

export function createAppealRepository({ pool }) {
  return {
    /**
     * Lấy danh sách toàn bộ khiếu nại
     */
    async findAllAppeals() {
      if (pool) {
        try {
          const q = `
            SELECT a.id, a.user_id, a.content_type, a.content_id, a.original_text,
                   a.ai_predicted_label, a.ai_confidence, a.ai_action_taken,
                   a.appeal_reason, a.status, a.admin_notes, a.created_at,
                   u.full_name AS user_name, u.avatar_url AS user_avatar, u.username,
                   COALESCE(p.image_url, c.image_url) AS image_url
            FROM appeals a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN posts p ON a.content_type = 'post' AND a.content_id = p.id
            LEFT JOIN comments c ON a.content_type = 'comment' AND a.content_id = c.id
            ORDER BY CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END, a.created_at DESC
          `;
          const result = await pool.query(q);
          return result.rows.map(row => ({
            id: String(row.id),
            user: {
              id: row.user_id,
              name: row.user_name || 'Người dùng',
              avatar: row.user_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
              username: row.username || 'user'
            },
            contentType: row.content_type,
            contentId: String(row.content_id),
            originalText: row.original_text,
            imageUrl: row.image_url || null,
            aiPredictedLabel: row.ai_predicted_label,
            aiConfidence: Number(row.ai_confidence) || 0.90,
            aiActionTaken: row.ai_action_taken,
            appealReason: row.appeal_reason,
            status: row.status,
            adminNotes: row.admin_notes || '',
            createdAt: new Date(row.created_at).toLocaleString('vi-VN')
          }));
        } catch (err) {
          console.warn('Lỗi lấy appeals từ DB PostgreSQL, chuyển sang in-memory:', err.message);
        }
      }
      return appealsStore;
    },

    /**
     * Gửi khiếu nại mới
     */
    async createAppeal({ userId, user, contentType, contentId, originalText, aiPredictedLabel, aiConfidence, aiActionTaken, appealReason }) {
      if (pool) {
        try {
          let finalUserId = userId;
          if (!finalUserId) {
            const uRes = await pool.query('SELECT id FROM users LIMIT 1');
            if (uRes.rows.length > 0) finalUserId = uRes.rows[0].id;
          }

          if (finalUserId) {
            const numContentId = parseInt(String(contentId || '1').replace(/\D/g, ''), 10) || 1;
            const validContentType = ['post', 'comment', 'message'].includes(contentType) ? contentType : 'post';
            const insertSql = `
              INSERT INTO appeals (user_id, content_type, content_id, original_text, ai_predicted_label, ai_confidence, ai_action_taken, appeal_reason, status)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
              RETURNING *
            `;
            const result = await pool.query(insertSql, [
              finalUserId,
              validContentType,
              numContentId,
              originalText || 'Nội dung khiếu nại',
              aiPredictedLabel || 'Toxic',
              Number(aiConfidence) || 0.90,
              aiActionTaken || 'warn_user',
              appealReason || 'Tôi khiếu nại phán quyết AI.'
            ]);
            const dbAppeal = result.rows[0];
            return {
              fromDb: true,
              data: {
                id: String(dbAppeal.id),
                user: user || { id: finalUserId, name: 'Người khiếu nại' },
                contentType: dbAppeal.content_type,
                contentId: String(dbAppeal.content_id),
                originalText: dbAppeal.original_text,
                aiPredictedLabel: dbAppeal.ai_predicted_label,
                aiConfidence: Number(dbAppeal.ai_confidence),
                aiActionTaken: dbAppeal.ai_action_taken,
                appealReason: dbAppeal.appeal_reason,
                status: dbAppeal.status,
                adminNotes: '',
                createdAt: 'Vừa xong'
              }
            };
          }
        } catch (dbErr) {
          console.warn('Lỗi lưu khiếu nại vào PostgreSQL, dùng in-memory store:', dbErr.message);
        }
      }

      const newAppeal = {
        id: `app-${Date.now()}`,
        user: user || { name: 'Người khiếu nại', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400' },
        contentType: contentType || 'post',
        contentId: contentId || 'item-id',
        originalText: originalText || '',
        aiPredictedLabel: aiPredictedLabel || 'Toxic',
        aiConfidence: aiConfidence || 0.90,
        aiActionTaken: aiActionTaken || 'warn_user',
        appealReason: appealReason || 'Tôi khiếu nại phán quyết AI.',
        status: 'pending',
        adminNotes: '',
        createdAt: 'Vừa xong'
      };

      appealsStore.unshift(newAppeal);
      return { fromDb: false, data: newAppeal };
    },

    /**
     * Xử lý giải quyết khiếu nại (Transaction an toàn với FOR UPDATE)
     */
    async resolveAppeal({ id, status, adminNotes, newLabel, reviewerId, reviewerName }) {
      const VALID_LABELS = ['Normal', 'Toxic', 'Hate Speech', 'Violence'];
      const finalNewLabel = status === 'approved' ? (newLabel || 'Normal') : null;

      const numId = parseInt(id, 10);
      let updatedAppeal = null;
      let createdOverrideLog = null;

      if (pool && !isNaN(numId)) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const checkRes = await client.query('SELECT * FROM appeals WHERE id = $1 FOR UPDATE', [numId]);
          if (checkRes.rows.length === 0) {
            await client.query('ROLLBACK');
            const err = new Error('Đơn khiếu nại không tồn tại.');
            err.statusCode = 404;
            throw err;
          }

          const dbApp = checkRes.rows[0];

          if (dbApp.status !== 'pending') {
            await client.query('ROLLBACK');
            const statusText = dbApp.status === 'approved' ? 'đã chấp thuận' : 'đã từ chối';
            const err = new Error(`Khiếu nại này đã được xử lý trước đó (${statusText}).`);
            err.statusCode = 409;
            throw err;
          }

          const updateSql = `
            UPDATE appeals
            SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = $4 AND status = 'pending'
            RETURNING *
          `;
          const result = await client.query(updateSql, [status, adminNotes || '', reviewerId, numId]);
          if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            const err = new Error('Khiếu nại này đã được xử lý trước đó bởi người khác.');
            err.statusCode = 409;
            throw err;
          }

          const updatedRow = result.rows[0];
          updatedAppeal = {
            id: String(updatedRow.id),
            userId: updatedRow.user_id,
            contentType: updatedRow.content_type,
            contentId: String(updatedRow.content_id),
            originalText: updatedRow.original_text,
            aiPredictedLabel: updatedRow.ai_predicted_label,
            aiConfidence: Number(updatedRow.ai_confidence),
            status: updatedRow.status,
            adminNotes: updatedRow.admin_notes,
            newLabel: finalNewLabel,
            oldLabel: updatedRow.ai_predicted_label
          };

          if (status === 'rejected') {
            if (updatedRow.user_id) {
              await client.query(
                `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
                 VALUES ($1, $2, 'system', 'Khiếu nại của bạn về nội dung vi phạm đã bị từ chối sau khi xem xét lại.', FALSE)`,
                [updatedRow.user_id, reviewerId]
              );
            }
          } else if (status === 'approved') {
            if (finalNewLabel === 'Normal') {
              if (updatedRow.content_type === 'post') {
                await client.query(
                  `UPDATE posts 
                   SET ai_status = 'approved', ai_label = 'Normal',
                       image_moderation_status = 'approved', image_moderation_label = 'safe'
                   WHERE id = $1`,
                  [updatedRow.content_id]
                );
              } else if (updatedRow.content_type === 'comment') {
                await client.query(
                  `UPDATE comments 
                   SET is_hidden = FALSE, ai_label = 'Normal',
                       image_moderation_status = 'approved', image_moderation_label = 'safe'
                   WHERE id = $1`,
                  [updatedRow.content_id]
                );
              }

              if (updatedRow.user_id) {
                await client.query(
                  `UPDATE users 
                   SET status = 'active', 
                       cooldown_until = NULL, 
                       cooldown_reason = NULL, 
                       cooldown_violation_text = NULL,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1`,
                  [updatedRow.user_id]
                );

                await client.query(
                  `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
                   VALUES ($1, $2, 'system', 'Khiếu nại được chấp thuận! Nội dung của bạn đã được xác nhận an toàn (Normal). Toàn bộ án phạt (cooldown/hạn chế) đã được gỡ bỏ.', FALSE)`,
                  [updatedRow.user_id, reviewerId]
                );

                try {
                  const refundMap = { 'Toxic': 5, 'Hate Speech': 20, 'Violence': 35 };
                  let refundAmount = refundMap[updatedRow.ai_predicted_label] || 20;

                  // Tra cứu trong user_trust_logs xem trước đó nội dung này bị trừ chính xác bao nhiêu điểm
                  if (updatedRow.content_id) {
                    try {
                      const logCheck = await client.query(
                        `SELECT change_amount FROM user_trust_logs 
                         WHERE user_id = $1 AND content_id = $2 AND change_amount < 0 
                         ORDER BY created_at DESC LIMIT 1`,
                        [updatedRow.user_id, updatedRow.content_id]
                      );
                      if (logCheck.rows.length > 0) {
                        refundAmount = Math.abs(Number(logCheck.rows[0].change_amount));
                      }
                    } catch (lookupErr) {
                      console.warn('Lỗi tra cứu log điểm phạt cũ:', lookupErr.message);
                    }
                  }

                  await refundTrustPoints({
                    pool: client,
                    userId: updatedRow.user_id,
                    amount: refundAmount,
                    reason: `Kháng cáo thành công, minh oan nội dung (${updatedRow.ai_predicted_label || 'Vi phạm'})`,
                    contentId: updatedRow.content_id,
                  });
                } catch (trustErr) {
                  console.error('Lỗi hoàn điểm uy tín khi duyệt kháng cáo:', trustErr.message);
                }
              }
            } else if (finalNewLabel === 'Violence') {
              if (updatedRow.content_type === 'post') {
                await client.query(
                  `UPDATE posts SET ai_status = 'hidden', ai_label = 'Violence' WHERE id = $1`,
                  [updatedRow.content_id]
                );
              } else if (updatedRow.content_type === 'comment') {
                await client.query(
                  `UPDATE comments SET is_hidden = TRUE, ai_label = 'Violence' WHERE id = $1`,
                  [updatedRow.content_id]
                );
              }

              if (updatedRow.user_id) {
                await client.query(
                  `UPDATE users 
                   SET status = 'cooldown', 
                       cooldown_until = CURRENT_TIMESTAMP + INTERVAL '10 minutes', 
                       cooldown_reason = 'Vi phạm bạo lực trong nội dung (Khiếu nại được thẩm định lại)',
                       cooldown_violation_text = $1,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = $2`,
                  [updatedRow.original_text, updatedRow.user_id]
                );

                await client.query(
                  `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
                   VALUES ($1, $2, 'system', 'Nội dung của bạn sau khi thẩm định lại bị xác định vi phạm Bạo lực (Violence). Bạn bị tạm khóa 10 phút.', FALSE)`,
                  [updatedRow.user_id, reviewerId]
                );
              }
            } else {
              if (updatedRow.content_type === 'post') {
                await client.query(
                  `UPDATE posts SET ai_status = 'hidden', ai_label = $1 WHERE id = $2`,
                  [finalNewLabel, updatedRow.content_id]
                );
              } else if (updatedRow.content_type === 'comment') {
                await client.query(
                  `UPDATE comments SET is_hidden = TRUE, ai_label = $1 WHERE id = $2`,
                  [finalNewLabel, updatedRow.content_id]
                );
              }

              if (updatedRow.user_id) {
                await client.query(
                  `UPDATE users 
                   SET status = 'active', 
                       cooldown_until = NULL, 
                       cooldown_reason = NULL, 
                       cooldown_violation_text = NULL,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = $1 AND status = 'cooldown'`,
                  [updatedRow.user_id]
                );

                const notifMsg = finalNewLabel === 'Hate Speech'
                  ? 'Nội dung của bạn sau khi xem xét lại được phân loại là Ngôn từ thù ghét (Hate Speech) và đã bị ẩn.'
                  : 'Nội dung của bạn sau khi xem xét lại được phân loại là Độc hại (Toxic) và đã bị giới hạn hiển thị.';
                await client.query(
                  `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
                   VALUES ($1, $2, 'system', $3, FALSE)`,
                  [updatedRow.user_id, reviewerId, notifMsg]
                );
              }
            }

            const overrideRes = await client.query(
              `INSERT INTO ai_override_logs (admin_id, content_type, content_id, raw_text, original_ai_label, original_confidence, corrected_label, override_reason)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING *`,
              [
                reviewerId,
                updatedRow.content_type,
                updatedRow.content_id,
                updatedRow.original_text,
                updatedRow.ai_predicted_label,
                Number(updatedRow.ai_confidence) || 0.90,
                finalNewLabel,
                adminNotes || (finalNewLabel === 'Normal'
                  ? `Chấp thuận khiếu nại: Minh oan và khôi phục nội dung: ${updatedRow.appeal_reason}`
                  : `Chấp thuận khiếu nại: Hiệu chỉnh nhãn sang ${finalNewLabel}`)
              ]
            );
            if (overrideRes.rows.length > 0) {
              const oRow = overrideRes.rows[0];
              createdOverrideLog = {
                id: String(oRow.id),
                adminName: reviewerName || 'Điều Hành Viên Hệ Thống',
                contentType: oRow.content_type,
                contentId: String(oRow.content_id),
                rawText: oRow.raw_text,
                originalAiLabel: oRow.original_ai_label,
                originalConfidence: Number(oRow.original_confidence) || 0.90,
                correctedLabel: oRow.corrected_label,
                overrideReason: oRow.override_reason,
                isExportedForRetraining: oRow.is_exported_for_retraining,
                createdAt: new Date(oRow.created_at).toLocaleString('vi-VN')
              };
            }
          }

          await client.query('COMMIT');
        } catch (dbErr) {
          await client.query('ROLLBACK');
          if (dbErr.statusCode) throw dbErr;
          console.error('Lỗi transaction xử lý khiếu nại trong PostgreSQL:', dbErr.message);
          const err = new Error('Lỗi máy chủ khi xử lý khiếu nại: ' + dbErr.message);
          err.statusCode = 500;
          throw err;
        } finally {
          client.release();
        }
      }

      // 4. Đồng bộ in-memory store
      const appeal = appealsStore.find(a => String(a.id) === String(id));
      if (appeal) {
        if (appeal.status !== 'pending' && !updatedAppeal) {
          const err = new Error(`Khiếu nại này đã được xử lý trước đó (${appeal.status === 'approved' ? 'đã chấp thuận' : 'đã từ chối'}).`);
          err.statusCode = 409;
          throw err;
        }
        appeal.status = status;
        if (adminNotes !== undefined) appeal.adminNotes = adminNotes;
        appeal.newLabel = finalNewLabel;
      }

      if (status === 'approved' && !createdOverrideLog) {
        createdOverrideLog = {
          id: `ovr-${Date.now()}`,
          adminName: reviewerName || 'Điều Hành Viên Hệ Thống',
          contentType: appeal?.contentType || updatedAppeal?.contentType || 'post',
          contentId: appeal?.contentId || updatedAppeal?.contentId || id,
          rawText: appeal?.originalText || updatedAppeal?.originalText || '',
          originalAiLabel: appeal?.aiPredictedLabel || updatedAppeal?.aiPredictedLabel || 'Toxic',
          originalConfidence: appeal?.aiConfidence || 0.90,
          correctedLabel: finalNewLabel,
          overrideReason: adminNotes || (finalNewLabel === 'Normal' ? 'Chấp thuận khiếu nại: Minh oan và khôi phục nội dung' : `Chấp thuận khiếu nại: Gán lại nhãn ${finalNewLabel}`),
          isExportedForRetraining: false,
          createdAt: new Date().toLocaleString('vi-VN')
        };
      }

      if (createdOverrideLog) {
        aiOverrideLogsStore.unshift(createdOverrideLog);
      }

      return {
        appeal: updatedAppeal || appeal,
        createdOverrideLog,
        finalNewLabel,
      };
    }
  };
}


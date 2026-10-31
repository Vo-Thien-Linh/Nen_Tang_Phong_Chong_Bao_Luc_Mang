import { refundTrustPoints, applyTrustPenalty, calculateTrustDeduction } from '../services/trustScoreService.js';
import { restoreReportedTextModeration } from '../services/reportDismissal.js';
import { reportsStore, aiOverrideLogsStore } from './memoryStore.js';

function normalizeReportImageLabel(lbl, status) {
  const s = String(lbl || '').toLowerCase();
  const st = String(status || '').toLowerCase();
  if (s === 'violence' || st.includes('reject')) return 'Violence';
  if (s === 'nsfw' || st === 'sensitive') return 'NSFW';
  return 'Clean';
}

export function createReportRepository({ pool }) {
  return {
    /**
     * Lấy danh sách báo cáo
     */
    async findAllReports() {
      if (pool) {
        try {
          const q = `
            SELECT r.id, r.reporter_id, r.target_type, r.target_id, r.reason, r.details, r.status, r.admin_notes, r.action_taken, r.created_at, r.target_modality,
                   u.full_name AS reporter_name, u.avatar_url AS reporter_avatar,
                   p.content AS post_content, p.image_url AS post_image, p.ai_label AS post_ai_label,
                   p.image_moderation_label AS post_image_label, p.image_moderation_status AS post_image_status,
                   c.content AS comment_content, c.image_url AS comment_image, c.ai_label AS comment_ai_label,
                   c.image_moderation_label AS comment_image_label, c.image_moderation_status AS comment_image_status,
                   author.full_name AS target_author_name, author.username AS target_author_username
            FROM reports r
            LEFT JOIN users u ON r.reporter_id = u.id
            LEFT JOIN posts p ON r.target_type = 'post' AND r.target_id = p.id
            LEFT JOIN comments c ON r.target_type = 'comment' AND r.target_id = c.id
            LEFT JOIN users author ON (
              (r.target_type = 'post' AND p.author_id = author.id) OR
              (r.target_type = 'comment' AND c.author_id = author.id)
            )
            ORDER BY r.created_at DESC
          `;
          const result = await pool.query(q);
          return result.rows.map(row => {
            const textContent = row.target_type === 'post' ? row.post_content : row.comment_content;
            const img = row.target_type === 'post' ? row.post_image : row.comment_image;
            const currentAiLabel = row.target_type === 'post' ? (row.post_ai_label || 'Normal') : (row.comment_ai_label || 'Normal');
            const rawImgLabel = row.target_type === 'post' ? row.post_image_label : row.comment_image_label;
            const rawImgStatus = row.target_type === 'post' ? row.post_image_status : row.comment_image_status;
            const currentImageLabel = img ? normalizeReportImageLabel(rawImgLabel, rawImgStatus) : null;

            return {
              id: String(row.id),
              reporter: {
                id: row.reporter_id,
                name: row.reporter_name || 'Người dùng',
                avatar: row.reporter_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200'
              },
              targetType: row.target_type,
              targetId: String(row.target_id),
              targetAuthor: {
                name: row.target_author_name || 'Người dùng',
                username: row.target_author_username || 'user'
              },
              contentExcerpt: textContent || '',
              targetExcerpt: textContent || '',
              imageUrl: img || null,
              targetModality: row.target_modality || (img ? 'both' : 'text'),
              textLabel: currentAiLabel,
              imageLabel: currentImageLabel || (img ? 'Clean' : null),
              reason: row.reason,
              reasonLabel: row.reason === 'toxic' ? 'Độc hại / Xúc phạm' : row.reason === 'hate_speech' ? 'Ngôn từ thù ghét' : row.reason === 'violence' ? 'Bạo lực / Đe dọa' : row.reason === 'nsfw' ? 'Hình ảnh nhạy cảm (NSFW)' : 'Nội dung vi phạm',
              details: row.details || '',
              status: row.status,
              adminNotes: row.admin_notes || '',
              actionTaken: row.action_taken,
              createdAt: new Date(row.created_at).toLocaleString('vi-VN'),
              aiStatus: {
                label: currentAiLabel,
                textLabel: currentAiLabel,
                imageLabel: currentImageLabel || (img ? 'Clean' : null),
                confidence: 0.95
              }
            };
          });
        } catch (err) {
          console.warn('Lỗi lấy báo cáo từ DB PostgreSQL, chuyển sang dữ liệu bộ nhớ:', err.message);
        }
      }
      return reportsStore;
    },

    /**
     * Tạo báo cáo vi phạm mới
     */
    async createReport({ reporterId, reporter, targetType, targetId, targetAuthor, contentExcerpt, reason, reasonLabel, details, targetModality }) {
      const modality = targetModality || 'both';
      if (pool) {
        try {
          let finalReporterId = reporterId;
          if (!finalReporterId) {
            const uRes = await pool.query('SELECT id FROM users LIMIT 1');
            if (uRes.rows.length > 0) finalReporterId = uRes.rows[0].id;
          }

          if (finalReporterId) {
            const numTargetId = parseInt(String(targetId || '1').replace(/\D/g, ''), 10) || 1;
            const validReason = ['toxic', 'hate_speech', 'violence', 'nsfw', 'harassment', 'spam', 'misinformation', 'other'].includes(reason) 
              ? reason 
              : 'toxic';

            const insertQuery = `
              INSERT INTO reports (reporter_id, target_type, target_id, reason, details, status, target_modality)
              VALUES ($1, $2, $3, $4, $5, 'pending', $6)
              ON CONFLICT (reporter_id, target_type, target_id) 
              DO UPDATE SET details = EXCLUDED.details, reason = EXCLUDED.reason, status = 'pending', target_modality = EXCLUDED.target_modality
              RETURNING *
            `;
            const result = await pool.query(insertQuery, [finalReporterId, targetType || 'post', numTargetId, validReason, details || '', modality]);
            const dbReport = result.rows[0];
            return {
              fromDb: true,
              data: {
                id: String(dbReport.id),
                reporter: reporter || { id: finalReporterId, name: 'Người dùng' },
                targetType: dbReport.target_type,
                targetId: String(dbReport.target_id),
                targetAuthor: targetAuthor || { name: 'Người dùng' },
                contentExcerpt: contentExcerpt || '',
                targetExcerpt: contentExcerpt || '',
                imageUrl: null,
                targetModality: dbReport.target_modality || modality,
                reason: dbReport.reason,
                reasonLabel: reasonLabel || 'Nội dung vi phạm',
                details: dbReport.details,
                status: dbReport.status,
                createdAt: 'Vừa xong',
                aiStatus: { label: 'Normal', confidence: 0.95 }
              }
            };
          }
        } catch (dbErr) {
          console.warn('Lỗi lưu báo cáo vào PostgreSQL, chuyển lưu bộ nhớ tạm:', dbErr.message);
        }
      }

      const newReport = {
        id: `rep-${Date.now()}`,
        reporter: reporter || { name: 'Người dùng', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200' },
        targetType: targetType || 'post',
        targetId: targetId || 'target-id',
        targetAuthor: targetAuthor || { name: 'Người dùng vi phạm' },
        contentExcerpt: contentExcerpt || 'Nội dung báo cáo...',
        targetExcerpt: contentExcerpt || 'Nội dung báo cáo...',
        imageUrl: null,
        targetModality: modality,
        reason: reason || 'other',
        reasonLabel: reasonLabel || 'Lý do khác',
        details: details || '',
        status: 'pending',
        adminNotes: '',
        createdAt: 'Vừa xong',
        aiStatus: { label: 'Normal', confidence: 0.85 }
      };

      reportsStore.unshift(newReport);
      return { fromDb: false, data: newReport };
    },

    /**
     * Tìm author_id theo target_type và target_id
     */
    async findTargetAuthorId(targetType, targetId) {
      if (!pool) return null;
      try {
        if (targetType === 'post') {
          const pRes = await pool.query('SELECT author_id FROM posts WHERE id = $1', [targetId]);
          if (pRes.rows.length > 0) return pRes.rows[0].author_id;
        } else if (targetType === 'comment') {
          const cRes = await pool.query('SELECT author_id FROM comments WHERE id = $1', [targetId]);
          if (cRes.rows.length > 0) return cRes.rows[0].author_id;
        } else if (targetType === 'message') {
          const mRes = await pool.query('SELECT sender_id AS author_id FROM messages WHERE id = $1', [targetId]);
          if (mRes.rows.length > 0) return mRes.rows[0].author_id;
        }
      } catch (err) {
        console.warn('Lỗi tìm authorId mục báo cáo:', err.message);
      }
      return null;
    },

    /**
     * Xử lý báo cáo (cập nhật DB và in-memory store)
     * Quy tắc 2: Chỉ ghi nhật ký ai_override_logs cho phần nào có nhãn thay đổi
     */
    async updateReportStatus({
      id,
      status,
      adminNotes,
      newLabel,
      oldLabel,
      newImageLabel,
      oldImageLabel,
      textAction,
      imageAction,
      reviewerId,
      rawText
    }) {
      const finalNewLabel = newLabel || textAction?.newLabel || 'Toxic';
      const finalOldLabel = oldLabel || textAction?.oldLabel || 'Normal';
      const finalNewImageLabel = newImageLabel || imageAction?.newLabel || null;
      const finalOldImageLabel = oldImageLabel || imageAction?.oldLabel || null;

      const isTextChanged = (textAction && textAction.changed !== undefined)
        ? Boolean(textAction.changed)
        : (finalNewLabel !== finalOldLabel);
      const isImageChanged = (imageAction && imageAction.changed !== undefined)
        ? Boolean(imageAction.changed)
        : Boolean(finalNewImageLabel && finalOldImageLabel && finalNewImageLabel !== finalOldImageLabel);

      const actionTaken = status === 'resolved_violation' ? 'relabel_and_hide' : 'dismissed_keep_original_label';

      let report = null;
      const createdOverrideLogs = [];

      // 1. Cập nhật trong PostgreSQL
      if (pool) {
        try {
          const numId = parseInt(id, 10);
          if (!isNaN(numId)) {
            const updateReportSql = `
              UPDATE reports 
              SET status = $1, admin_notes = $2, action_taken = $3, reviewed_by = $4, reviewed_at = CURRENT_TIMESTAMP
              WHERE id = $5
              RETURNING *
            `;
            const repRes = await pool.query(updateReportSql, [status, adminNotes || '', actionTaken, reviewerId, numId]);
            if (repRes.rows.length > 0) {
              const dbRep = repRes.rows[0];
              report = {
                id: String(dbRep.id),
                targetType: dbRep.target_type,
                targetId: String(dbRep.target_id),
                status: dbRep.status,
                adminNotes: dbRep.admin_notes,
                newLabel: finalNewLabel,
                oldLabel: finalOldLabel,
                newImageLabel: finalNewImageLabel,
                oldImageLabel: finalOldImageLabel,
                actionTaken
              };

              const targetAuthorId = await this.findTargetAuthorId(dbRep.target_type, dbRep.target_id);

              if (status === 'resolved_violation') {
                const isAllClean = finalNewLabel === 'Normal' && (!finalNewImageLabel || finalNewImageLabel === 'Clean');
                const isViolence = finalNewLabel === 'Violence' || finalNewImageLabel === 'Violence';

                if (isAllClean) {
                  // Phục hồi nội dung
                  if (dbRep.target_type === 'post') {
                    await pool.query(
                      `UPDATE posts 
                       SET ai_label = 'Normal', ai_status = 'approved',
                           image_moderation_status = 'approved', image_moderation_label = 'safe'
                       WHERE id = $1`,
                      [dbRep.target_id]
                    );
                  } else if (dbRep.target_type === 'comment') {
                    await pool.query(
                      `UPDATE comments 
                       SET ai_label = 'Normal', is_hidden = FALSE,
                           image_moderation_status = 'approved', image_moderation_label = 'safe'
                       WHERE id = $1`,
                      [dbRep.target_id]
                    );
                  }

                  // Gỡ phạt người dùng
                  if (targetAuthorId) {
                    await pool.query(
                      `UPDATE users 
                       SET status = 'active', 
                           cooldown_until = NULL, 
                           cooldown_reason = NULL, 
                           cooldown_violation_text = NULL,
                           updated_at = CURRENT_TIMESTAMP
                       WHERE id = $1`,
                      [targetAuthorId]
                    );

                    await pool.query(
                      `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
                       VALUES ($1, $2, 'system', 'Nội dung của bạn đã được thẩm định an toàn (Normal). Toàn bộ giới hạn và án phạt đã được gỡ bỏ.', FALSE)`,
                      [targetAuthorId, reviewerId]
                    );

                    try {
                      const refundMap = { 'Toxic': 5, 'Hate Speech': 20, 'Violence': 35 };
                      let refundAmount = refundMap[finalOldLabel] || 20;

                      // Tra cứu log phạt gần nhất nếu có trong DB để hoàn đúng 100%
                      if (dbRep.target_id) {
                        try {
                          const logCheck = await pool.query(
                            `SELECT change_amount FROM user_trust_logs 
                             WHERE user_id = $1 AND content_id = $2 AND change_amount < 0 
                             ORDER BY created_at DESC LIMIT 1`,
                            [targetAuthorId, String(dbRep.target_id)]
                          );
                          if (logCheck.rows.length > 0) {
                            refundAmount = Math.abs(Number(logCheck.rows[0].change_amount));
                          }
                        } catch (lookupErr) {
                          console.warn('Lỗi tra cứu log điểm phạt cũ:', lookupErr.message);
                        }
                      }

                      await refundTrustPoints({
                        pool,
                        userId: targetAuthorId,
                        amount: refundAmount,
                        reason: `Báo cáo được thẩm định an toàn (Normal - hoàn lại điểm phạt ${finalOldLabel || 'cũ'})`,
                        contentId: dbRep.target_id,
                      });
                    } catch (trustErr) {
                      console.error('Lỗi hoàn điểm uy tín khi gỡ phạt báo cáo:', trustErr.message);
                    }
                  }
                } else {
                  // Có vi phạm: Cập nhật nhãn và ẩn nội dung
                  const dbImgLabel = finalNewImageLabel === 'Clean' ? 'safe' : (finalNewImageLabel ? finalNewImageLabel.toLowerCase() : null);
                  const dbImgStatus = finalNewImageLabel === 'Violence' ? 'rejected_admin' : (finalNewImageLabel === 'NSFW' ? 'sensitive' : 'safe');

                  if (dbRep.target_type === 'post') {
                    if (isImageChanged && finalNewImageLabel) {
                      await pool.query(
                        `UPDATE posts SET ai_label = $1, ai_status = 'hidden', image_moderation_label = $2, image_moderation_status = $3 WHERE id = $4`,
                        [finalNewLabel, dbImgLabel, dbImgStatus, dbRep.target_id]
                      );
                    } else {
                      await pool.query(
                        `UPDATE posts SET ai_label = $1, ai_status = 'hidden' WHERE id = $2`,
                        [finalNewLabel, dbRep.target_id]
                      );
                    }
                  } else if (dbRep.target_type === 'comment') {
                    const isCommentSoft = (finalNewLabel === 'Toxic' || finalNewImageLabel === 'NSFW') && !isViolence && finalNewLabel !== 'Hate Speech';
                    const isHiddenVal = !isCommentSoft;
                    const isSoftHiddenVal = Boolean(isCommentSoft);
                    const commentAiStatus = isHiddenVal ? 'hidden' : 'approved';

                    if (isImageChanged && finalNewImageLabel) {
                      await pool.query(
                        `UPDATE comments SET ai_label = $1, is_hidden = $2, is_soft_hidden = $3, ai_status = $4, image_moderation_label = $5, image_moderation_status = $6 WHERE id = $7`,
                        [finalNewLabel, isHiddenVal, isSoftHiddenVal, commentAiStatus, dbImgLabel, dbImgStatus, dbRep.target_id]
                      );
                    } else {
                      await pool.query(
                        `UPDATE comments SET ai_label = $1, is_hidden = $2, is_soft_hidden = $3, ai_status = $4 WHERE id = $5`,
                        [finalNewLabel, isHiddenVal, isSoftHiddenVal, commentAiStatus, dbRep.target_id]
                      );
                    }
                  }

                  if (isViolence && targetAuthorId) {
                    await pool.query(
                      `UPDATE users 
                       SET status = 'cooldown', 
                           cooldown_until = CURRENT_TIMESTAMP + INTERVAL '10 minutes', 
                           cooldown_reason = 'Vi phạm bạo lực trong nội dung (Báo cáo vi phạm đã được xác minh)',
                           cooldown_violation_text = $1,
                           updated_at = CURRENT_TIMESTAMP
                       WHERE id = $2`,
                      [rawText || dbRep.details || 'Nội dung bạo lực', targetAuthorId]
                    );

                    await pool.query(
                      `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
                       VALUES ($1, $2, 'system', 'Nội dung của bạn bị báo cáo vi phạm Bạo lực và đã bị ẩn. Bạn bị tạm khóa 10 phút.', FALSE)`,
                      [targetAuthorId, reviewerId]
                    );
                  } else if (targetAuthorId) {
                    await pool.query(
                      `UPDATE users 
                       SET status = 'active', 
                           cooldown_until = NULL, 
                           cooldown_reason = NULL, 
                           cooldown_violation_text = NULL,
                           updated_at = CURRENT_TIMESTAMP
                       WHERE id = $1 AND status = 'cooldown'`,
                      [targetAuthorId]
                    );

                    const notifMsg = finalNewLabel === 'Hate Speech'
                      ? 'Nội dung của bạn bị báo cáo vi phạm Ngôn từ thù ghét (Hate Speech) và đã bị ẩn.'
                      : 'Nội dung của bạn bị báo cáo vi phạm tiêu chuẩn cộng đồng và đã bị giới hạn hiển thị.';
                    await pool.query(
                      `INSERT INTO notifications (recipient_id, actor_id, type, content, is_read)
                       VALUES ($1, $2, 'system', $3, FALSE)`,
                      [targetAuthorId, reviewerId, notifMsg]
                    );
                  }

                  if (targetAuthorId) {
                    const effectiveImgStatus = finalNewImageLabel === 'Violence' ? 'rejected_admin' : (finalNewImageLabel === 'NSFW' ? 'sensitive' : 'safe');
                    const repDeduction = calculateTrustDeduction(finalNewLabel, effectiveImgStatus);
                    if (repDeduction > 0) {
                      try {
                        await applyTrustPenalty({
                          pool,
                          userId: targetAuthorId,
                          amount: repDeduction,
                          reason: `Bị báo cáo vi phạm tiêu chuẩn cộng đồng: ${finalNewLabel}${finalNewImageLabel ? ` / Ảnh: ${finalNewImageLabel}` : ''}`,
                          actionType: 'report_violation',
                          contentId: dbRep.target_id,
                        });
                      } catch (trustErr) {
                        console.error('Lỗi trừ điểm uy tín khi xử lý báo cáo vi phạm:', trustErr.message);
                      }
                    }
                  }
                }

                // Ghi nhật ký vào ai_override_logs
                // Quy tắc 2: Chỉ ghi cho phần nào có nhãn thay đổi
                if (isTextChanged) {
                  await pool.query(
                    `INSERT INTO ai_override_logs (admin_id, content_type, content_id, raw_text, original_ai_label, original_confidence, corrected_label, override_reason)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                      reviewerId,
                      dbRep.target_type,
                      dbRep.target_id,
                      rawText || dbRep.details || 'Nội dung văn bản từ báo cáo',
                      finalOldLabel,
                      0.95,
                      finalNewLabel,
                      adminNotes || `Xác nhận vi phạm văn bản từ báo cáo #${dbRep.id}: ${finalOldLabel} → ${finalNewLabel}`
                    ]
                  );
                }

                if (isImageChanged && finalNewImageLabel) {
                  let targetImageUrl = null;
                  if (dbRep.target_type === 'post') {
                    const pImgRes = await pool.query('SELECT image_url FROM posts WHERE id = $1', [dbRep.target_id]);
                    targetImageUrl = pImgRes.rows[0]?.image_url;
                  } else if (dbRep.target_type === 'comment') {
                    const cImgRes = await pool.query('SELECT image_url FROM comments WHERE id = $1', [dbRep.target_id]);
                    targetImageUrl = cImgRes.rows[0]?.image_url;
                  }

                  await pool.query(
                    `INSERT INTO ai_override_logs (admin_id, content_type, content_id, raw_text, original_ai_label, original_confidence, corrected_label, override_reason)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                      reviewerId,
                      dbRep.target_type,
                      dbRep.target_id,
                      targetImageUrl || 'Hình ảnh vi phạm từ báo cáo',
                      finalOldImageLabel || 'Clean',
                      0.95,
                      finalNewImageLabel,
                      adminNotes || `Xác nhận vi phạm hình ảnh từ báo cáo #${dbRep.id}: ${finalOldImageLabel || 'Clean'} → ${finalNewImageLabel}`
                    ]
                  );
                }

                // Fallback nếu không có cờ changed cụ thể (legacy callers)
                if (!isTextChanged && !isImageChanged && finalNewLabel) {
                  await pool.query(
                    `INSERT INTO ai_override_logs (admin_id, content_type, content_id, raw_text, original_ai_label, original_confidence, corrected_label, override_reason)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                      reviewerId,
                      dbRep.target_type,
                      dbRep.target_id,
                      rawText || dbRep.details || 'Nội dung vi phạm từ báo cáo',
                      finalOldLabel,
                      0.95,
                      finalNewLabel,
                      adminNotes || `Xác nhận vi phạm từ báo cáo #${dbRep.id}: Gán lại nhãn ${finalNewLabel}`
                    ]
                  );
                }
              } else if (status === 'dismissed') {
                await restoreReportedTextModeration(pool, {
                  targetType: dbRep.target_type,
                  targetId: dbRep.target_id,
                });
              }
            }
          }
        } catch (dbErr) {
          console.warn('Lỗi xử lý báo cáo trong PostgreSQL:', dbErr.message);
        }
      }

      // 2. Đồng bộ trong in-memory store
      const storeReport = reportsStore.find(r => String(r.id) === String(id));
      if (storeReport) {
        storeReport.status = status;
        if (adminNotes !== undefined) storeReport.adminNotes = adminNotes;
        storeReport.newLabel = finalNewLabel;
        storeReport.oldLabel = finalOldLabel;
        storeReport.newImageLabel = finalNewImageLabel;
        storeReport.oldImageLabel = finalOldImageLabel;
        storeReport.actionTaken = actionTaken;
      }

      if (status === 'resolved_violation') {
        if (isTextChanged) {
          const textLog = {
            id: `ovr-txt-${Date.now()}`,
            adminName: 'Điều Hành Viên Hệ Thống',
            contentType: storeReport?.targetType || report?.targetType || 'post',
            contentId: storeReport?.targetId || report?.targetId || id,
            rawText: rawText || storeReport?.contentExcerpt || storeReport?.targetExcerpt || 'Nội dung văn bản vi phạm',
            imageUrl: null,
            originalAiLabel: finalOldLabel,
            originalConfidence: 0.95,
            correctedLabel: finalNewLabel,
            overrideReason: adminNotes || `Xác nhận vi phạm văn bản: ${finalOldLabel} → ${finalNewLabel}`,
            isExportedForRetraining: false,
            createdAt: new Date().toLocaleString('vi-VN')
          };
          createdOverrideLogs.push(textLog);
          aiOverrideLogsStore.unshift(textLog);
        }

        if (isImageChanged && finalNewImageLabel) {
          const imgLog = {
            id: `ovr-img-${Date.now() + 1}`,
            adminName: 'Điều Hành Viên Hệ Thống',
            contentType: storeReport?.targetType || report?.targetType || 'post',
            contentId: storeReport?.targetId || report?.targetId || id,
            rawText: storeReport?.imageUrl || 'Hình ảnh vi phạm',
            imageUrl: storeReport?.imageUrl || null,
            originalAiLabel: finalOldImageLabel || 'Clean',
            originalConfidence: 0.95,
            correctedLabel: finalNewImageLabel,
            overrideReason: adminNotes || `Xác nhận vi phạm hình ảnh: ${finalOldImageLabel || 'Clean'} → ${finalNewImageLabel}`,
            isExportedForRetraining: false,
            createdAt: new Date().toLocaleString('vi-VN')
          };
          createdOverrideLogs.push(imgLog);
          aiOverrideLogsStore.unshift(imgLog);
        }

        if (!isTextChanged && !isImageChanged && finalNewLabel) {
          const fallbackLog = {
            id: `ovr-${Date.now()}`,
            adminName: 'Điều Hành Viên Hệ Thống',
            contentType: storeReport?.targetType || report?.targetType || 'post',
            contentId: storeReport?.targetId || report?.targetId || id,
            rawText: rawText || storeReport?.contentExcerpt || storeReport?.imageUrl || 'Nội dung vi phạm',
            imageUrl: storeReport?.imageUrl || null,
            originalAiLabel: finalOldLabel,
            originalConfidence: 0.95,
            correctedLabel: finalNewLabel,
            overrideReason: adminNotes || `Xác nhận vi phạm: Gán lại nhãn ${finalNewLabel}`,
            isExportedForRetraining: false,
            createdAt: new Date().toLocaleString('vi-VN')
          };
          createdOverrideLogs.push(fallbackLog);
          aiOverrideLogsStore.unshift(fallbackLog);
        }
      }

      return {
        report: report || storeReport,
        overrideLog: createdOverrideLogs[0] || null,
        overrideLogs: createdOverrideLogs,
        finalNewLabel,
      };
    }
  };
}

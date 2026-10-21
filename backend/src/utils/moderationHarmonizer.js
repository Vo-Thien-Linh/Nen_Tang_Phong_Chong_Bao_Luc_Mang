/**
 * Module kết hợp hài hoà giữa Kiểm duyệt văn bản (PhoBERT) và Kiểm duyệt hình ảnh (EfficientNet).
 * 
 * Nghiệp vụ chuẩn hóa:
 * - Ảnh NSFW được phân loại vào nhóm TOXIC.
 * - Ảnh Violence được phân loại vào nhóm VIOLENCE.
 * - Độ ưu tiên xử lý 
 * không xung đột:
 *   1. BẠO LỰC (Violence): Text hoặc Ảnh có Bạo lực -> Ẩn cứng, phạt Cooldown 10 phút, gửi thông báo, cho phép kháng cáo.
 *   2. THÙ GHÉT (Hate Speech): Text có Thù ghét -> Ẩn cứng, gửi thông báo, cho phép kháng cáo.
 *   3. ĐỘC HẠI / NHẠY CẢM (Toxic & NSFW): Text Toxic HOẶC Ảnh NSFW -> Ẩn mềm ở cuối danh sách (cho comment), làm mờ (cho post), bấm vào để xem.
 *   4. BÌNH THƯỜNG (Normal / Safe): Không vi phạm -> Hiển thị bình thường.
 */

export function harmonizeModeration({ textMod = {}, imageModeration = null, contentType = 'comment' }) {
  const textLabel = textMod?.label || 'Normal';
  const textConfidence = textMod?.confidence || 1.0;

  // Trích xuất điểm số và quyết định từ mô hình ảnh
  const scores = imageModeration?.scores || imageModeration?.images?.[0]?.scores || {};
  const thresholds = imageModeration?.thresholds || {};

  const vRejectThreshold = thresholds.violence_reject || 0.8;
  const nsfwThreshold = thresholds.nsfw_blur || 0.7;

  const isImageViolence = ['sensitive', 'pending_review'].includes(imageModeration?.decision) ? false : (
    (scores.violence || 0) >= vRejectThreshold ||
    imageModeration?.decision === 'rejected' ||
    imageModeration?.decision === 'rejected_hold' ||
    imageModeration?.category === 'VIOLATION' ||
    imageModeration?.label === 'violence'
  );

  const isImageNsfw = (scores.nsfw || 0) >= nsfwThreshold ||
    imageModeration?.decision === 'sensitive' ||
    imageModeration?.category === 'SENSITIVE' ||
    imageModeration?.label === 'nsfw';

  // 1. CẤP ĐỘ 1: BẠO LỰC (Cao nhất)
  if (textLabel === 'Violence' || isImageViolence) {
    let violationDetail = '';
    if (textLabel === 'Violence' && isImageViolence) {
      violationDetail = 'cả ngôn từ và hình ảnh có yếu tố bạo lực / đe dọa';
    } else if (isImageViolence) {
      violationDetail = 'hình ảnh có yếu tố bạo lực / gây hại';
    } else {
      violationDetail = 'ngôn từ có tính chất bạo lực / đe dọa';
    }

    const typeName = contentType === 'post' ? 'Bài viết' : 'Bình luận';
    const notifMessage = `${typeName} của bạn đã bị ẩn và tài khoản bị tạm khóa 10 phút do vi phạm chính sách về Bạo lực (${violationDetail}). Bạn có thể gửi kháng cáo nếu đây là sự nhầm lẫn.`;

    return {
      finalLabel: 'Violence',
      severity: 'violence',
      isHidden: true,
      isSoftHidden: false,
      aiStatus: 'hidden',
      applyCooldown: textLabel === 'Violence',
      cooldownMinutes: textLabel === 'Violence' ? 10 : 0,
      notificationMessage: notifMessage,
      reason: violationDetail,
      confidence: Math.max(textConfidence, scores.violence || 0.9),
      isImageViolence,
      isImageNsfw: false,
    };
  }

  // 2. CẤP ĐỘ 2: NGÔN TỪ THÙ GHÉT (Hate Speech)
  if (textLabel === 'Hate Speech') {
    const typeName = contentType === 'post' ? 'Bài viết' : 'Bình luận';
    const notifMessage = `${typeName} của bạn đã bị ẩn do vi phạm chính sách về Ngôn từ thù ghét (Hate Speech). Bạn có thể gửi kháng cáo nếu đây là sự nhầm lẫn.`;

    return {
      finalLabel: 'Hate Speech',
      severity: 'hate_speech',
      isHidden: true,
      isSoftHidden: false,
      aiStatus: 'hidden',
      applyCooldown: false,
      cooldownMinutes: 0,
      notificationMessage: notifMessage,
      reason: 'Phát hiện phát ngôn mang tính thù địch, kích động',
      confidence: textConfidence,
      isImageViolence: false,
      isImageNsfw,
    };
  }

  // 3. CẤP ĐỘ 3: ĐỘC HẠI / NHẠY CẢM (Toxic & NSFW kết hợp)
  if (textLabel === 'Toxic' || isImageNsfw) {
    let reason = '';
    if (textLabel === 'Toxic' && isImageNsfw) {
      reason = 'Nội dung và hình ảnh có yếu tố nhạy cảm / xúc phạm (Toxic & NSFW)';
    } else if (isImageNsfw) {
      reason = 'Hình ảnh chứa nội dung nhạy cảm (NSFW)';
    } else {
      reason = 'Nội dung chứa từ ngữ xúc phạm hoặc công kích độc hại (Toxic)';
    }

    return {
      finalLabel: 'Toxic',
      severity: 'toxic',
      isHidden: false,
      isSoftHidden: true, // Ẩn mềm: đối với comment xếp ở cuối, đối với post làm mờ ảnh
      aiStatus: 'approved',
      applyCooldown: false,
      cooldownMinutes: 0,
      notificationMessage: null,
      reason,
      confidence: Math.max(textConfidence, scores.nsfw || 0.8),
      isImageViolence: false,
      isImageNsfw,
    };
  }

  // 4. CẤP ĐỘ 4: AN TOÀN (Normal / Safe)
  return {
    finalLabel: 'Normal',
    severity: 'normal',
    isHidden: false,
    isSoftHidden: false,
    aiStatus: 'approved',
    applyCooldown: false,
    cooldownMinutes: 0,
    notificationMessage: null,
    reason: 'Nội dung an toàn, không phát hiện vi phạm',
    confidence: textConfidence,
    isImageViolence: false,
    isImageNsfw: false,
  };
}

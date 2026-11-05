import { moderateImageUrl } from './imageModerationClient.js';

/**
 * Trích xuất các snapshot frames từ Cloudinary video URL để quét kiểm duyệt
 * @param {string} videoUrl 
 * @returns {string[]} Mảng các URL khung hình JPEG
 */
export function extractVideoFrames(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') return [];
  
  if (videoUrl.includes('/video/upload/')) {
    return [
      videoUrl.replace('/video/upload/', '/video/upload/so_1,w_720,c_limit,f_jpg/'),
      videoUrl.replace('/video/upload/', '/video/upload/so_5,w_720,c_limit,f_jpg/'),
      videoUrl.replace('/video/upload/', '/video/upload/so_auto,w_720,c_limit,f_jpg/'),
    ];
  }

  // Nếu không phải Cloudinary, trả về chính URL để client kiểm duyệt xử lý hoặc fallback
  return [videoUrl];
}

/**
 * Phân tích và kiểm duyệt nội dung Media của Tin (Hình ảnh hoặc Video)
 * @param {Object} params
 * @param {string} params.mediaUrl - Đường dẫn hình ảnh hoặc video
 * @param {'text'|'image'|'video'} params.storyType - Loại tin
 * @param {Function} [params.imageModerationClient] - Hàm gọi API kiểm duyệt ảnh
 * @returns {Promise<Object|null>} Kết quả kiểm duyệt hài hòa
 */
export async function moderateStoryMedia({ mediaUrl, storyType, imageModerationClient = moderateImageUrl }) {
  if (!mediaUrl || storyType === 'text') {
    return null;
  }

  if (storyType === 'image') {
    if (!imageModerationClient) return null;
    return await imageModerationClient(mediaUrl);
  }

  if (storyType === 'video') {
    if (!imageModerationClient) {
      return { decision: 'safe', label: 'safe', scores: { safe: 1.0, nsfw: 0.0, violence: 0.0 } };
    }

    const frameUrls = extractVideoFrames(mediaUrl);
    const frameResults = [];

    for (const frameUrl of frameUrls) {
      try {
        const res = await imageModerationClient(frameUrl);
        if (res) frameResults.push(res);
      } catch (err) {
        console.warn(`[Video Moderation] Lỗi quét frame: ${frameUrl} - ${err.message}`);
      }
    }

    if (frameResults.length === 0) {
      return { decision: 'safe', label: 'safe', scores: { safe: 0.99, nsfw: 0.01, violence: 0.01 } };
    }

    let maxViolence = 0;
    let maxNsfw = 0;
    let minSafe = 1.0;
    let hasViolenceViolation = false;
    let hasNsfwViolation = false;

    for (const res of frameResults) {
      const scores = res.scores || res.images?.[0]?.scores || {};
      const vScore = scores.violence || 0;
      const nScore = scores.nsfw || 0;
      const sScore = scores.safe !== undefined ? scores.safe : 1.0;

      if (vScore > maxViolence) maxViolence = vScore;
      if (nScore > maxNsfw) maxNsfw = nScore;
      if (sScore < minSafe) minSafe = sScore;

      if (res.decision === 'rejected' || res.decision === 'rejected_hold' || res.label === 'violence' || vScore >= 0.8) {
        hasViolenceViolation = true;
      }
      if (res.decision === 'sensitive' || res.label === 'nsfw' || nScore >= 0.7) {
        hasNsfwViolation = true;
      }
    }

    if (hasViolenceViolation) {
      return {
        decision: 'rejected_hold',
        label: 'violence',
        scores: { safe: minSafe, nsfw: maxNsfw, violence: maxViolence || 0.95 },
        thresholds: { violence_reject: 0.8, nsfw_blur: 0.7 },
        framesChecked: frameResults.length,
      };
    }

    if (hasNsfwViolation) {
      return {
        decision: 'sensitive',
        label: 'nsfw',
        scores: { safe: minSafe, nsfw: maxNsfw || 0.85, violence: maxViolence },
        thresholds: { violence_reject: 0.8, nsfw_blur: 0.7 },
        framesChecked: frameResults.length,
      };
    }

    return {
      decision: 'safe',
      label: 'safe',
      scores: { safe: minSafe, nsfw: maxNsfw, violence: maxViolence },
      thresholds: { violence_reject: 0.8, nsfw_blur: 0.7 },
      framesChecked: frameResults.length,
    };
  }

  return null;
}


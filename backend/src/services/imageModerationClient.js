const API_URL = (process.env.IMAGE_MODERATION_API_URL || 'http://127.0.0.1:8001/api/v1/moderate/image').trim();
const PREVIEW_URL = API_URL.replace(/\/image$/, '/image/preview');

export async function moderateImageUrl(imageUrl, { timeoutMs = 5000 } = {}) {
  if (!imageUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`image moderation returned ${response.status}`);
    const result = await response.json();
    return { ...result, source: 'efficientnet-b1' };
  } catch (error) {
    return { decision: 'pending_review', images: [], thresholds: {}, failed: true, source: 'unavailable', error };
  } finally {
    clearTimeout(timer);
  }
}

export async function previewImageBytes(file, { timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const form = new FormData();
    form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'image');
    const response = await fetch(PREVIEW_URL, { method: 'POST', body: form, signal: controller.signal });
    if (!response.ok) return { category: 'PENDING_REVIEW', failed: true };
    return await response.json();
  } catch {
    return { category: 'PENDING_REVIEW', failed: true };
  } finally { clearTimeout(timer); }
}

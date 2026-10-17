const API_URL = process.env.IMAGE_MODERATION_API_URL || 'http://127.0.0.1:8000/api/v1/moderate/image';

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
    return await response.json();
  } catch (error) {
    return { decision: 'pending_review', images: [], thresholds: {}, failed: true, error };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Module phân loại kiểm duyệt nội dung văn bản (PhoBERT & Fallback Rules)
 * Phân cấp nhãn:
 * - Normal: Nội dung bình thường
 * - Toxic: Độc hại (comment bị ẩn mềm, xếp ở cuối)
 * - Hate Speech: Ngôn từ thù địch (ẩn cứng bài đăng & comment, cho phép kháng cáo)
 * - Violence: Bạo lực (vừa ẩn cứng, vừa phạt thời gian 24h, cho phép kháng cáo)
 */
export async function moderateTextContent(text) {
  if (!text || !text.trim()) {
    return { label: 'Normal', confidence: 1.0, action: 'allow' };
  }

  try {
    const res = await fetch('http://127.0.0.1:8000/api/v1/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        label: data.label || 'Normal',
        confidence: data.confidence || 0.98,
        action: data.action || 'allow',
      };
    }
  } catch {
    // Fallback nếu FastAPI PhoBERT chưa bật hoặc timeout
  }

  const lower = text.toLowerCase();
  if (
    lower.includes('đánh') ||
    lower.includes('đập') ||
    lower.includes('giết') ||
    lower.includes('chém') ||
    lower.includes('bạo lực') ||
    lower.includes('bắn chết')
  ) {
    return { label: 'Violence', confidence: 0.95, action: 'hide' };
  }

  if (
    lower.includes('kỳ thị') ||
    lower.includes('mọi rợ') ||
    lower.includes('phản động') ||
    lower.includes('cút xéo') ||
    lower.includes('súc vật')
  ) {
    return { label: 'Hate Speech', confidence: 0.92, action: 'hide' };
  }

  if (
    lower.includes('ngu') ||
    lower.includes('chó') ||
    lower.includes('rác') ||
    lower.includes('khốn') ||
    lower.includes('điên') ||
    lower.includes('óc chó')
  ) {
    return { label: 'Toxic', confidence: 0.91, action: 'warn' };
  }

  return { label: 'Normal', confidence: 0.99, action: 'allow' };
}

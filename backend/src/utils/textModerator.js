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
    return { label: 'Normal', confidence: 1.0, action: 'allow', source: 'rules' };
  }

  const isTestEnvironment =
    process.env.NODE_ENV === 'test' ||
    process.execArgv.includes('--test') ||
    process.argv.includes('--test') ||
    Boolean(process.env.NODE_TEST_CONTEXT);

  if (!isTestEnvironment) {
    try {
      const fastApiBase = (process.env.AI_SERVICE_URL || process.env.FASTAPI_URL || 'http://127.0.0.1:8001').trim();
      const res = await fetch(`${fastApiBase}/api/v1/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.model_source === 'phobert') {
          return {
            label: data.label || 'Normal',
            confidence: data.confidence ?? null,
            action: data.action || 'allow',
            source: 'phobert',
          };
        }
        if (data.model_source === 'fallback') {
          return {
            label: data.label || 'Review needed',
            confidence: data.confidence ?? null,
            action: data.action || 'review',
            source: 'fallback',
          };
        }
      }
    } catch {
      // Fallback nếu FastAPI PhoBERT chưa bật hoặc timeout
    }
  }

  const lower = text.toLowerCase();
  if (
    lower.includes('đánh') ||
    lower.includes('đập') ||
    lower.includes('giết') ||
    lower.includes('chém') ||
    lower.includes('bạo lực') ||
    lower.includes('bắn chết') ||
    lower.includes('chết') ||
    lower.includes('đâm') ||
    lower.includes('chặt') ||
    lower.includes('giết chết') ||
    lower.includes('đánh chết')
  ) {
    return { label: 'Violence', confidence: 0.95, action: 'hide', source: 'rules' };
  }

  if (
    lower.includes('kỳ thị') ||
    lower.includes('mọi rợ') ||
    lower.includes('phản động') ||
    lower.includes('cút xéo') ||
    lower.includes('súc vật')
  ) {
    return { label: 'Hate Speech', confidence: 0.92, action: 'hide', source: 'rules' };
  }

  if (
    lower.includes('ngu') ||
    lower.includes('chó') ||
    lower.includes('rác') ||
    lower.includes('khốn') ||
    lower.includes('điên') ||
    lower.includes('óc chó') ||
    lower.includes('thần kinh') ||
    lower.includes('khùng') ||
    lower.includes('mất dạy') ||
    lower.includes('đồ khốn') ||
    lower.includes('đồ điên')
  ) {
    return { label: 'Toxic', confidence: 0.91, action: 'warn', source: 'rules' };
  }

  return { label: 'Normal', confidence: 0.99, action: 'allow', source: 'fallback' };
}

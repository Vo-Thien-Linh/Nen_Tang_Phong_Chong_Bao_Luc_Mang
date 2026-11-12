const textSeverity = {
  Normal: 0,
  'No text': 0,
  'Review needed': 1,
  Toxic: 2,
  'Hate Speech': 3,
  Violence: 4,
};

const imageSeverity = {
  SAFE: 0,
  SENSITIVE: 3,
  PENDING_REVIEW: 1,
  VIOLATION: 4,
};

const moderationSourceLabels = {
  phobert: 'PhoBERT',
  fallback: 'Dự phòng từ khóa',
  rules: 'Quy tắc dự phòng',
  'efficientnet-b1': 'EfficientNet-B1',
  unavailable: 'Mô hình không khả dụng',
};

export function getGroupModerationSourceLabel(source) {
  return moderationSourceLabels[source] || '';
}

function normalizeImageCategory(preview) {
  const category = String(preview?.category || preview?.decision || '').toUpperCase();
  if (category === 'REJECTED') return 'VIOLATION';
  return imageSeverity[category] == null ? null : category;
}

export function selectGroupModerationPreview(textResult, imageResult) {
  const candidates = [];

  if (textResult && !textResult.error && textSeverity[textResult.label] != null) {
    candidates.push({
      type: 'text',
      label: textResult.label,
      severity: textSeverity[textResult.label],
      confidence: textResult.confidence != null && Number.isFinite(Number(textResult.confidence)) ? Number(textResult.confidence) : null,
      source: textResult.model_source || textResult.source,
    });
  }

  const imageCategory = normalizeImageCategory(imageResult);
  if (imageCategory) {
    const confidence = Number(imageResult.confidence);
    candidates.push({
      type: 'image',
      label: imageCategory,
      severity: imageSeverity[imageCategory],
      confidence: imageResult.confidence != null && Number.isFinite(confidence) ? confidence : null,
      confidenceLabel: imageResult.confidenceLabel,
      source: imageResult.source || (imageResult.failed ? 'unavailable' : 'efficientnet-b1'),
    });
  }

  return candidates.sort((a, b) => b.severity - a.severity || (b.confidence ?? -1) - (a.confidence ?? -1))[0] || null;
}

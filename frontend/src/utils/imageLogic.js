export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_SIZE_MB = 10;

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export function validateImageFile(file, { maxSizeBytes = MAX_IMAGE_SIZE_BYTES } = {}) {
  const type = String(file?.type || '').toLowerCase();
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase();

  if (!SUPPORTED_IMAGE_TYPES.has(type) && !SUPPORTED_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      message: 'Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF',
    };
  }

  if (Number(file?.size || 0) > maxSizeBytes) {
    return {
      valid: false,
      message: `Ảnh không được vượt quá ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
    };
  }

  return { valid: true, message: '' };
}

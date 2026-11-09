/**
 * Tiện ích làm mờ dữ liệu cá nhân nhạy cảm (PII Masking) ở phía Backend
 * Đảm bảo mọi báo cáo tin nhắn lưu trữ hoặc truyền tới kiểm duyệt viên đều được bảo mật
 */

const PHONE_REGEX = /(?<=\D|^)(?:\+84|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])(?:[\s.-]?\d{3})(?:[\s.-]?\d{3,4})\b/g;
const EMAIL_REGEX = /\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/g;
// Thẻ ngân hàng: 16 số chia làm 4 nhóm có dấu cách/gạch nối, hoặc 16 số liên tục
const CARD_REGEX = /\b(?:\d{4}[\s.-]){3}\d{4}\b|\b\d{16}\b/g;
// CCCD: 12 số bắt đầu bằng 0, hoặc CMND 9 số
const CCCD_REGEX = /\b0\d{11}\b|\b\d{9}\b/g;

export function maskPhoneNumber(phone) {
  const digits = phone.replace(/[\s.-]/g, '');
  if (digits.length < 9) return '****';
  const prefix = digits.slice(0, 3);
  const suffix = digits.slice(-2);
  return `${prefix}****${suffix}`;
}

export function maskEmail(email) {
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***';
  const username = parts[0];
  const domain = parts[1];
  const visiblePrefix = username.length > 1 ? username.slice(0, 2) : username.slice(0, 1);
  return `${visiblePrefix}***@${domain}`;
}

export function maskCardNumber(card) {
  const digits = card.replace(/[\s-]/g, '');
  const suffix = digits.slice(-4);
  return `****-****-****-${suffix}`;
}

export function maskCccd(cccd) {
  const prefix = cccd.slice(0, 4);
  const suffix = cccd.slice(-2);
  return `${prefix}****${suffix}`;
}

export function maskSensitiveData(text) {
  if (!text || typeof text !== 'string') return text || '';

  let masked = text;
  // 1. Che thẻ ngân hàng
  masked = masked.replace(CARD_REGEX, (match) => maskCardNumber(match));
  // 2. Che CCCD / CMND
  masked = masked.replace(CCCD_REGEX, (match) => maskCccd(match));
  // 3. Che số điện thoại
  masked = masked.replace(PHONE_REGEX, (match) => maskPhoneNumber(match));
  // 4. Che email
  masked = masked.replace(EMAIL_REGEX, (match) => maskEmail(match));

  return masked;
}

export function hasSensitiveData(text) {
  if (!text || typeof text !== 'string') return false;
  return (
    PHONE_REGEX.test(text) ||
    EMAIL_REGEX.test(text) ||
    CARD_REGEX.test(text) ||
    CCCD_REGEX.test(text)
  );
}

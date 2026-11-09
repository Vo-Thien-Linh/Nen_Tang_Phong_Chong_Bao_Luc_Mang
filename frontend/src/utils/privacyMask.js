/**
 * Tiện ích làm mờ và ẩn danh hóa dữ liệu cá nhân nhạy cảm (PII Masking)
 * Áp dụng khi người dùng gửi báo cáo tin nhắn nhằm ngăn chặn rò rỉ dữ liệu riêng tư
 * tới Đội ngũ Kiểm duyệt viên (Moderators).
 */

// 1. Regex nhận diện số điện thoại (Việt Nam & quốc tế)
const PHONE_REGEX = /(?<=\D|^)(?:\+84|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])(?:[\s.-]?\d{3})(?:[\s.-]?\d{3,4})\b/g;

// 2. Regex nhận diện địa chỉ email
const EMAIL_REGEX = /\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/g;

// 3. Regex nhận diện số thẻ ngân hàng / thẻ tín dụng (16 chữ số chia 4 nhóm hoặc 16 số liên tục)
const CARD_REGEX = /\b(?:\d{4}[\s.-]){3}\d{4}\b|\b\d{16}\b/g;

// 4. Regex nhận diện số CMND / CCCD (12 số bắt đầu bằng 0, hoặc 9 số)
const CCCD_REGEX = /\b0\d{11}\b|\b\d{9}\b/g;

/**
 * Làm mờ số điện thoại: Giữ 3 số đầu và 2 số cuối, thay phần giữa bằng ****
 * Ví dụ: 0912345678 -> 091****78
 */
export function maskPhoneNumber(phone) {
  const digits = phone.replace(/[\s.-]/g, '');
  if (digits.length < 9) return '****';
  const prefix = digits.slice(0, 3);
  const suffix = digits.slice(-2);
  return `${prefix}****${suffix}`;
}

/**
 * Làm mờ email: Giữ chữ cái đầu của username và tên miền, ẩn phần còn lại
 * Ví dụ: nguyenvan@gmail.com -> n***@gmail.com
 */
export function maskEmail(email) {
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***';
  const username = parts[0];
  const domain = parts[1];
  const visiblePrefix = username.length > 1 ? username.slice(0, 2) : username.slice(0, 1);
  return `${visiblePrefix}***@${domain}`;
}

/**
 * Làm mờ số thẻ ngân hàng: Giữ 4 số cuối
 * Ví dụ: 9704 1234 5678 9999 -> ****-****-****-9999
 */
export function maskCardNumber(card) {
  const digits = card.replace(/[\s-]/g, '');
  const suffix = digits.slice(-4);
  return `****-****-****-${suffix}`;
}

/**
 * Làm mờ CCCD / CMND: Giữ 3 số đầu và 2 số cuối
 * Ví dụ: 001099123456 -> 0010****56
 */
export function maskCccd(cccd) {
  const prefix = cccd.slice(0, 4);
  const suffix = cccd.slice(-2);
  return `${prefix}****${suffix}`;
}

/**
 * Hàm tổng hợp: Làm mờ toàn bộ PII (Số điện thoại, Email, Thẻ ngân hàng, CCCD) trong văn bản
 * @param {string} text - Văn bản gốc của tin nhắn
 * @returns {string} - Văn bản đã được bảo vệ thông tin cá nhân
 */
export function maskSensitiveData(text) {
  if (!text || typeof text !== 'string') return text || '';

  let masked = text;

  // 1. Che số thẻ tín dụng / ngân hàng trước
  masked = masked.replace(CARD_REGEX, (match) => maskCardNumber(match));

  // 2. Che CCCD / CMND nếu có
  masked = masked.replace(CCCD_REGEX, (match) => maskCccd(match));

  // 3. Che số điện thoại
  masked = masked.replace(PHONE_REGEX, (match) => maskPhoneNumber(match));

  // 4. Che địa chỉ email
  masked = masked.replace(EMAIL_REGEX, (match) => maskEmail(match));

  return masked;
}

/**
 * Kiểm tra xem trong tin nhắn có chứa dữ liệu nhạy cảm hay không
 * @param {string} text 
 * @returns {boolean}
 */
export function hasSensitiveData(text) {
  if (!text || typeof text !== 'string') return false;
  return (
    PHONE_REGEX.test(text) ||
    EMAIL_REGEX.test(text) ||
    CARD_REGEX.test(text) ||
    CCCD_REGEX.test(text)
  );
}

/**
 * Nhận diện danh sách loại dữ liệu nhạy cảm được tìm thấy
 * @param {string} text 
 * @returns {string[]} Danh sách nhãn tiếng Việt (ví dụ: ['Số điện thoại', 'Email'])
 */
export function detectSensitiveDataTypes(text) {
  if (!text || typeof text !== 'string') return [];
  const types = [];
  if (/(?<=\D|^)(?:\+84|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])(?:[\s.-]?\d{3})(?:[\s.-]?\d{3,4})\b/.test(text)) {
    types.push('Số điện thoại');
  }
  if (/\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/.test(text)) {
    types.push('Email');
  }
  if (/\b(?:\d{4}[\s.-]){3}\d{4}\b|\b\d{16}\b/.test(text)) {
    types.push('Số thẻ ngân hàng');
  }
  if (/\b0\d{11}\b|\b\d{9}\b/.test(text)) {
    types.push('Số CMND/CCCD');
  }
  return types;
}

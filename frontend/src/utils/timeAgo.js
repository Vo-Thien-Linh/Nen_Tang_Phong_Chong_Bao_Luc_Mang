/**
 * Chuyển đổi timestamp ISO hoặc ngày tháng thành relative time tiếng Việt dễ đọc
 * Quy tắc:
 * - < 1 phút: 'Vừa xong'
 * - < 60 phút: 'X phút trước'
 * - < 24 giờ: 'X giờ trước'
 * - Dưới 1 tuần (1 - 6 ngày): '1 ngày trước', '2 ngày trước', ...
 * - 1 tuần đến < 30 ngày: 'tuần trước', '2 tuần trước', '3 tuần trước', ...
 * - 1 tháng đến < 1 năm (< 365 ngày): '1 tháng trước', '2 tháng trước', ...
 * - Quá 1 năm: hiển thị thời gian cụ thể dd/mm/yyyy
 * @param {string|number|Date} dateInput 
 * @returns {string}
 */
export function formatRelativeTime(dateInput) {
  if (!dateInput) return '';

  // Nếu là chuỗi relative time hợp lệ (từ mockData)
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (
      trimmed.includes('trước') || 
      trimmed.includes('Vừa xong') || 
      trimmed.includes('Hôm qua')
    ) {
      return trimmed;
    }
  }

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    return String(dateInput);
  }

  const now = Date.now();
  const diffMs = now - date.getTime();

  // Dưới 1 phút (< 60s) hoặc lệch timezone tương lai gần
  if (diffMs < 60_000) {
    return 'Vừa xong';
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // 1. Dưới 1 giờ: X phút trước
  if (diffMin < 60) {
    return `${diffMin} phút trước`;
  }

  // 2. Dưới 24 giờ: X giờ trước
  if (diffHour < 24) {
    return `${diffHour} giờ trước`;
  }

  // 3. Dưới 1 tuần (1 - 6 ngày): '1 ngày trước', '2 ngày trước', ...
  if (diffDay < 7) {
    return `${diffDay} ngày trước`;
  }

  // 4. Từ 1 tuần đến dưới 1 tháng (< 30 ngày): 'tuần trước', '2 tuần trước', '3 tuần trước', ...
  if (diffDay < 30) {
    const diffWeeks = Math.floor(diffDay / 7);
    if (diffWeeks <= 1) {
      return 'tuần trước';
    }
    return `${diffWeeks} tuần trước`;
  }

  // 5. Từ 1 tháng đến dưới 1 năm (< 365 ngày): '1 tháng trước', '2 tháng trước', ...
  if (diffDay < 365) {
    const diffMonths = Math.max(1, Math.floor(diffDay / 30));
    return `${diffMonths} tháng trước`;
  }

  // 6. Quá 1 năm (>= 365 ngày): hiển thị thời gian cụ thể dd/mm/yyyy
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

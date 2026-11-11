/**
 * Chuyển đổi timestamp ISO hoặc ngày tháng thành relative time dễ đọc (Hỗ trợ Đa ngôn ngữ vi/en)
 * Quy tắc:
 * - < 1 phút: 'Vừa xong' / 'Just now'
 * - < 60 phút: 'X phút trước' / 'Xm ago'
 * - < 24 giờ: 'X giờ trước' / 'Xh ago'
 * - Dưới 1 tuần (1 - 6 ngày): 'X ngày trước' / 'Xd ago'
 * - 1 tuần đến < 30 ngày: 'tuần trước', 'X tuần trước' / '1w ago', 'Xw ago'
 * - 1 tháng đến < 1 năm (< 365 ngày): 'X tháng trước' / 'Xmo ago'
 * - Quá 1 năm: hiển thị thời gian cụ thể dd/mm/yyyy
 * @param {string|number|Date} dateInput 
 * @param {string} [lang] - 'vi' | 'en' (tự động lấy từ localStorage nếu có)
 * @returns {string}
 */
export function formatRelativeTime(dateInput, lang = null) {
  if (!dateInput) return '';

  const currentLang = (typeof lang === 'string') 
    ? lang 
    : (typeof window !== 'undefined' && typeof localStorage !== 'undefined' ? (localStorage.getItem('nexussocial_language') || 'vi') : 'vi');
  const isEn = currentLang === 'en';

  // Nếu là chuỗi relative time hợp lệ (từ mockData hoặc đã format)
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (isEn) {
      if (trimmed === 'Vừa xong') return 'Just now';
      if (trimmed === 'Hôm qua') return 'Yesterday';
      const mMin = trimmed.match(/^(\d+)\s*phút trước$/i);
      if (mMin) return `${mMin[1]}m ago`;
      const mHour = trimmed.match(/^(\d+)\s*giờ trước$/i);
      if (mHour) return `${mHour[1]}h ago`;
      const mDay = trimmed.match(/^(\d+)\s*ngày trước$/i);
      if (mDay) return `${mDay[1]}d ago`;
      if (trimmed === 'tuần trước') return '1w ago';
      const mWeek = trimmed.match(/^(\d+)\s*tuần trước$/i);
      if (mWeek) return `${mWeek[1]}w ago`;
      const mMonth = trimmed.match(/^(\d+)\s*tháng trước$/i);
      if (mMonth) return `${mMonth[1]}mo ago`;
    }

    if (
      trimmed.includes('trước') || 
      trimmed.includes('Vừa xong') || 
      trimmed.includes('Hôm qua') ||
      trimmed.includes('ago') ||
      trimmed === 'Just now' ||
      trimmed === 'Yesterday'
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
    return isEn ? 'Just now' : 'Vừa xong';
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // 1. Dưới 1 giờ: X phút trước / Xm ago
  if (diffMin < 60) {
    return isEn ? `${diffMin}m ago` : `${diffMin} phút trước`;
  }

  // 2. Dưới 24 giờ: X giờ trước / Xh ago
  if (diffHour < 24) {
    return isEn ? `${diffHour}h ago` : `${diffHour} giờ trước`;
  }

  // 3. Dưới 1 tuần (1 - 6 ngày): '1 ngày trước', '2 ngày trước', ... / '1d ago'
  if (diffDay < 7) {
    return isEn ? `${diffDay}d ago` : `${diffDay} ngày trước`;
  }

  // 4. Từ 1 tuần đến dưới 1 tháng (< 30 ngày): 'tuần trước', '2 tuần trước', '3 tuần trước', ...
  if (diffDay < 30) {
    const diffWeeks = Math.floor(diffDay / 7);
    if (diffWeeks <= 1) {
      return isEn ? '1w ago' : 'tuần trước';
    }
    return isEn ? `${diffWeeks}w ago` : `${diffWeeks} tuần trước`;
  }

  // 5. Từ 1 tháng đến dưới 1 năm (< 365 ngày): '1 tháng trước', '2 tháng trước', ...
  if (diffDay < 365) {
    const diffMonths = Math.max(1, Math.floor(diffDay / 30));
    return isEn ? `${diffMonths}mo ago` : `${diffMonths} tháng trước`;
  }

  // 6. Quá 1 năm (>= 365 ngày): hiển thị thời gian cụ thể dd/mm/yyyy
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

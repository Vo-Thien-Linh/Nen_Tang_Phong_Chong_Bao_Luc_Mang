/**
 * Chuyển đổi timestamp ISO hoặc ngày tháng thành relative time tiếng Việt dễ đọc
 * @param {string|number|Date} dateInput 
 * @returns {string} Ví dụ: "Vừa xong", "5 phút trước", "2 giờ trước", "3 ngày trước", "14/10/2026"
 */
export function formatRelativeTime(dateInput) {
  if (!dateInput) return '';

  // Nếu đã là chuỗi relative time (từ mockData)
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (
      trimmed.includes('trước') || 
      trimmed.includes('Vừa xong') || 
      trimmed.includes('hôm qua') ||
      trimmed.includes('phút') ||
      trimmed.includes('giờ') ||
      trimmed.includes('ngày')
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

  // Nếu thời gian ở tương lai gần (chênh lệch timezone server vài giây)
  if (diffMs < 30000) {
    return 'Vừa xong';
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) {
    return 'Vừa xong';
  }
  if (diffMin < 60) {
    return `${diffMin} phút trước`;
  }
  if (diffHour < 24) {
    return `${diffHour} giờ trước`;
  }
  if (diffDay < 7) {
    return `${diffDay} ngày trước`;
  }

  // Định dạng ngày/tháng/năm
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

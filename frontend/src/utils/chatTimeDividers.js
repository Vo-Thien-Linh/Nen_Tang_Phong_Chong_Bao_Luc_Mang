/**
 * Tiện ích hỗ trợ phân tách mốc ngày tháng và mốc thời gian trong khung chat (MessagesView)
 */

/**
 * Format nhãn hiển thị cho mốc ngày (Date Badge)
 * @param {string|number|Date} dateInput 
 * @param {boolean} [isEn=false] 
 * @returns {string|null}
 */
export function formatDateBadge(dateInput, isEn = false) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  
  const isToday = (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
  if (isToday) return isEn ? 'Today' : 'Hôm nay';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
  if (isYesterday) return isEn ? 'Yesterday' : 'Hôm qua';

  const isSameYear = d.getFullYear() === now.getFullYear();
  if (isEn) {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(isSameYear ? {} : { year: 'numeric' })
    });
  }

  // Tiếng Việt
  const weekday = d.toLocaleDateString('vi-VN', { weekday: 'long' });
  const day = d.getDate();
  const month = d.getMonth() + 1;
  if (isSameYear) {
    return `${weekday}, ${day} tháng ${month}`;
  }
  return `${day} tháng ${month}, ${d.getFullYear()}`;
}

/**
 * Xác định xem có cần hiển thị Date Divider trước tin nhắn `currMsg` hay không
 * @param {object} currMsg 
 * @param {object|null} prevMsg 
 * @param {boolean} [isEn=false] 
 * @returns {string|null}
 */
export function getMessageDateDivider(currMsg, prevMsg, isEn = false) {
  if (!currMsg) return null;

  const currTime = currMsg.createdAt ? new Date(currMsg.createdAt) : null;
  const isCurrValid = currTime && !isNaN(currTime.getTime());

  // Nếu là tin nhắn đầu tiên của cuộc trò chuyện
  if (!prevMsg) {
    if (isCurrValid) {
      return formatDateBadge(currTime, isEn);
    }
    return isEn ? 'Today' : 'Hôm nay';
  }

  const prevTime = prevMsg.createdAt ? new Date(prevMsg.createdAt) : null;
  const isPrevValid = prevTime && !isNaN(prevTime.getTime());

  if (isCurrValid && isPrevValid) {
    const isDiffDay = (
      currTime.getFullYear() !== prevTime.getFullYear() ||
      currTime.getMonth() !== prevTime.getMonth() ||
      currTime.getDate() !== prevTime.getDate()
    );
    if (isDiffDay) {
      return formatDateBadge(currTime, isEn);
    }
    return null;
  }

  // Nếu currMsg có ngày hợp lệ còn prevMsg không có ngày
  if (isCurrValid && !isPrevValid) {
    return formatDateBadge(currTime, isEn);
  }

  return null;
}

/**
 * Xác định xem có cần hiển thị Time Divider (khoảng cách giờ trong cùng ngày) hay không
 * Mặc định: khoảng cách >= 20 phút giữa 2 tin nhắn liên tiếp trong cùng ngày
 * @param {object} currMsg 
 * @param {object|null} prevMsg 
 * @param {number} [gapMinutes=20] 
 * @returns {string|null}
 */
export function getMessageTimeDivider(currMsg, prevMsg, gapMinutes = 20) {
  if (!currMsg || !prevMsg) return null;

  const currTime = currMsg.createdAt ? new Date(currMsg.createdAt) : null;
  const prevTime = prevMsg.createdAt ? new Date(prevMsg.createdAt) : null;

  if (!currTime || !prevTime || isNaN(currTime.getTime()) || isNaN(prevTime.getTime())) {
    return null;
  }

  // Nếu khác ngày, Date Divider sẽ đảm nhận phân cách, không hiển thị Time Divider lặp lại
  const isDiffDay = (
    currTime.getFullYear() !== prevTime.getFullYear() ||
    currTime.getMonth() !== prevTime.getMonth() ||
    currTime.getDate() !== prevTime.getDate()
  );
  if (isDiffDay) return null;

  const diffMs = currTime.getTime() - prevTime.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes >= gapMinutes) {
    return currMsg.time || currTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  return null;
}

/**
 * Format thời gian chi tiết cho Tooltip khi rê chuột vào tin nhắn
 * Ví dụ: "14:28 - 11/11/2026"
 * @param {string|number|Date} dateInput 
 * @param {boolean} [isEn=false] 
 * @returns {string}
 */
export function formatFullTimestamp(dateInput, isEn = false) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = d.toLocaleDateString(isEn ? 'en-US' : 'vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  return `${timeStr} - ${dateStr}`;
}


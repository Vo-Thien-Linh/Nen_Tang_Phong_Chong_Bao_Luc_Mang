/**
 * Trích xuất các tệp, hình ảnh và liên kết đã chia sẻ từ danh sách tin nhắn
 */
export function extractSharedMediaAndLinks(messages = []) {
  const media = [];
  const links = [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  for (const m of messages) {
    // Bỏ qua các tin nhắn đã bị thu hồi
    if (m.isRecalled || m.status === 'recalled') continue;

    // Ảnh hoặc tệp đính kèm
    if (m.mediaUrl) {
      media.push({
        id: m.id,
        url: m.mediaUrl,
        type: m.mediaType || 'image',
        fileName: m.fileName || m.text || (m.mediaType === 'file' ? 'Tệp đính kèm' : 'Hình ảnh'),
        time: m.time,
        senderId: m.senderId
      });
    }

    // Các đường dẫn link trong văn bản
    if (m.text) {
      const found = m.text.match(urlRegex);
      if (found) {
        for (const url of found) {
          let domain = '';
          try {
            domain = new URL(url).hostname;
          } catch {
            domain = url;
          }
          links.push({
            id: `${m.id}-${url}`,
            url,
            domain,
            time: m.time,
            senderId: m.senderId
          });
        }
      }
    }
  }

  // Sắp xếp mục mới nhất lên đầu
  return {
    media: [...media].reverse(),
    links: [...links].reverse()
  };
}

/**
 * Kiểm tra tính hợp lệ của tệp đính kèm
 */
export function validateFileAttachment(file, maxBytes = 15 * 1024 * 1024) {
  if (!file) return { valid: false, error: 'Không tìm thấy tệp' };
  if (file.size > maxBytes) {
    return { valid: false, error: 'Dung lượng tệp tối đa là 15MB' };
  }
  return { valid: true };
}

/**
 * Định dạng dung lượng tệp đọc được
 */
export function formatFileSize(bytes = 0) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

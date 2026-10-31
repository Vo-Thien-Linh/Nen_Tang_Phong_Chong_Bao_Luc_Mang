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

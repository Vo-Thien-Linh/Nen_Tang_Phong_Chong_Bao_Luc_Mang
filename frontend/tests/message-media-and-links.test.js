import test from 'node:test';
import assert from 'node:assert/strict';

function extractUrlsAndDomain(text) {
  if (!text) return { urls: [], primaryDomain: null };
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex) || [];
  let primaryDomain = null;
  if (urls.length > 0) {
    try {
      primaryDomain = new URL(urls[0]).hostname;
    } catch {
      primaryDomain = urls[0];
    }
  }
  return { urls, primaryDomain };
}

function validateImageAttachment(file) {
  if (!file) return { valid: false, error: 'Không tìm thấy tệp' };
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP, GIF)' };
  }
  const maxBytes = 5 * 1024 * 1024; // 5MB
  if (file.size > maxBytes) {
    return { valid: false, error: 'Dung lượng ảnh tối đa là 5MB' };
  }
  return { valid: true };
}

function insertEmojiAtCursor(currentText, emoji, cursorIndex = null) {
  if (cursorIndex === null || cursorIndex === undefined) {
    return currentText + emoji;
  }
  return currentText.slice(0, cursorIndex) + emoji + currentText.slice(cursorIndex);
}

test('extractUrlsAndDomain: parses http and https links and extracts domain for preview', () => {
  const text1 = 'Hãy tham gia dự án tại https://github.com/wings/social-network nhé!';
  const res1 = extractUrlsAndDomain(text1);
  assert.equal(res1.urls.length, 1);
  assert.equal(res1.urls[0], 'https://github.com/wings/social-network');
  assert.equal(res1.primaryDomain, 'github.com');

  const text2 = 'Tham khảo https://vitejs.dev và http://localhost:5173/feed ngay';
  const res2 = extractUrlsAndDomain(text2);
  assert.equal(res2.urls.length, 2);
  assert.equal(res2.primaryDomain, 'vitejs.dev');

  const text3 = 'Tin nhắn văn bản thuần không có liên kết nào';
  const res3 = extractUrlsAndDomain(text3);
  assert.equal(res3.urls.length, 0);
  assert.equal(res3.primaryDomain, null);
});

test('validateImageAttachment: checks file type and 5MB size limit', () => {
  // Valid image
  assert.deepEqual(validateImageAttachment({ type: 'image/png', size: 1024 * 1024 }), { valid: true });
  assert.deepEqual(validateImageAttachment({ type: 'image/jpeg', size: 4.9 * 1024 * 1024 }), { valid: true });

  // Invalid file type
  const badType = validateImageAttachment({ type: 'application/pdf', size: 500 * 1024 });
  assert.equal(badType.valid, false);
  assert.match(badType.error, /hình ảnh hợp lệ/);

  // File too large (> 5MB)
  const tooLarge = validateImageAttachment({ type: 'image/png', size: 6 * 1024 * 1024 });
  assert.equal(tooLarge.valid, false);
  assert.match(tooLarge.error, /5MB/);
});

test('insertEmojiAtCursor: appends or inserts emoji smoothly', () => {
  const t1 = insertEmojiAtCursor('Xin chào', ' 😊');
  assert.equal(t1, 'Xin chào 😊');

  const t2 = insertEmojiAtCursor('Chào bạn nhé', '👋 ', 5);
  assert.equal(t2, 'Chào 👋 bạn nhé');
});

/**
 * storyStickers.js
 * Thư viện nhãn dán & tiện ích tương tác trực quan cho Tin (Story)
 * Tương tác thật: Vị trí, Giờ số nhiều kiểu, Nhắc tên bạn bè, Thăm dò ý kiến, Hộp câu hỏi, Slider cảm xúc.
 */

export const STICKER_CATEGORIES = [
  { id: 'widgets', label: 'Tiện ích tương tác' },
  { id: 'emojis', label: 'Biểu cảm & Emojis' },
  { id: 'aesthetic', label: 'Khoảnh khắc & Vibe' },
];

export const STORY_STICKERS = [
  // ==========================================
  // NHÓM 1: TIỆN ÍCH TƯƠNG TÁC (INTERACTIVE WIDGETS)
  // ==========================================
  {
    id: 'widget-loc-current',
    type: 'widget',
    widgetType: 'location',
    category: 'widgets',
    text: '📍 Vị trí hiện tại',
    isCurrentLocation: true,
    label: '📍 Lấy vị trí hiện tại (GPS)',
  },
  {
    id: 'widget-loc-hcm',
    type: 'widget',
    widgetType: 'location',
    category: 'widgets',
    text: 'TP. Hồ Chí Minh',
    label: '📍 TP. Hồ Chí Minh',
  },
  {
    id: 'widget-loc-hanoi',
    type: 'widget',
    widgetType: 'location',
    category: 'widgets',
    text: 'Hà Nội',
    label: '📍 Hà Nội',
  },
  {
    id: 'widget-loc-danang',
    type: 'widget',
    widgetType: 'location',
    category: 'widgets',
    text: 'Đà Nẵng',
    label: '📍 Đà Nẵng',
  },
  {
    id: 'widget-loc-dalat',
    type: 'widget',
    widgetType: 'location',
    category: 'widgets',
    text: 'Đà Lạt',
    label: '📍 Đà Lạt',
  },
  {
    id: 'widget-time-digital',
    type: 'widget',
    widgetType: 'time',
    timeStyle: 'digital', // 'digital' | 'badge' | 'neon' | 'analog_text'
    category: 'widgets',
    label: '⏰ Giờ kỹ thuật số (Nhiều kiểu)',
  },
  {
    id: 'widget-mention',
    type: 'widget',
    widgetType: 'mention',
    category: 'widgets',
    text: '@ Nhắc tên bạn bè',
    label: '@ NHẮC TÊN BẠN BÈ',
  },
  {
    id: 'widget-poll',
    type: 'widget',
    widgetType: 'poll',
    category: 'widgets',
    question: 'Bạn thấy thế nào?',
    optionA: 'Thích quá 😍',
    optionB: 'Bình thường 😉',
    label: '📊 Thăm dò ý kiến (Bình chọn thật)',
  },
  {
    id: 'widget-question',
    type: 'widget',
    widgetType: 'question',
    category: 'widgets',
    prompt: 'Hỏi tôi bất cứ điều gì...',
    label: '💬 Hộp câu hỏi (Hỏi đáp trực tiếp)',
  },
  {
    id: 'widget-slider',
    type: 'widget',
    widgetType: 'slider',
    category: 'widgets',
    emoji: '🔥',
    label: '🔥 Thanh trượt cảm xúc (Kéo thả)',
  },
  {
    id: 'widget-countdown',
    type: 'widget',
    widgetType: 'countdown',
    category: 'widgets',
    title: 'SỰ KIỆN ĐẶC BIỆT',
    timeText: '03 : 12 : 45',
    label: '⏳ Đếm ngược sự kiện',
  },

  // ==========================================
  // NHÓM 2: EMOJIS HOT TREND CHUẨN INSTAGRAM
  // ==========================================
  { id: 'emoji-fire', type: 'emoji', category: 'emojis', content: '🔥', label: 'Lửa cháy' },
  { id: 'emoji-heart', type: 'emoji', category: 'emojis', content: '❤️', label: 'Trái tim đỏ' },
  { id: 'emoji-sparkles', type: 'emoji', category: 'emojis', content: '✨', label: 'Lấp lánh' },
  { id: 'emoji-heart-eyes', type: 'emoji', category: 'emojis', content: '😍', label: 'Mắt trái tim' },
  { id: 'emoji-party', type: 'emoji', category: 'emojis', content: '🥳', label: 'Tiệc tùng' },
  { id: 'emoji-laugh', type: 'emoji', category: 'emojis', content: '😂', label: 'Cười ra nước mắt' },
  { id: 'emoji-cool', type: 'emoji', category: 'emojis', content: '😎', label: 'Ngầu lòi' },
  { id: 'emoji-100', type: 'emoji', category: 'emojis', content: '💯', label: '100 điểm' },
  { id: 'emoji-clap', type: 'emoji', category: 'emojis', content: '👏', label: 'Vỗ tay' },
  { id: 'emoji-pleading', type: 'emoji', category: 'emojis', content: '🥺', label: 'Dễ thương' },
  { id: 'emoji-star-struck', type: 'emoji', category: 'emojis', content: '🤩', label: 'Ngưỡng mộ' },
  { id: 'emoji-heart-sparkle', type: 'emoji', category: 'emojis', content: '💖', label: 'Tim lấp lánh' },
  { id: 'emoji-hand-heart', type: 'emoji', category: 'emojis', content: '🫶', label: 'Bắn tim' },
  { id: 'emoji-crying', type: 'emoji', category: 'emojis', content: '😭', label: 'Khóc xúc động' },
  { id: 'emoji-salute', type: 'emoji', category: 'emojis', content: '🫡', label: 'Chào trang trọng' },
  { id: 'emoji-mind-blown', type: 'emoji', category: 'emojis', content: '🤯', label: 'Bất ngờ' },

  // ==========================================
  // NHÓM 3: KHOẢNH KHẮC & AESTHETIC VIBES
  // ==========================================
  { id: 'emoji-blossom', type: 'emoji', category: 'aesthetic', content: '🌸', label: 'Hoa anh đào' },
  { id: 'emoji-sun', type: 'emoji', category: 'aesthetic', content: '☀️', label: 'Mặt trời tỏa nắng' },
  { id: 'emoji-coffee', type: 'emoji', category: 'aesthetic', content: '☕', label: 'Cà phê sáng' },
  { id: 'emoji-music-notes', type: 'emoji', category: 'aesthetic', content: '🎵', label: 'Giai điệu' },
  { id: 'emoji-camera', type: 'emoji', category: 'aesthetic', content: '📷', label: 'Máy ảnh chụp lại' },
  { id: 'emoji-rainbow', type: 'emoji', category: 'aesthetic', content: '🌈', label: 'Cầu vồng' },
  { id: 'emoji-lightning', type: 'emoji', category: 'aesthetic', content: '⚡', label: 'Năng lượng' },
  { id: 'emoji-pizza', type: 'emoji', category: 'aesthetic', content: '🍕', label: 'Pizza & Food' },
  { id: 'emoji-rocket', type: 'emoji', category: 'aesthetic', content: '🚀', label: 'Tên lửa bứt phá' },
  { id: 'emoji-butterfly', type: 'emoji', category: 'aesthetic', content: '🦋', label: 'Bướm xinh' },
  { id: 'emoji-cocktail', type: 'emoji', category: 'aesthetic', content: '🍹', label: 'Cocktail chill' },
  { id: 'emoji-moon', type: 'emoji', category: 'aesthetic', content: '🌙', label: 'Trăng đêm' },
];

/**
 * Sinh danh sách câu Lyric thực tế theo nhịp điệu bài hát (thay vì câu văn AI sáo rỗng)
 */
export function generateSampleLyrics(song) {
  const title = (song?.title || '').toLowerCase();
  const category = (song?.category || '').toLowerCase();

  // Nhóm 1: Nhạc Lofi / Hoàng hôn / Chill
  if (title.includes('hoàng hôn') || title.includes('sunset') || category.includes('lofi') || category.includes('chill')) {
    return [
      `Có những ngày bình yên nhẹ trôi qua...`,
      `Gửi chút nỗi nhớ vào từng cơn gió thu`,
      `Chỉ mong mai này lòng vẫn an nhiên`,
      `Từng giai điệu êm đềm ru êm giấc mơ`,
      `Bình yên nơi góc phố quen thuộc...`,
    ];
  }

  // Nhóm 2: Nhạc Cà phê / Acoustic / Guitar
  if (title.includes('cà phê') || title.includes('coffee') || category.includes('acoustic')) {
    return [
      `Một sớm mai thức giấc ngắm giọt sương rơi`,
      `Tách cà phê đượm nồng góc phố vắng`,
      `Nghe khúc ca xưa ngân vang tiếng đàn`,
      `Bình dị thôi mà ấm áp lạ kỳ`,
      `Nụ cười em làm tan biến âu lo...`,
    ];
  }

  // Nhóm 3: Nhạc Mùa hè / Năng lượng / Pop
  if (title.includes('mùa hè') || title.includes('summer') || category.includes('pop') || title.includes('positive')) {
    return [
      `Chạy về phía mặt trời rực rỡ đón bình minh!`,
      `Tuổi trẻ này ta cùng nhau bước tiếp`,
      `Gạt hết những âu lo của ngày hôm qua`,
      `Hát vang khúc ca tuổi thanh xuân rực rỡ`,
      `Don't stop the feeling, keep moving on! ✨`,
    ];
  }

  // Nhóm 4: Nhạc Piano / Cảm xúc
  if (category.includes('piano') || title.includes('peaceful') || title.includes('kỷ niệm')) {
    return [
      `Dưới góc phố quen anh vẫn đợi chờ`,
      `Từng phím đàn buông lơi bao kỷ niệm xưa`,
      `Gió cuốn theo ngàn lời hẹn ước thuở nào`,
      `Chỉ cần em hạnh phúc nơi phương xa`,
      `Kỷ niệm đẹp sẽ mãi trong tim này...`,
    ];
  }

  // Mặc định: Giai điệu mượt mà chuẩn bài hát
  return [
    `Nắng ấm xa dần rồi theo bóng hoàng hôn...`,
    `Còn lại nơi đây những giai điệu vấn vương`,
    `Gió cuốn theo ngàn lời hẹn ước năm nào`,
    `Dù mai này có bao nhiêu đổi thay...`,
    `Giai điệu này vẫn ngân vang mãi trong tim`,
  ];
}

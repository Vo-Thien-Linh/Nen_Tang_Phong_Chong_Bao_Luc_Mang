/**
 * storyStickers.js
 * Thư viện sticker & emoji phong phú cho tính năng Story (chuẩn Facebook & Instagram)
 */

export const STICKER_CATEGORIES = [
  { id: 'emoji', label: 'Biểu cảm & Icon' },
  { id: 'badges', label: 'Huy hiệu chữ' },
  { id: 'vibes', label: 'Tâm trạng & Đồ vật' },
];

export const STORY_STICKERS = [
  // Nhóm 1: Emojis phổ biến & hot trend
  { id: 'emoji-fire', type: 'emoji', content: '🔥', label: 'Lửa cháy' },
  { id: 'emoji-heart', type: 'emoji', content: '❤️', label: 'Trái tim đỏ' },
  { id: 'emoji-sparkles', type: 'emoji', content: '✨', label: 'Lấp lánh' },
  { id: 'emoji-heart-eyes', type: 'emoji', content: '😍', label: 'Mắt trái tim' },
  { id: 'emoji-party', type: 'emoji', content: '🥳', label: 'Tiệc tùng' },
  { id: 'emoji-laugh', type: 'emoji', content: '😂', label: 'Cười chảy nước mắt' },
  { id: 'emoji-cool', type: 'emoji', content: '😎', label: 'Ngầu lòi' },
  { id: 'emoji-100', type: 'emoji', content: '💯', label: '100 điểm' },
  { id: 'emoji-clap', type: 'emoji', content: '👏', label: 'Vỗ tay' },
  { id: 'emoji-pleading', type: 'emoji', content: '🥺', label: 'Dễ thương' },
  { id: 'emoji-star-struck', type: 'emoji', content: '🤩', label: 'Ngưỡng mộ' },
  { id: 'emoji-heart-sparkle', type: 'emoji', content: '💖', label: 'Tim lấp lánh' },
  { id: 'emoji-hand-heart', type: 'emoji', content: '🫶', label: 'Bắn tim' },
  { id: 'emoji-blossom', type: 'emoji', content: '🌸', label: 'Hoa anh đào' },
  { id: 'emoji-rainbow', type: 'emoji', content: '🌈', label: 'Cầu vồng' },
  { id: 'emoji-sun', type: 'emoji', content: '☀️', label: 'Mặt trời' },
  { id: 'emoji-lightning', type: 'emoji', content: '⚡', label: 'Tia chớp' },
  { id: 'emoji-coffee', type: 'emoji', content: '☕', label: 'Cà phê' },
  { id: 'emoji-pizza', type: 'emoji', content: '🍕', label: 'Pizza' },
  { id: 'emoji-music-notes', type: 'emoji', content: '🎵', label: 'Nốt nhạc' },
  { id: 'emoji-camera', type: 'emoji', content: '📷', label: 'Máy ảnh' },
  { id: 'emoji-rocket', type: 'emoji', content: '🚀', label: 'Tên lửa' },

  // Nhóm 2: Huy hiệu Typography (Stickers chữ nghệ thuật)
  { id: 'badge-vibes', type: 'badge', text: 'GOOD VIBES', bg: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500' },
  { id: 'badge-chill', type: 'badge', text: 'CHILL TIME', bg: 'bg-gradient-to-r from-cyan-500 to-blue-600' },
  { id: 'badge-love', type: 'badge', text: 'LOVE THIS', bg: 'bg-gradient-to-r from-rose-500 to-pink-500' },
  { id: 'badge-weekend', type: 'badge', text: 'WEEKEND', bg: 'bg-gradient-to-r from-amber-400 to-orange-500' },
  { id: 'badge-mood', type: 'badge', text: 'CURRENT MOOD', bg: 'bg-gradient-to-r from-purple-600 to-pink-600' },
  { id: 'badge-wings', type: 'badge', text: 'WINGS LIFE', bg: 'bg-gradient-to-r from-blue-600 to-indigo-700' },
  { id: 'badge-hot', type: 'badge', text: 'HOT TODAY 🔥', bg: 'bg-gradient-to-r from-red-500 to-yellow-500' },
  { id: 'badge-memories', type: 'badge', text: 'MEMORIES ✨', bg: 'bg-gradient-to-r from-emerald-500 to-teal-600' },
  { id: 'badge-positive', type: 'badge', text: 'STAY POSITIVE', bg: 'bg-gradient-to-r from-violet-500 to-fuchsia-500' },
  { id: 'badge-best', type: 'badge', text: 'BEST DAY EVER', bg: 'bg-gradient-to-r from-fuchsia-600 to-pink-600' },
];

/**
 * Sinh danh sách câu Lyric mẫu truyền cảm hứng cho bài hát Story
 */
export function generateSampleLyrics(song) {
  const title = song?.title || 'Giai điệu này';
  const artist = song?.artist || 'Ca sĩ';

  return [
    `🎵 Đang nghe: "${title}"`,
    `Từng giai điệu ngân vang trong tâm trí...`,
    `Để những yêu thương gửi theo ngọn gió`,
    `Khoảnh khắc này trôi qua thật bình yên`,
    `Cảm ơn cuộc đời vì những giai điệu đẹp! ✨`,
  ];
}

/**
 * musicService.js
 * Dịch vụ tìm kiếm và cung cấp âm nhạc đa dạng cho tính năng Story (chuẩn Facebook & Instagram)
 * Sử dụng iTunes Search API chính hãng Apple (không cần auth token, hỗ trợ hàng triệu bài hát VN & Quốc tế có preview 30s chất lượng cao)
 * Kèm cơ chế Fallback và bộ đệm (in-memory cache) thông minh.
 */

import { STORY_MUSIC_LIBRARY } from '../constants/storyMusicList';

// Bộ nhớ đệm cache kết quả tìm kiếm để phản hồi tức thì
const musicCache = new Map();

// Thể loại gợi ý xu hướng nhanh
export const MUSIC_CATEGORIES = [
  { id: 'all', label: 'Tất cả', defaultQuery: 'hit' },
  { id: 'vpop', label: 'V-Pop Hot', defaultQuery: 'vpop son tung vu' },
  { id: 'lofi', label: 'Lofi & Chill', defaultQuery: 'lofi chill' },
  { id: 'acoustic', label: 'Acoustic', defaultQuery: 'acoustic guitar' },
  { id: 'usuk', label: 'US-UK Viral', defaultQuery: 'billie taylor swift' },
  { id: 'kpop', label: 'K-Pop', defaultQuery: 'kpop newjeans bts' },
  { id: 'dance', label: 'EDM & Remix', defaultQuery: 'edm dance electronic' },
];

/**
 * Chuẩn hóa một bản ghi nhạc từ iTunes API sang format chuẩn Story
 */
function normalizeTrack(track) {
  return {
    id: `itunes-${track.trackId}`,
    title: track.trackName || 'Không có tiêu đề',
    artist: track.artistName || 'Nghệ sĩ',
    category: track.primaryGenreName || 'Pop',
    duration: 30,
    coverUrl: (track.artworkUrl100 || '').replace('100x100bb', '300x300bb') || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200',
    audioUrl: track.previewUrl,
    previewUrl: track.previewUrl,
    collectionName: track.collectionName || '',
    trackViewUrl: track.trackViewUrl || '',
  };
}

/**
 * Tìm kiếm bài hát theo từ khóa bất kỳ qua iTunes Search API
 * @param {string} query Từ khóa tìm kiếm (tên bài hát, nghệ sĩ, tâm trạng)
 * @param {number} limit Số lượng bài tối đa
 */
export async function searchMusic(query = '', limit = 30) {
  const trimmed = query.trim();
  const cacheKey = `search:${trimmed.toLowerCase()}:${limit}`;

  if (musicCache.has(cacheKey)) {
    return musicCache.get(cacheKey);
  }

  // Nếu không có query, trả về danh sách trending tổng hợp
  const searchTerm = trimmed || 'vpop son tung lofi';

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=${limit}&media=music`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        // Chỉ lấy các bài hát có preview audio hợp lệ
        const validTracks = data.results
          .filter((t) => Boolean(t.previewUrl))
          .map(normalizeTrack);

        if (validTracks.length > 0) {
          musicCache.set(cacheKey, validTracks);
          return validTracks;
        }
      }
    }
  } catch (err) {
    console.warn('Lỗi tìm kiếm nhạc iTunes (dùng danh sách tuyển chọn dự phòng):', err.message);
  }

  // Fallback: Lọc từ thư viện tuyển chọn offline
  const fallbackList = STORY_MUSIC_LIBRARY.filter((song) => {
    if (!trimmed) return true;
    const q = trimmed.toLowerCase();
    return (
      song.title.toLowerCase().includes(q) ||
      song.artist.toLowerCase().includes(q) ||
      song.category.toLowerCase().includes(q)
    );
  });

  return fallbackList;
}

/**
 * Lấy danh sách nhạc theo danh mục nhanh
 * @param {string} categoryId ID thể loại (all, vpop, lofi, acoustic, usuk, kpop, dance)
 */
export async function getTrendingMusic(categoryId = 'all') {
  const cat = MUSIC_CATEGORIES.find((c) => c.id === categoryId) || MUSIC_CATEGORIES[0];
  return searchMusic(cat.defaultQuery, 25);
}

const API_URL = import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000';

function getAuthHeaders() {
  const token = localStorage.getItem('nexussocial_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export const searchService = {
  async search(query, type = 'all', limit = 10) {
    if (!query || !query.trim()) {
      return { query: '', users: [], posts: [] };
    }
    try {
      const response = await fetch(
        `${API_URL}/api/search?q=${encodeURIComponent(query.trim())}&type=${type}&limit=${limit}`,
        {
          headers: getAuthHeaders()
        }
      );
      if (!response.ok) {
        throw new Error('Lỗi truy vấn tìm kiếm');
      }
      return await response.json();
    } catch (err) {
      console.warn('Lỗi gọi API tìm kiếm:', err);
      return { query, users: [], posts: [] };
    }
  }
};

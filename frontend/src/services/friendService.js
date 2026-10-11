// API Service kết nối Backend FastAPI (http://localhost:8000)
const API_BASE_URL = 'http://localhost:8000/api/v1/friends';

const getAuthHeaders = () => {
  const token = localStorage.getItem('nexussocial_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const friendService = {
  /**
   * Lấy danh sách lời mời kết bạn nhận được
   */
  async getFriendRequests() {
    try {
      const res = await fetch(`${API_BASE_URL}/requests`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Không thể tải lời mời kết bạn');
      return await res.json();
    } catch (err) {
      console.warn('Lỗi gọi API getFriendRequests, fallback demo:', err.message);
      return null;
    }
  },

  /**
   * Lấy danh sách tất cả bạn bè chính thức
   */
  async getFriendsList(search = '') {
    try {
      const url = new URL(`${API_BASE_URL}/list`);
      if (search) url.searchParams.append('search', search);

      const res = await fetch(url.toString(), {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Không thể tải danh sách bạn bè');
      return await res.json();
    } catch (err) {
      console.warn('Lỗi gọi API getFriendsList, fallback demo:', err.message);
      return null;
    }
  },

  /**
   * Lấy danh sách gợi ý kết bạn thông minh (Friends of Friends)
   */
  async getFriendSuggestions(limit = 20) {
    try {
      const res = await fetch(`${API_BASE_URL}/suggestions?limit=${limit}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Không thể tải gợi ý kết bạn');
      return await res.json();
    } catch (err) {
      console.warn('Lỗi gọi API getFriendSuggestions, fallback demo:', err.message);
      return null;
    }
  },

  /**
   * Gửi lời mời kết bạn
   */
  async sendFriendRequest(targetUserId) {
    const res = await fetch(`${API_BASE_URL}/request/${targetUserId}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Không thể gửi lời mời kết bạn');
    return data;
  },

  /**
   * Chấp nhận lời mời kết bạn
   */
  async acceptFriendRequest(requestId) {
    const res = await fetch(`${API_BASE_URL}/accept/${requestId}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Không thể đồng ý kết bạn');
    return data;
  },

  /**
   * Từ chối / Xóa lời mời kết bạn
   */
  async rejectFriendRequest(requestId) {
    const res = await fetch(`${API_BASE_URL}/reject/${requestId}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Không thể xóa lời mời');
    return data;
  },

  /**
   * Thu hồi lời mời kết bạn đã gửi
   */
  async cancelSentRequest(targetUserId) {
    const res = await fetch(`${API_BASE_URL}/cancel/${targetUserId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Không thể thu hồi lời mời');
    return data;
  },

  /**
   * Hủy kết bạn (Unfriend)
   */
  async unfriend(targetUserId) {
    const res = await fetch(`${API_BASE_URL}/${targetUserId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Không thể hủy kết bạn');
    return data;
  },

  /**
   * Lấy trạng thái quan hệ với 1 tài khoản
   */
  async getFriendshipStatus(targetUserId) {
    try {
      const res = await fetch(`${API_BASE_URL}/status/${targetUserId}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) return { status: 'none' };
      return await res.json();
    } catch {
      return { status: 'none' };
    }
  }
};

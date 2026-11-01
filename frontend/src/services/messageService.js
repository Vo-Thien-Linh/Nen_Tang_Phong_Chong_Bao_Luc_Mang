// API Service kết nối Backend FastAPI cho chức năng Nhắn tin (http://localhost:8000)
const API_BASE_URL = `${import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000'}/api/v1/messages`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('nexussocial_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const hasValidToken = () => {
  const token = localStorage.getItem('nexussocial_token');
  if (!token) return false;
  return token.split('.').length === 3;
};

export const messageService = {
  /**
   * Lấy danh sách cuộc trò chuyện ('accepted' hoặc 'pending')
   */
  async getConversations(tab = 'accepted') {
    if (!hasValidToken()) return null;
    try {
      const url = tab ? `${API_BASE_URL}/conversations?tab=${tab}` : `${API_BASE_URL}/conversations`;
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Không thể tải danh sách cuộc trò chuyện');
      return await res.json();
    } catch (err) {
      console.warn('Lỗi getConversations:', err.message);
      return null;
    }
  },

  /**
   * Lấy tin nhắn trong cuộc trò chuyện (tự động cập nhật 'read')
   */
  async getMessages(conversationId) {
    if (!hasValidToken() || !conversationId) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Không thể tải tin nhắn');
      return await res.json();
    } catch (err) {
      console.warn('Lỗi getMessages:', err.message);
      return null;
    }
  },

  /**
   * Khởi tạo hoặc tìm cuộc trò chuyện với một người dùng (từ profile hoặc danh sách bạn bè)
   */
  async getOrCreateConversation(userId) {
    if (!hasValidToken() || !userId) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/conversations/with/${userId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Không thể mở cuộc trò chuyện');
      return await res.json();
    } catch (err) {
      console.warn('Lỗi getOrCreateConversation:', err.message);
      return null;
    }
  },

  /**
   * Gửi tin nhắn mới tới receiverId (hỗ trợ văn bản và đa phương tiện ảnh/link)
   */
  async sendMessage(receiverId, content = '', mediaUrl = null, mediaType = 'text') {
    if (!hasValidToken()) {
      throw new Error('Bạn chưa đăng nhập');
    }
    const res = await fetch(`${API_BASE_URL}/send`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        receiver_id: receiverId,
        content: (content || '').trim(),
        media_url: mediaUrl,
        media_type: mediaType
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Không thể gửi tin nhắn do lỗi hệ thống');
    }
    return await res.json();
  },

  /**
   * Thu hồi tin nhắn đã gửi (chỉ người gửi mới có quyền thu hồi)
   */
  async recallMessage(messageId) {
    if (!hasValidToken() || !messageId) {
      throw new Error('Bạn chưa đăng nhập');
    }
    const res = await fetch(`${API_BASE_URL}/messages/${messageId}/recall`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Không thể thu hồi tin nhắn');
    }
    return await res.json();
  },

  /**
   * Chặn cuộc trò chuyện
   */
  async blockConversation(conversationId) {
    if (!hasValidToken() || !conversationId) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/block`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      return res.ok;
    } catch (err) {
      console.warn('Lỗi blockConversation:', err.message);
      return false;
    }
  },

  /**
   * Bỏ chặn cuộc trò chuyện
   */
  async unblockConversation(conversationId) {
    if (!hasValidToken() || !conversationId) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/unblock`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      return res.ok;
    } catch (err) {
      console.warn('Lỗi unblockConversation:', err.message);
      return false;
    }
  },

  /**
   * Đánh dấu đã xem toàn bộ tin nhắn trong hội thoại
   */
  async markRead(conversationId) {
    if (!hasValidToken() || !conversationId) return;
    try {
      await fetch(`${API_BASE_URL}/conversations/${conversationId}/read`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
    } catch (err) {
      console.warn('Lỗi markRead:', err.message);
    }
  },

  /**
   * Chấp nhận tin nhắn chờ từ người lạ
   */
  async acceptConversation(conversationId) {
    if (!hasValidToken() || !conversationId) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/accept`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      return res.ok;
    } catch (err) {
      console.warn('Lỗi acceptConversation:', err.message);
      return false;
    }
  },

  /**
   * Từ chối / xóa cuộc trò chuyện chờ
   */
  async declineConversation(conversationId) {
    if (!hasValidToken() || !conversationId) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      return res.ok;
    } catch (err) {
      console.warn('Lỗi declineConversation:', err.message);
      return false;
    }
  }
};

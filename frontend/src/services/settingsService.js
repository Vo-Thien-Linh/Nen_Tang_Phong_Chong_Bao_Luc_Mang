// API Service kết nối Backend FastAPI (http://localhost:8000)
const API_BASE_URL = `${import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000'}/api/v1/settings`;

const STORAGE_KEYS = {
  TOKEN: 'nexussocial_token',
  USER: 'nexussocial_current_user',
  SETTINGS: 'nexussocial_user_settings',
  BLOCKED: 'nexussocial_blocked_users'
};

const getAuthHeaders = () => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(user.id ? { 'x-user-id': user.id } : {})
  };
};

// Dữ liệu cài đặt mặc định phòng khi offline
const DEFAULT_SETTINGS = {
  // An toàn AI & Phòng chống bạo lực mạng
  ai_shield_enabled: true,
  ai_sensitivity: 'high',
  auto_hide_toxic_comments: true,
  filter_keywords: 'chó, ngu, rác rưởi, đồ khốn, mất dạy, óc chó, cút, giết, chém, đập',
  block_strangers_messages: false,
  take_a_break_mode: false,

  // Quyền riêng tư
  post_default_privacy: 'public',
  who_can_send_friend_requests: 'everyone',
  who_can_message: 'everyone',
  show_email: false,
  show_phone: false,

  // Thông báo
  notify_likes: true,
  notify_comments: true,
  notify_friend_requests: true,
  notify_ai_warnings: true,
  sound_enabled: true,

  // Bảo mật
  two_factor_enabled: false,

  // Giao diện
  theme: 'light',
  language: 'vi',
  blocked_count: 0
};

export const settingsService = {
  /**
   * Lấy toàn bộ cài đặt người dùng
   */
  async getSettings(currentUser) {
    try {
      const res = await fetch(API_BASE_URL, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data));
        return data;
      }
    } catch (err) {
      console.warn('Lỗi gọi API getSettings, chuyển sang bộ nhớ cục bộ:', err.message);
    }

    // Fallback cục bộ
    const local = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const parsed = local ? JSON.parse(local) : DEFAULT_SETTINGS;
    return {
      ...parsed,
      user_id: currentUser?.id,
      full_name: currentUser?.name || currentUser?.full_name || 'Người dùng',
      username: currentUser?.username || 'user',
      email: currentUser?.email || '',
      phone: currentUser?.phone || '',
      bio: currentUser?.bio || '',
      location: currentUser?.location || '',
      hometown: currentUser?.hometown || '',
      education: currentUser?.education || '',
      relationship_status: currentUser?.relationship_status || '',
      avatar_url: currentUser?.avatar || currentUser?.avatar_url || '',
      cover_url: currentUser?.cover_url || '',
      role: currentUser?.role || 'USER'
    };
  },

  /**
   * Cập nhật thông tin hồ sơ
   */
  async updateProfile(profileData) {
    try {
      const res = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(profileData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Cập nhật hồ sơ thất bại');
      }
      return data;
    } catch (err) {
      // Nếu là lỗi validate từ backend thì ném tiếp
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
      // Fallback lưu local
      return { success: true, message: 'Đã cập nhật hồ sơ (chế độ offline)' };
    }
  },

  /**
   * Đổi mật khẩu
   */
  async changePassword({ old_password, new_password, confirm_password }) {
    const res = await fetch(`${API_BASE_URL}/password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ old_password, new_password, confirm_password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Đổi mật khẩu thất bại');
    }
    return data;
  },

  /**
   * Cập nhật cài đặt khiên AI phòng chống bạo lực mạng
   */
  async updateSafety(safetyData) {
    try {
      const res = await fetch(`${API_BASE_URL}/safety`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(safetyData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'Cập nhật thất bại');
      return data;
    } catch (err) {
      // Local fallback
      const prev = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      const updated = { ...prev, ...safetyData };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return { success: true, message: 'Đã lưu cấu hình an toàn AI', data: updated };
    }
  },

  /**
   * Cập nhật quyền riêng tư
   */
  async updatePrivacy(privacyData) {
    try {
      const res = await fetch(`${API_BASE_URL}/privacy`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(privacyData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'Cập nhật thất bại');
      return data;
    } catch (err) {
      const prev = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      const updated = { ...prev, ...privacyData };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return { success: true, message: 'Đã lưu cấu hình quyền riêng tư', data: updated };
    }
  },

  /**
   * Cập nhật thông báo
   */
  async updateNotifications(notifData) {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(notifData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'Cập nhật thất bại');
      return data;
    } catch (err) {
      const prev = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      const updated = { ...prev, ...notifData };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return { success: true, message: 'Đã lưu cài đặt thông báo' };
    }
  },

  /**
   * Cập nhật giao diện
   */
  async updateAppearance(appearanceData) {
    try {
      const res = await fetch(`${API_BASE_URL}/appearance`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(appearanceData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'Cập nhật thất bại');
      return data;
    } catch (err) {
      const prev = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      const updated = { ...prev, ...appearanceData };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return { success: true, message: 'Đã lưu giao diện' };
    }
  },

  /**
   * Bật / Tắt 2FA
   */
  async toggle2FA() {
    try {
      const res = await fetch(`${API_BASE_URL}/2fa/toggle`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'Thao tác thất bại');
      return data;
    } catch (err) {
      const prev = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      const updated = { ...prev, two_factor_enabled: !prev.two_factor_enabled };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return { success: true, message: 'Đã thay đổi trạng thái 2FA', data: { two_factor_enabled: updated.two_factor_enabled } };
    }
  },

  /**
   * Lấy danh sách người dùng bị chặn
   */
  async getBlockedUsers() {
    try {
      const res = await fetch(`${API_BASE_URL}/blocked-users`, {
        headers: getAuthHeaders()
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('Lỗi gọi getBlockedUsers:', err.message);
    }
    // Fallback local
    const local = localStorage.getItem(STORAGE_KEYS.BLOCKED);
    if (local) return JSON.parse(local);
    return [
      {
        id: "a0000000-0000-0000-0000-000000000004",
        name: "Trần Minh Tuấn (Bị khóa)",
        username: "tuan_tran_ai",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        blocked_at: "Hôm qua"
      }
    ];
  },

  /**
   * Chặn người dùng
   */
  async blockUser(targetId, targetUser = null) {
    try {
      const res = await fetch(`${API_BASE_URL}/block/${targetId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('Lỗi blockUser API, fallback local:', err.message);
    }
    let blocked = await this.getBlockedUsers();
    if (!blocked.find(b => b.id === targetId)) {
      blocked.push({
        id: targetId,
        name: targetUser?.name || 'Người dùng đã chặn',
        username: targetUser?.username || 'user',
        avatar: targetUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        blocked_at: 'Vừa xong'
      });
      localStorage.setItem(STORAGE_KEYS.BLOCKED, JSON.stringify(blocked));
    }
    return { success: true, message: 'Đã chặn người dùng thành công' };
  },

  /**
   * Bỏ chặn người dùng
   */
  async unblockUser(targetId) {
    try {
      const res = await fetch(`${API_BASE_URL}/block/${targetId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('Lỗi unblockUser API, fallback local:', err.message);
    }
    let blocked = await this.getBlockedUsers();
    blocked = blocked.filter(b => b.id !== targetId);
    localStorage.setItem(STORAGE_KEYS.BLOCKED, JSON.stringify(blocked));
    return { success: true, message: 'Đã bỏ chặn người dùng' };
  }
};

/**
 * profileService.js
 * Service gọi các API Profile từ backend Node.js, lấy dữ liệu thực từ database
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Yêu cầu thất bại');
    error.status = response.status;
    throw error;
  }

  return data;
}

export const profileService = {
  /**
   * Lấy thông tin trang cá nhân đầy đủ từ database
   */
  async getProfile(userId) {
    return request(`/api/users/${userId}/profile`);
  },

  /**
   * Cập nhật thông tin trang cá nhân (chỉ cho phép sửa của chính mình)
   */
  async updateProfile(userId, fields) {
    // Map frontend field names sang DB field names
    const body = {};
    if (fields.bio !== undefined)      body.bio = fields.bio;
    if (fields.location !== undefined) body.location = fields.location;
    if (fields.hometown !== undefined) body.hometown = fields.hometown;
    if (fields.education !== undefined) body.education = fields.education;
    if (fields.highSchool !== undefined) body.high_school = fields.highSchool;
    if (fields.relationship !== undefined) body.relationship_status = fields.relationship;
    if (fields.avatar_url !== undefined) body.avatar_url = fields.avatar_url;
    if (fields.cover_url !== undefined) body.cover_url = fields.cover_url;

    return request(`/api/users/${userId}/profile`, {
      method: 'PATCH',
      headers: { 'x-user-id': userId },
      body: JSON.stringify(body),
    });
  },

  /**
   * Lấy danh sách bạn bè của người dùng
   */
  async getFriends(userId, limit = 6) {
    return request(`/api/users/${userId}/friends?limit=${limit}`);
  },

  /**
   * Lấy bài viết của người dùng
   */
  async getUserPosts(userId, viewerId) {
    return request(`/api/users/${userId}/posts`, {
      headers: viewerId ? { 'x-user-id': viewerId } : {},
    });
  },

  /**
   * Tải ảnh lên Cloudinary qua API backend (/api/upload)
   * Nhận file từ máy tính -> trả về HTTPS link trên Cloudinary
   */
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || 'Tải ảnh lên Cloudinary thất bại');
    }

    return data.url;
  },
};

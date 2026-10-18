const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const token = localStorage.getItem('nexussocial_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Yêu cầu thất bại');
    error.status = response.status;
    if (import.meta.env.DEV) {
      console.error('API request failed', {
        path,
        status: response.status,
        message: data.message || data.error || error.message,
      });
    }
    throw error;
  }

  return data;
}

export async function fetchPosts({ userId } = {}) {
  return request('/api/posts', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function fetchPostById({ postId, userId } = {}) {
  const cleanId = String(postId || '').replace(/^post-/, '');
  return request(`/api/posts/${cleanId}`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function createPost({ userId, content, imageUrl }) {
  return request('/api/posts', {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ content, imageUrl }),
  });
}

export async function updatePost({ userId, postId, content, imageUrl }) {
  return request(`/api/posts/${postId}`, {
    method: 'PUT',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ content, imageUrl }),
  });
}

export async function deletePost({ userId, postId }) {
  return request(`/api/posts/${postId}`, {
    method: 'DELETE',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function createComment({ userId, postId, content, imageUrl }) {
  return request(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({
      content,
      imageUrl: imageUrl || null,
    }),
  });
}

export async function updatePostReaction({ userId, postId, type, action }) {
  const resolvedAction = action || (type ? 'set' : 'remove');
  return request(`/api/posts/${postId}/reaction`, {
    method: 'PUT',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({
      type: type || null,
      action: resolvedAction,
    }),
  });
}

export async function uploadPostImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    if (import.meta.env.DEV) {
      console.error('API upload failed', {
        path: '/api/upload',
        status: response.status,
        message: data.message || data.error || 'Tải ảnh thất bại',
      });
    }
    throw new Error(data.error || 'Tải ảnh thất bại');
  }

  return data.url;
}

export async function previewPostImage(file, userId) {
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch(`${API_URL}/api/posts/preview-image`, {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Không thể duyệt ảnh');
  return data.data;
}

export async function fetchPendingImageModeration(userId) {
  return request('/api/admin/image-moderation/pending', { headers: userId ? { 'x-user-id': userId } : {} });
}

export async function reviewImageModeration({ userId, contentType, id, decision }) {
  return request(`/api/admin/image-moderation/${contentType}/${id}/${decision}`, {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function appealPostModeration({ userId, postId }) {
  return request(`/api/posts/${postId}/appeal`, { method: 'POST', headers: userId ? { 'x-user-id': userId } : {} });
}

export async function appealCommentModeration({ userId, postId, commentId }) {
  return request(`/api/posts/${postId}/comments/${commentId}/appeal`, { method: 'POST', headers: userId ? { 'x-user-id': userId } : {} });
}

export async function sharePost({ userId, postId, content = '', user = null }) {
  const headers = {};
  if (userId) {
    headers['x-user-id'] = userId;
    const name = user?.name || user?.full_name;
    if (name) {
      headers['x-user-name'] = encodeURIComponent(name);
    }
    const avatar = user?.avatar || user?.avatar_url;
    if (avatar) {
      headers['x-user-avatar'] = encodeURIComponent(avatar);
    }
  }

  return request(`/api/posts/${postId}/share`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });
}

export async function fetchNotifications({ userId, limit = 30, offset = 0, filter = 'all' } = {}) {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    filter,
  }).toString();

  return request(`/api/notifications?${query}`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function fetchUnreadNotificationsCount({ userId } = {}) {
  return request('/api/notifications/unread-count', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function markNotificationAsRead({ userId, notificationId }) {
  return request(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function markAllNotificationsAsRead({ userId }) {
  return request('/api/notifications/read-all', {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function deleteNotificationApi({ userId, notificationId }) {
  return request(`/api/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function clearReadNotificationsApi({ userId }) {
  return request('/api/notifications/read', {
    method: 'DELETE',
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function fetchUsersList({ search = '', role = 'all', page = 1, limit = 10, userId } = {}) {
  const query = new URLSearchParams({
    search: search || '',
    role: role || 'all',
    page: String(page || 1),
    limit: String(limit || 10),
  });
  return request(`/api/users?${query.toString()}`, {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function updateUserRoleApi({ targetUserId, newRole, userId }) {
  return request(`/api/users/${targetUserId}/role`, {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ role: newRole }),
  });
}

export async function updateUserVerificationApi({ targetUserId, isVerified, userId }) {
  return request(`/api/users/${targetUserId}/verification`, {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ isVerified }),
  });
}

export async function updateUserSanctionApi({ targetUserId, action, durationDays = null, reason = '', userId }) {
  return request(`/api/users/${targetUserId}/sanction`, {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ action, durationDays, reason }),
  });
}

export async function createReportApi(reportData, userId) {
  const effectiveUserId = userId || reportData.reporter?.id;
  return request('/api/reports', {
    method: 'POST',
    headers: effectiveUserId ? { 'x-user-id': effectiveUserId } : {},
    body: JSON.stringify(reportData),
  });
}

export async function fetchReportsList(userId) {
  return request('/api/reports', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function resolveReportApi({ reportId, status, newLabel, oldLabel, adminNotes, userId }) {
  return request(`/api/reports/${reportId}`, {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ status, newLabel, oldLabel, adminNotes }),
  });
}

export async function fetchAppealsList(userId) {
  return request('/api/appeals', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function createAppealApi(appealData, userId) {
  const effectiveUserId = userId || appealData.user?.id;
  return request('/api/appeals', {
    method: 'POST',
    headers: effectiveUserId ? { 'x-user-id': effectiveUserId } : {},
    body: JSON.stringify(appealData),
  });
}

export async function resolveAppealApi({ appealId, status, newLabel, adminNotes, userId }) {
  return request(`/api/appeals/${appealId}`, {
    method: 'PATCH',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ status, newLabel, adminNotes }),
  });
}

export async function fetchAiOverridesList(userId) {
  return request('/api/admin/ai-overrides', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function createAiOverrideApi({ data, userId }) {
  return request('/api/admin/override-ai-label', {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify(data),
  });
}



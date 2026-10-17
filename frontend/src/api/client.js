const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  // TODO(US-2): replace x-user-id with the real authenticated session.
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
  return request(`/api/posts/${postId}`, {
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

export async function createComment({ userId, postId, content, imageUrl, imageLabel }) {
  return request(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({
      content,
      imageUrl: imageUrl || null,
      imageLabel: imageLabel || 'Safe',
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

export async function fetchPendingImageModeration(userId) {
  return request('/api/admin/image-moderation/pending', { headers: userId ? { 'x-user-id': userId } : {} });
}

export async function reviewImageModeration({ userId, contentType, id, decision }) {
  return request(`/api/admin/image-moderation/${contentType}/${id}/${decision}`, {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
  });
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

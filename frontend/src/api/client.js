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

export async function createPost({ userId, content, imageUrl }) {
  return request('/api/posts', {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ content, imageUrl }),
  });
}

export async function createComment({ userId, postId, content }) {
  return request(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ content }),
  });
}

export async function updatePostReaction({ userId, postId, type }) {
  return request(`/api/posts/${postId}/reaction`, {
    method: 'PUT',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify(type ? { type } : {}),
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

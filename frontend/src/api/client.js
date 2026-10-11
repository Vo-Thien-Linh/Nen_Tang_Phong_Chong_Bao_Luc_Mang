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

export async function fetchPosts({ userId } = {}) {
  return request('/api/posts', {
    headers: userId ? { 'x-user-id': userId } : {},
  });
}

export async function createPost({ userId, title, content, imageUrl }) {
  return request('/api/posts', {
    method: 'POST',
    headers: userId ? { 'x-user-id': userId } : {},
    body: JSON.stringify({ title, content, imageUrl }),
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
    throw new Error(data.error || 'Tải ảnh thất bại');
  }

  return data.url;
}

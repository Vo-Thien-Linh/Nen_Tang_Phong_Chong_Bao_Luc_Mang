const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function updatePostReaction({ userId, postId, type }) {
  const response = await fetch(`${API_URL}/api/posts/${postId}/reaction`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
    },
    body: JSON.stringify(type ? { type } : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Thả icon thất bại');
    error.status = response.status;
    throw error;
  }

  return data;
}

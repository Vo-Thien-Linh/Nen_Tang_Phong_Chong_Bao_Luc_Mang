const API_ROOT = import.meta.env.VITE_FASTAPI_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE_URL = `${API_ROOT}/api/v1/livestreams`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('nexussocial_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

async function getErrorMessage(res, fallback) {
  const body = await res.text();
  if (!body) return fallback;

  try {
    const payload = JSON.parse(body);
    return payload.detail || payload.message || payload.error || fallback;
  } catch {
    return body.slice(0, 300) || fallback;
  }
}

export const livestreamService = {
  async createLiveStream(data) {
    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      throw new Error(await getErrorMessage(res, 'Không thể tạo phiên phát trực tiếp'));
    }
    return await res.json();
  },

  async getActiveStreams() {
    const res = await fetch(API_BASE_URL, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Không thể lấy danh sách livestream');
    return await res.json();
  },

  async getStreamDetail(sessionId) {
    const res = await fetch(`${API_BASE_URL}/${sessionId}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Không thể lấy thông tin phòng live');
    return await res.json();
  },

  async endLiveStream(sessionId) {
    const res = await fetch(`${API_BASE_URL}/${sessionId}/end`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Không thể kết thúc livestream');
    return await res.json();
  },

  async postComment(sessionId, content) {
    const res = await fetch(`${API_BASE_URL}/${sessionId}/comments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content })
    });
    if (!res.ok) {
      throw new Error(await getErrorMessage(res, 'Không thể gửi bình luận'));
    }
    return await res.json();
  },

  async getComments(sessionId) {
    const res = await fetch(`${API_BASE_URL}/${sessionId}/comments`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Không thể tải bình luận');
    return await res.json();
  },

  async moderateFrame(sessionId, frameBase64, sampleTag = 'normal') {
    const res = await fetch(`${API_BASE_URL}/${sessionId}/moderate-frame`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ frame_base64: frameBase64, sample_tag: sampleTag })
    });
    if (!res.ok) throw new Error('Không thể kiểm duyệt khung hình');
    return await res.json();
  },

  async terminateStream(sessionId, reason) {
    const res = await fetch(`${API_BASE_URL}/${sessionId}/terminate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error('Không thể cưỡng chế ngắt phòng live');
    return await res.json();
  }
};

/**
 * callMediaLogic.js
 * Quản lý trạng thái, định dạng và tiện ích WebRTC cho cuộc gọi video/thoại
 */

export const CALL_STATUS = {
  IDLE: 'idle',
  OUTGOING: 'outgoing',
  INCOMING: 'incoming',
  CONNECTED: 'connected',
  ENDED: 'ended'
};

export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

/**
 * Định dạng thời lượng cuộc gọi từ giây sang chuỗi đọc được (mm:ss hoặc hh:mm:ss)
 */
export function formatCallDuration(totalSeconds = 0) {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remainingSeconds = sec % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
  }
  return `${pad(minutes)}:${pad(remainingSeconds)}`;
}

/**
 * Khởi tạo dữ liệu phiên cuộc gọi
 */
export function createCallSession({
  callerId,
  receiverId,
  callType = 'video',
  partnerName = 'Người dùng',
  partnerAvatar = ''
}) {
  return {
    sessionId: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    callerId: String(callerId),
    receiverId: String(receiverId),
    callType, // 'video' | 'audio'
    partnerName,
    partnerAvatar,
    startTime: null,
    duration: 0
  };
}

/**
 * Bật/Tắt track âm thanh hoặc hình ảnh trong MediaStream
 */
export function toggleMediaTrack(stream, kind, enabled) {
  if (!stream) return false;
  let tracks = [];
  if (kind === 'audio') {
    tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
  } else if (kind === 'video') {
    tracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
  }
  if (!tracks.length && stream.getTracks) {
    tracks = stream.getTracks().filter(t => t.kind === kind);
  }
  tracks.forEach(track => {
    track.enabled = Boolean(enabled);
  });
  return tracks.length > 0;
}

/**
 * Dừng toàn bộ các luồng (Camera, Mic) để giải phóng tài nguyên phần cứng
 */
export function stopMediaStream(stream) {
  if (!stream) return;
  try {
    const tracks = stream.getTracks ? stream.getTracks() : [];
    tracks.forEach(track => {
      if (typeof track.stop === 'function') {
        track.stop();
      }
    });
  } catch (err) {
    console.warn('Lỗi khi dừng media stream:', err);
  }
}

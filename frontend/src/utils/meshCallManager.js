/**
 * meshCallManager.js
 * Quản lý cấu trúc mạng Full Mesh P2P WebRTC cho cuộc gọi nhóm (Group Video Call)
 * Hỗ trợ tạo kết nối đồng cấp với từng thành viên, chuyển tiếp SDP Offer/Answer,
 * ICE Candidates và thay thế track (Screen share, AR Face Filters).
 */

import { DEFAULT_ICE_SERVERS } from './callMediaLogic.js';

export class MeshCallManager {
  constructor({ iceServers = DEFAULT_ICE_SERVERS } = {}) {
    this.iceServers = iceServers;
    this.localStream = null;
    this.currentVideoTrack = null;
    this.peers = new Map(); // remoteUserId -> { pc: RTCPeerConnection, stream: MediaStream }
    this.pendingCandidates = new Map(); // remoteUserId -> RTCIceCandidate[]
    this.onSignal = null;
    this.onRemoteStream = null;
    this.onPeerLeft = null;
    this.onScreenShareChange = null;
    this.isDestroyed = false;
  }

  init({ localStream, onSignal, onRemoteStream, onPeerLeft, onScreenShareChange }) {
    this.localStream = localStream;
    this.currentVideoTrack = localStream?.getVideoTracks 
      ? localStream.getVideoTracks()[0] 
      : (localStream?.getTracks ? localStream.getTracks().find(t => t.kind === 'video') : null);
    this.onSignal = onSignal;
    this.onRemoteStream = onRemoteStream;
    this.onPeerLeft = onPeerLeft;
    this.onScreenShareChange = onScreenShareChange;
    this.pendingCandidates = new Map();
    this.isDestroyed = false;
  }

  setLocalStream(stream) {
    this.localStream = stream;
    const vTrack = stream?.getVideoTracks 
      ? stream.getVideoTracks()[0] 
      : (stream?.getTracks ? stream.getTracks().find(t => t.kind === 'video') : null);
    if (vTrack) {
      this.currentVideoTrack = vTrack;
    }
  }

  async createPeer(remoteUserId, isInitiator = false) {
    if (this.isDestroyed || !remoteUserId) return null;
    const userIdStr = String(remoteUserId);

    if (this.peers.has(userIdStr)) {
      const existing = this.peers.get(userIdStr);
      if (existing.pc && existing.pc.signalingState !== 'closed') {
        if (isInitiator) {
          if (existing.pc.localDescription && this.onSignal) {
            this.onSignal(userIdStr, { sdp: existing.pc.localDescription });
          } else if (!existing.pc.localDescription) {
            try {
              const offer = await existing.pc.createOffer();
              await existing.pc.setLocalDescription(offer);
              if (this.onSignal) {
                this.onSignal(userIdStr, { sdp: existing.pc.localDescription || offer });
              }
            } catch (err) {
              console.warn(`[MeshCallManager] Lỗi tạo offer lại cho peer ${userIdStr}:`, err);
            }
          }
        }
        return existing.pc;
      }
      this.removePeer(userIdStr);
    }

    const PeerConnClass = typeof window !== 'undefined' && window.RTCPeerConnection 
      ? window.RTCPeerConnection 
      : (globalThis.RTCPeerConnection || null);

    if (!PeerConnClass) {
      console.warn('[MeshCallManager] RTCPeerConnection không khả dụng trong môi trường này');
      return null;
    }

    const pc = new PeerConnClass({
      iceServers: this.iceServers
    });

    const MediaStreamClass = typeof window !== 'undefined' && window.MediaStream
      ? window.MediaStream
      : (globalThis.MediaStream || class {
        constructor() { this.tracks = []; }
        addTrack(t) { this.tracks.push(t); }
        getTracks() { return this.tracks; }
        getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
        getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
      });

    const remoteStream = new MediaStreamClass();

    this.peers.set(userIdStr, { pc, stream: remoteStream });

    // 1. Thêm các track cục bộ vào kết nối đồng cấp (đảm bảo luôn dùng active video track mới nhất)
    if (this.localStream && typeof this.localStream.getTracks === 'function') {
      const allTracks = this.localStream.getTracks();
      const activeVideoTrack = this.currentVideoTrack || (
        this.localStream.getVideoTracks 
          ? this.localStream.getVideoTracks()[0] 
          : allTracks.find(t => t.kind === 'video')
      );
      const audioTracks = typeof this.localStream.getAudioTracks === 'function' 
        ? this.localStream.getAudioTracks() 
        : allTracks.filter(t => t.kind === 'audio');

      audioTracks.forEach(track => {
        try {
          pc.addTrack(track, this.localStream);
        } catch (err) {
          console.warn(`[MeshCallManager] Không thể thêm audio track cho peer ${userIdStr}:`, err);
        }
      });

      if (activeVideoTrack) {
        try {
          pc.addTrack(activeVideoTrack, this.localStream);
        } catch (err) {
          console.warn(`[MeshCallManager] Không thể thêm video track cho peer ${userIdStr}:`, err);
        }
      }
    }

    // 2. Nhận track từ phía thành viên khác
    pc.ontrack = (event) => {
      if (event.track) {
        if (typeof remoteStream.addTrack === 'function') {
          remoteStream.addTrack(event.track);
        }
        if (this.onRemoteStream) {
          this.onRemoteStream(userIdStr, event.streams?.[0] || remoteStream);
        }
      }
    };

    // 3. Xử lý ICE Candidate
    pc.onicecandidate = (event) => {
      if (event.candidate && this.onSignal) {
        this.onSignal(userIdStr, { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(userIdStr);
      }
    };

    // 4. Nếu là bên khởi tạo kết nối (Initiator): tạo Offer và gửi đi
    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (this.onSignal) {
          this.onSignal(userIdStr, { sdp: pc.localDescription || offer });
        }
      } catch (err) {
        console.warn(`[MeshCallManager] Lỗi tạo offer cho peer ${userIdStr}:`, err);
      }
    }

    return pc;
  }

  async handleSignal(fromUserId, signal) {
    if (this.isDestroyed || !fromUserId || !signal) return;
    const userIdStr = String(fromUserId);

    // Xử lý sự kiện thay đổi trạng thái chia sẻ màn hình
    if (signal.type === 'SCREEN_SHARE_CHANGE') {
      if (this.onScreenShareChange) {
        this.onScreenShareChange(userIdStr, Boolean(signal.is_sharing));
      }
      return;
    }

    let peerEntry = this.peers.get(userIdStr);
    let pc = peerEntry ? peerEntry.pc : null;

    // Xử lý SDP (Offer hoặc Answer)
    if (signal.sdp) {
      const sdpType = signal.sdp.type;

      if (sdpType === 'offer') {
        // Bên nhận Offer: tạo peer nếu chưa có (isInitiator = false)
        if (!pc || pc.signalingState === 'closed') {
          pc = await this.createPeer(userIdStr, false);
        }
        if (!pc) return;

        const SdpClass = typeof window !== 'undefined' && window.RTCSessionDescription
          ? window.RTCSessionDescription
          : globalThis.RTCSessionDescription;

        await pc.setRemoteDescription(new SdpClass(signal.sdp));
        await this.flushPendingCandidates(userIdStr, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (this.onSignal) {
          this.onSignal(userIdStr, { sdp: pc.localDescription || answer });
        }
      } else if (sdpType === 'answer') {
        if (pc && pc.signalingState !== 'closed') {
          const SdpClass = typeof window !== 'undefined' && window.RTCSessionDescription
            ? window.RTCSessionDescription
            : globalThis.RTCSessionDescription;
          await pc.setRemoteDescription(new SdpClass(signal.sdp));
          await this.flushPendingCandidates(userIdStr, pc);
        }
      }
    }

    // Xử lý ICE Candidate
    if (signal.candidate) {
      if (pc && pc.remoteDescription && pc.signalingState !== 'closed') {
        try {
          const CandidateClass = typeof window !== 'undefined' && window.RTCIceCandidate
            ? window.RTCIceCandidate
            : globalThis.RTCIceCandidate;
          await pc.addIceCandidate(new CandidateClass(signal.candidate));
        } catch (err) {
          console.warn(`[MeshCallManager] Không thể thêm ICE candidate từ ${userIdStr}:`, err);
        }
      } else {
        if (!this.pendingCandidates.has(userIdStr)) {
          this.pendingCandidates.set(userIdStr, []);
        }
        this.pendingCandidates.get(userIdStr).push(signal.candidate);
      }
    }
  }

  async flushPendingCandidates(userIdStr, pc) {
    if (!this.pendingCandidates.has(userIdStr) || !pc) return;
    const candidates = this.pendingCandidates.get(userIdStr) || [];
    this.pendingCandidates.delete(userIdStr);
    const CandidateClass = typeof window !== 'undefined' && window.RTCIceCandidate
      ? window.RTCIceCandidate
      : globalThis.RTCIceCandidate;
    for (const cand of candidates) {
      try {
        await pc.addIceCandidate(new CandidateClass(cand));
      } catch (e) {
        // silent
      }
    }
  }

  async replaceVideoTrack(newVideoTrack) {
    if (!newVideoTrack) return false;
    this.currentVideoTrack = newVideoTrack;
    let anySuccess = false;

    for (const [userId, { pc }] of this.peers.entries()) {
      if (!pc || pc.signalingState === 'closed') continue;
      try {
        const senders = typeof pc.getSenders === 'function' ? pc.getSenders() : [];
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender && typeof videoSender.replaceTrack === 'function') {
          await videoSender.replaceTrack(newVideoTrack);
          anySuccess = true;
        }
      } catch (err) {
        console.warn(`[MeshCallManager] Lỗi thay thế video track cho peer ${userId}:`, err);
      }
    }

    return anySuccess;
  }

  broadcastSignal(signal) {
    if (this.isDestroyed || !this.onSignal) return;
    for (const remoteUserId of this.peers.keys()) {
      try {
        this.onSignal(remoteUserId, signal);
      } catch (err) {
        console.warn(`[MeshCallManager] Lỗi broadcast signal tới ${remoteUserId}:`, err);
      }
    }
  }

  sendSignal(remoteUserId, signal) {
    if (this.isDestroyed || !this.onSignal || !remoteUserId) return;
    try {
      this.onSignal(String(remoteUserId), signal);
    } catch (err) {
      console.warn(`[MeshCallManager] Lỗi gửi signal tới ${remoteUserId}:`, err);
    }
  }

  removePeer(remoteUserId) {
    if (!remoteUserId) return;
    const userIdStr = String(remoteUserId);
    const peerEntry = this.peers.get(userIdStr);

    if (peerEntry) {
      try {
        if (peerEntry.pc && typeof peerEntry.pc.close === 'function') {
          peerEntry.pc.close();
        }
      } catch (err) {
        console.warn(`[MeshCallManager] Lỗi đóng peer ${userIdStr}:`, err);
      }
      this.peers.delete(userIdStr);
      if (this.onPeerLeft) {
        this.onPeerLeft(userIdStr);
      }
    }
  }

  getPeersCount() {
    return this.peers.size;
  }

  destroy() {
    this.isDestroyed = true;
    for (const userId of Array.from(this.peers.keys())) {
      this.removePeer(userId);
    }
    this.peers.clear();
    this.localStream = null;
    this.onSignal = null;
    this.onRemoteStream = null;
    this.onPeerLeft = null;
  }
}

/**
 * Tính toán bố cục lưới (Grid Layout) tối ưu theo số lượng người tham gia (1-6 người)
 */
export function getMeshGridLayoutClass(participantCount = 1) {
  const count = Math.max(1, Math.min(6, participantCount));
  switch (count) {
    case 1:
      return 'grid-cols-1 grid-rows-1';
    case 2:
      return 'grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1';
    case 3:
      return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
    case 4:
      return 'grid-cols-2 grid-rows-2';
    case 5:
    case 6:
      return 'grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2';
    default:
      return 'grid-cols-2 sm:grid-cols-3';
  }
}

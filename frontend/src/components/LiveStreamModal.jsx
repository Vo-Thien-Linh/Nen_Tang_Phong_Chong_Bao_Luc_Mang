import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Users, ShieldAlert,
  Send, Heart, AlertTriangle, Radio, Sparkles, MessageSquare,
  Eye, X, ShieldCheck, Flag, Volume2, VolumeX, RefreshCw
} from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { livestreamService } from '../services/livestreamService';

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

export default function LiveStreamModal({
  isOpen = false,
  mode = 'view', // 'broadcast' | 'view'
  session = null,
  currentUser = null,
  initialStream = null,
  onClose,
  onEndStream,
  onTerminateStream
}) {
  // Tự động nhận diện nếu người dùng hiện tại chính là Streamer của phòng phát sóng này
  const isHostStreamer = Boolean(
    mode === 'broadcast' ||
    (currentUser?.id && session?.streamer_id && String(session.streamer_id) === String(currentUser.id))
  );
  const effectiveMode = isHostStreamer ? 'broadcast' : 'view';

  const [localStream, setLocalStream] = useState(initialStream);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isViewerMuted, setIsViewerMuted] = useState(true);
  const [streamLoading, setStreamLoading] = useState(effectiveMode === 'view');
  const [streamerIsVideoOff, setStreamerIsVideoOff] = useState(false);
  const [streamerOnline, setStreamerOnline] = useState(true);
  const [hasCamera, setHasCamera] = useState(true);
  const [hasMic, setHasMic] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [viewerCount, setViewerCount] = useState(session?.viewer_count || 1);
  const [comments, setComments] = useState([]);
  const [inputComment, setInputComment] = useState('');
  const [nudgeAlert, setNudgeAlert] = useState(null);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [isTerminated, setIsTerminated] = useState(session?.status === 'TERMINATED_FOR_VIOLATION');
  const [terminationReason, setTerminationReason] = useState(session?.termination_reason || '');
  const [isStreamEnded, setIsStreamEnded] = useState(
    session?.status === 'ENDED' || Boolean(session?.ended_at)
  );
  const [streamEndedInfo, setStreamEndedInfo] = useState({
    message: session?.status === 'ENDED' ? 'Buổi phát trực tiếp đã kết thúc' : '',
    endedAt: session?.ended_at || null,
    streamerName: session?.streamer_name || 'Người phát sóng'
  });

  const videoRef = useRef(null);
  const viewerVideoRef = useRef(null);
  const chatBottomRef = useRef(null);
  const wsRef = useRef(null);
  const viewerPcRef = useRef(null);
  const streamerPcsRef = useRef({});
  const localStreamRef = useRef(null);
  const viewerPendingCandidatesRef = useRef([]);
  const streamerPendingCandidatesRef = useRef({});
  const lastRequestTimeRef = useRef(0);
  const lastOfferTimeRef = useRef({});

  // Đồng bộ initialStream nhận từ CreateLiveStreamModal hoặc global broadcast
  useEffect(() => {
    if (initialStream) {
      setLocalStream(initialStream);
      setHasCamera(initialStream.getVideoTracks().length > 0);
      setHasMic(initialStream.getAudioTracks().length > 0);
      setCameraError(null);
      if (effectiveMode === 'view') {
        setRemoteStream(initialStream);
        setStreamLoading(false);
      }
    } else if (effectiveMode === 'view') {
      if (window.__wings_active_broadcast_stream && window.__wings_active_broadcast_stream.active) {
        setRemoteStream(window.__wings_active_broadcast_stream);
        setStreamLoading(false);
      }
    }
  }, [initialStream, effectiveMode]);

  // Lưu trữ stream vào biến window và localStreamRef để đồng bộ tốc độ cao tức thì
  useEffect(() => {
    localStreamRef.current = localStream;
    if (localStream && effectiveMode === 'broadcast') {
      window.__wings_active_broadcast_stream = localStream;
    }
  }, [localStream, effectiveMode]);

  // Dọn dẹp triệt để luồng video của người xem để giải phóng và không bị đóng băng hình ảnh cuối
  const stopRemoteStream = useCallback(() => {
    if (viewerVideoRef.current) {
      try {
        viewerVideoRef.current.pause();
        viewerVideoRef.current.srcObject = null;
      } catch (e) {}
    }
    if (viewerPcRef.current) {
      try {
        viewerPcRef.current.close();
      } catch (e) {}
      viewerPcRef.current = null;
    }
    setRemoteStream(null);
    setStreamLoading(false);
  }, []);

  // Xử lý khi buổi livestream kết thúc
  const handleStreamEnded = useCallback((info = {}) => {
    setIsStreamEnded(true);
    setStreamEndedInfo((prev) => ({
      ...prev,
      message: info.message || 'Buổi phát trực tiếp đã kết thúc',
      endedAt: info.ended_at || new Date().toISOString(),
      streamerName: info.streamer_name || session?.streamer_name || 'Streamer'
    }));
    stopRemoteStream();
  }, [session?.streamer_name, stopRemoteStream]);

  // Đồng bộ trạng thái kết thúc hoặc vi phạm từ props session
  useEffect(() => {
    if (session?.status === 'ENDED' || Boolean(session?.ended_at)) {
      handleStreamEnded({
        message: 'Buổi phát trực tiếp đã kết thúc',
        ended_at: session?.ended_at,
        streamer_name: session?.streamer_name
      });
    }
    if (session?.status === 'TERMINATED_FOR_VIOLATION') {
      setIsTerminated(true);
      setTerminationReason(session?.termination_reason || 'Nội dung vi phạm nghiêm trọng quy chuẩn phòng chống bạo lực mạng.');
      stopRemoteStream();
    }
  }, [session?.status, session?.ended_at, session?.streamer_name, session?.termination_reason, handleStreamEnded, stopRemoteStream]);

  // Cơ chế Polling Fallback (3 giây một lần) dành cho người xem để phát hiện tức thì khi streamer đã tắt live
  useEffect(() => {
    if (!isOpen || effectiveMode !== 'view' || !session?.id || isStreamEnded || isTerminated) return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const detail = await livestreamService.getStreamDetail(session.id);
        if (!isMounted) return;
        if (detail.status === 'ENDED' || detail.ended_at) {
          handleStreamEnded({
            message: `Buổi phát trực tiếp của ${detail.streamer_name || session?.streamer_name || 'Streamer'} đã kết thúc.`,
            ended_at: detail.ended_at,
            streamer_name: detail.streamer_name
          });
        } else if (detail.status === 'TERMINATED_FOR_VIOLATION') {
          setIsTerminated(true);
          setTerminationReason(detail.termination_reason || 'Nội dung vi phạm nghiêm trọng quy chuẩn phòng chống bạo lực mạng.');
          stopRemoteStream();
        }
      } catch (err) {
        if (err.message && (err.message.includes('404') || err.message.includes('Không tìm thấy'))) {
          if (isMounted) {
            handleStreamEnded({
              message: 'Buổi phát trực tiếp đã kết thúc hoặc không còn tồn tại.'
            });
          }
        }
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [isOpen, effectiveMode, session?.id, isStreamEnded, isTerminated, session?.streamer_name, handleStreamEnded, stopRemoteStream]);

  // Nạp danh sách bình luận THẬT từ CSDL PostgreSQL/SQLite khi mở phòng
  useEffect(() => {
    if (!isOpen || !session?.id) return;
    livestreamService.getComments(session.id)
      .then((data) => {
        if (Array.isArray(data)) {
          setComments(data);
        }
      })
      .catch((err) => {
        console.error('Lỗi khi nạp bình luận từ CSDL:', err);
      });
  }, [isOpen, session?.id]);

  // Khởi động Camera/Mic nếu là người phát và chưa có stream sẵn (chuẩn HD 540p 30fps siêu mượt, không lag)
  useEffect(() => {
    if (!isOpen || effectiveMode !== 'broadcast' || localStream) return;

    let isMounted = true;
    const acquireMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 960, max: 1280 },
            height: { ideal: 540, max: 720 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        if (isMounted) {
          localStreamRef.current = stream;
          setLocalStream(stream);
          setHasCamera(true);
          setHasMic(true);
          setCameraError(null);
        }
      } catch (err1) {
        console.warn('Lỗi lấy cả camera và mic, thử lấy chỉ video:', err1);
        try {
          const videoOnly = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 960, max: 1280 },
              height: { ideal: 540, max: 720 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: 'user'
            },
            audio: false
          });
          if (isMounted) {
            localStreamRef.current = videoOnly;
            setLocalStream(videoOnly);
            setHasCamera(true);
            setHasMic(false);
            setCameraError(null);
          }
        } catch (err2) {
          console.error('Không thể truy cập camera thực tế:', err2);
          if (isMounted) {
            setHasCamera(false);
            setCameraError('Chưa phát hiện Camera hoặc quyền truy cập bị chặn trên trình duyệt.');
          }
        }
      }
    };

    acquireMedia();

    return () => {
      isMounted = false;
    };
  }, [isOpen, effectiveMode, localStream]);

  // Đảm bảo gắn srcObject vào video element ngay khi stream hoặc ref sẵn sàng
  useEffect(() => {
    if (videoRef.current && localStream) {
      if (videoRef.current.srcObject !== localStream) {
        videoRef.current.srcObject = localStream;
      }
      videoRef.current.play().catch((err) => {
        console.warn('Autoplay video stream:', err);
      });
    }
  }, [localStream]);

  // Gắn luồng video nhận được vào video element của người xem
  useEffect(() => {
    if (viewerVideoRef.current && remoteStream) {
      if (viewerVideoRef.current.srcObject !== remoteStream) {
        viewerVideoRef.current.srcObject = remoteStream;
      }
      viewerVideoRef.current.play().catch((err) => {
        console.warn('Autoplay viewer video stream:', err);
      });
    }
  }, [remoteStream]);

  // Listener khi video viewer nhận được metadata để play tức thì
  useEffect(() => {
    const videoEl = viewerVideoRef.current;
    if (!videoEl) return;
    const handleLoaded = () => {
      videoEl.play().catch(() => {});
    };
    videoEl.addEventListener('loadedmetadata', handleLoaded);
    return () => {
      videoEl.removeEventListener('loadedmetadata', handleLoaded);
    };
  }, []);

  // Gửi tín hiệu xin luồng stream từ Streamer (chống gửi dồn dập lặp lại)
  const requestStreamFromStreamer = useCallback(() => {
    const now = Date.now();
    if (now - lastRequestTimeRef.current < 1500) return;
    lastRequestTimeRef.current = now;

    if (wsRef.current?.readyState === WebSocket.OPEN && session?.streamer_id) {
      wsRef.current.send(JSON.stringify({
        type: 'STREAM_REQUEST',
        target_user_id: String(session.streamer_id)
      }));
    }
  }, [session?.streamer_id]);

  // Streamer tạo Offer cho Viewer với cấu hình bundlePolicy max-bundle & giới hạn bitrate mượt mà
  const handleStreamRequest = useCallback(async (viewerId) => {
    const currentStream = localStreamRef.current;
    if (!currentStream) return;
    try {
      const vId = String(viewerId);
      const now = Date.now();
      if (lastOfferTimeRef.current[vId] && (now - lastOfferTimeRef.current[vId] < 1500)) {
        return;
      }
      lastOfferTimeRef.current[vId] = now;

      if (streamerPcsRef.current[vId]) {
        try { streamerPcsRef.current[vId].close(); } catch (e) {}
      }

      const pc = new RTCPeerConnection({
        iceServers: DEFAULT_ICE_SERVERS,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      });
      streamerPcsRef.current[vId] = pc;
      streamerPendingCandidatesRef.current[vId] = [];

      currentStream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, currentStream);
        if (track.kind === 'video') {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 1500000;
            params.encodings[0].maxFramerate = 30;
            params.encodings[0].priority = 'high';
            params.encodings[0].networkPriority = 'high';
            sender.setParameters(params);
          } catch (e) {}
        }
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'STREAM_ICE_CANDIDATE',
            candidate: event.candidate,
            target_user_id: vId
          }));
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      // Tối ưu hóa SDP: giới hạn bitrate 1.5 Mbps và đặt frame audio Opus 10ms
      let sdp = offer.sdp || '';
      sdp = sdp.replace(/m=video ([0-9]+) ([A-Z/]+) ([0-9 ]+)/g, (match) => {
        return `${match}\r\nb=AS:1500\r\nb=TIAS:1500000`;
      });
      sdp = sdp.replace(/useinbandfec=1/g, 'useinbandfec=1;minptime=10');

      await pc.setLocalDescription(new RTCSessionDescription({ type: offer.type, sdp }));

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'STREAM_OFFER',
          offer: { type: offer.type, sdp },
          target_user_id: vId
        }));
      }
    } catch (err) {
      console.warn('Lỗi tạo STREAM_OFFER:', err);
    }
  }, []);

  // Viewer xử lý Offer nhận được từ Streamer với hàng đợi ICE Candidate và playoutDelayHint = 0
  const handleReceiveOffer = useCallback(async (offer, streamerId) => {
    try {
      if (viewerPcRef.current) {
        try { viewerPcRef.current.close(); } catch (e) {}
      }

      const pc = new RTCPeerConnection({
        iceServers: DEFAULT_ICE_SERVERS,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      });
      viewerPcRef.current = pc;
      viewerPendingCandidatesRef.current = [];

      // Dùng 1 MediaStream duy nhất gom cả Audio + Video, gán ngay vào thẻ video
      const inboundStream = new MediaStream();

      pc.ontrack = (event) => {
        // Cực kỳ quan trọng: Ép Chromium bỏ jitter buffer trễ (playoutDelayHint = 0) để video mượt và thời gian thực
        if (event.receiver) {
          try {
            if ('playoutDelayHint' in event.receiver) event.receiver.playoutDelayHint = 0;
            if ('jitterBufferTarget' in event.receiver) event.receiver.jitterBufferTarget = 0;
          } catch (e) {}
        }

        if (event.track) {
          inboundStream.addTrack(event.track);
          event.track.onended = () => {
            if (session?.id) {
              livestreamService.getStreamDetail(session.id)
                .then((d) => {
                  if (d.status === 'ENDED' || d.ended_at) {
                    handleStreamEnded({
                      message: `Buổi phát trực tiếp của ${d.streamer_name || session?.streamer_name || 'Streamer'} đã kết thúc.`,
                      ended_at: d.ended_at,
                      streamer_name: d.streamer_name
                    });
                  }
                })
                .catch(() => {});
            }
          };
        }

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            if (session?.id) {
              livestreamService.getStreamDetail(session.id)
                .then((d) => {
                  if (d.status === 'ENDED' || d.ended_at) {
                    handleStreamEnded({
                      message: `Buổi phát trực tiếp của ${d.streamer_name || session?.streamer_name || 'Streamer'} đã kết thúc.`,
                      ended_at: d.ended_at,
                      streamer_name: d.streamer_name
                    });
                  }
                })
                .catch(() => {});
            }
          }
        };

        if (viewerVideoRef.current) {
          if (viewerVideoRef.current.srcObject !== inboundStream) {
            viewerVideoRef.current.srcObject = inboundStream;
          }
          viewerVideoRef.current.play().catch(() => {});
        }
        setRemoteStream(inboundStream);
        setStreamLoading(false);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'STREAM_ICE_CANDIDATE',
            candidate: event.candidate,
            target_user_id: String(streamerId)
          }));
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Xả toàn bộ ICE candidate đã đến trước khi setRemoteDescription hoàn tất
      while (viewerPendingCandidatesRef.current.length > 0) {
        const cand = viewerPendingCandidatesRef.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {}
      }

      const answer = await pc.createAnswer();
      let sdp = answer.sdp || '';
      sdp = sdp.replace(/m=video ([0-9]+) ([A-Z/]+) ([0-9 ]+)/g, (match) => {
        return `${match}\r\nb=AS:1500\r\nb=TIAS:1500000`;
      });
      await pc.setLocalDescription(new RTCSessionDescription({ type: answer.type, sdp }));

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'STREAM_ANSWER',
          answer: { type: answer.type, sdp },
          target_user_id: String(streamerId)
        }));
      }
    } catch (err) {
      console.warn('Lỗi xử lý STREAM_OFFER tại viewer:', err);
    }
  }, []);

  // Streamer xử lý Answer từ Viewer và xả ICE candidate hàng đợi
  const handleReceiveAnswer = useCallback(async (viewerId, answer) => {
    const vId = String(viewerId);
    const pc = streamerPcsRef.current[vId];
    if (pc && answer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        const pending = streamerPendingCandidatesRef.current[vId] || [];
        while (pending.length > 0) {
          const cand = pending.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Lỗi setRemoteDescription answer:', err);
      }
    }
  }, []);

  // Cả hai bên xử lý ICE Candidate có cơ chế xếp hàng đợi an toàn
  const handleReceiveIceCandidate = useCallback(async (fromUserId, candidate) => {
    if (!candidate) return;
    try {
      if (effectiveMode === 'broadcast') {
        const vId = String(fromUserId);
        const pc = streamerPcsRef.current[vId];
        if (pc) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            if (!streamerPendingCandidatesRef.current[vId]) {
              streamerPendingCandidatesRef.current[vId] = [];
            }
            streamerPendingCandidatesRef.current[vId].push(candidate);
          }
        }
      } else {
        const pc = viewerPcRef.current;
        if (pc) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            viewerPendingCandidatesRef.current.push(candidate);
          }
        }
      }
    } catch (err) {
      console.warn('Lỗi addIceCandidate:', err);
    }
  }, [effectiveMode]);

  // Kết nối WebSocket Realtime cho phòng Live (duy trì kết nối ổn định không bị reset)
  useEffect(() => {
    if (!isOpen || !session?.id || !currentUser?.id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/api/v1/livestreams/ws/${session.id}/${currentUser.id}`;

    let isSubscribed = true;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isSubscribed) return;
        if (effectiveMode === 'view') {
          setTimeout(requestStreamFromStreamer, 200);
        }
      };

      ws.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ROOM_STATUS') {
            setViewerCount(data.viewer_count || 1);
            if (Array.isArray(data.active_user_ids) && session?.streamer_id) {
              const isOnline = data.active_user_ids.some(
                (uid) => String(uid) === String(session.streamer_id)
              );
              setStreamerOnline(isOnline);
              if (!isOnline && effectiveMode === 'view' && session?.id) {
                livestreamService.getStreamDetail(session.id)
                  .then((d) => {
                    if (d.status === 'ENDED' || d.ended_at) {
                      handleStreamEnded({
                        message: `Buổi phát trực tiếp của ${d.streamer_name || session?.streamer_name || 'Streamer'} đã kết thúc.`,
                        ended_at: d.ended_at,
                        streamer_name: d.streamer_name
                      });
                    }
                  })
                  .catch(() => {});
              }
            }
            if (effectiveMode === 'view' && !remoteStream && !isStreamEnded) {
              requestStreamFromStreamer();
            }
          } else if (data.type === 'STREAM_REQUEST') {
            if (effectiveMode === 'broadcast') {
              handleStreamRequest(data.from_user_id);
            }
          } else if (data.type === 'STREAM_OFFER') {
            if (effectiveMode === 'view') {
              handleReceiveOffer(data.offer, data.from_user_id || session?.streamer_id);
            }
          } else if (data.type === 'STREAM_ANSWER') {
            if (effectiveMode === 'broadcast') {
              handleReceiveAnswer(data.from_user_id, data.answer);
            }
          } else if (data.type === 'STREAM_ICE_CANDIDATE') {
            handleReceiveIceCandidate(data.from_user_id, data.candidate);
          } else if (data.type === 'STREAMER_STATUS') {
            if (data.isVideoOff !== undefined) setStreamerIsVideoOff(data.isVideoOff);
          } else if (data.type === 'STREAM_ENDED') {
            handleStreamEnded({
              message: data.message || `Buổi phát trực tiếp của ${data.streamer_name || session?.streamer_name || 'Streamer'} đã kết thúc.`,
              ended_at: data.ended_at,
              streamer_name: data.streamer_name || session?.streamer_name
            });
          } else if (data.type === 'STREAMER_DISCONNECTED') {
            if (effectiveMode === 'view' && session?.id) {
              livestreamService.getStreamDetail(session.id)
                .then((d) => {
                  if (d.status === 'ENDED' || d.ended_at) {
                    handleStreamEnded({
                      message: `Buổi phát trực tiếp của ${d.streamer_name || session?.streamer_name || 'Streamer'} đã kết thúc.`,
                      ended_at: d.ended_at,
                      streamer_name: d.streamer_name
                    });
                  }
                })
                .catch(() => {});
            }
          } else if (data.type === 'NEW_LIVE_COMMENT') {
            setComments((prev) => [...prev, data]);
          } else if (data.type === 'CHAT_MODERATION_ALERT') {
            setNudgeAlert(data.message || 'Bình luận chứa ngôn từ không phù hợp đã bị ẩn.');
            setTimeout(() => setNudgeAlert(null), 5000);
          } else if (data.type === 'FLOATING_REACTION') {
            triggerFloatingReaction(data.reaction || '❤️');
          } else if (data.type === 'STREAM_TERMINATED') {
            setIsTerminated(true);
            setTerminationReason(data.reason || 'Vi phạm tiêu chuẩn cộng đồng');
            stopRemoteStream();
          }
        } catch (e) {
          console.error('Lỗi phân tích tin nhắn WebSocket:', e);
        }
      };

      ws.onerror = () => {};
    } catch (e) {
      console.warn('Không thể kết nối websocket live:', e);
    }

    return () => {
      isSubscribed = false;
      if (viewerPcRef.current) {
        try { viewerPcRef.current.close(); } catch (e) {}
        viewerPcRef.current = null;
      }
      Object.values(streamerPcsRef.current).forEach((pc) => {
        try { pc.close(); } catch (e) {}
      });
      streamerPcsRef.current = {};
      viewerPendingCandidatesRef.current = [];
      streamerPendingCandidatesRef.current = {};
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isOpen, session?.id, currentUser?.id, effectiveMode, requestStreamFromStreamer, handleStreamRequest, handleReceiveOffer, handleReceiveAnswer, handleReceiveIceCandidate, handleStreamEnded, stopRemoteStream, isStreamEnded]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const triggerFloatingReaction = (emoji) => {
    const createBubble = (delay = 0, scaleMultiplier = 1) => {
      const id = Date.now() + Math.random();
      const animationType = Math.floor(Math.random() * 3) + 1; // 1, 2, hoặc 3 cho các quỹ đạo uốn lượn phong phú
      // Tỏa ra tự nhiên từ khu vực các nút reaction (dưới bên phải) và lan tỏa bồng bềnh lên toàn màn hình
      const rightOffset = Math.floor(Math.random() * 58) + 5; // 5% đến 63% từ mép phải
      const baseSize = Math.floor(Math.random() * 14) + 34; // 34px đến 48px
      const size = Math.round(baseSize * scaleMultiplier);
      const duration = (2.6 + Math.random() * 0.8).toFixed(2); // 2.6s đến 3.4s

      setTimeout(() => {
        setFloatingReactions((prev) => [
          ...prev.slice(-45),
          { id, emoji, right: rightOffset, size, animationType, duration }
        ]);

        setTimeout(() => {
          setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
        }, 3600);
      }, delay);
    };

    createBubble(0, 1.1);
    // 50% cơ hội xuất hiện thêm 1 bong bóng nhỏ bay kèm tăng hiệu ứng bồng bềnh như TikTok Live
    if (Math.random() > 0.5) {
      createBubble(120, 0.85);
    }
  };

  const handleSendReaction = (emoji = '❤️') => {
    triggerFloatingReaction(emoji);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'LIVE_REACTION', reaction: emoji }));
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    const content = inputComment.trim();
    if (!content) return;
    setInputComment('');

    const payload = {
      type: 'LIVE_CHAT',
      content,
      user_name: currentUser?.full_name || 'Khán giả'
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      // Gửi trực tiếp tới API REST thật để lưu CSDL và kiểm duyệt AI thật
      try {
        const savedComment = await livestreamService.postComment(session.id, content);
        setComments((prev) => [...prev, savedComment]);
      } catch (err) {
        setNudgeAlert(err.message || 'Bình luận vi phạm tiêu chuẩn an toàn mạng');
        setTimeout(() => setNudgeAlert(null), 5000);
      }
    }
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'STREAMER_STATUS',
          isMuted: newMuted,
          isVideoOff
        }));
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
      const newVideoOff = !isVideoOff;
      setIsVideoOff(newVideoOff);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'STREAMER_STATUS',
          isMuted,
          isVideoOff: newVideoOff
        }));
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="relative w-full max-w-6xl h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row">
        
        {/* KHUNG TRÁI: VIDEO STREAM CHÍNH */}
        <div className="relative flex-1 bg-black flex flex-col justify-between overflow-hidden">
          
          {/* Header Video */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
              {isStreamEnded ? (
                <span id="live-stream-ended-badge" className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider border border-white/10">
                  <Radio className="w-3.5 h-3.5 text-slate-400" />
                  Đã kết thúc
                </span>
              ) : (
                <span id="live-stream-badge" className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-bold uppercase tracking-wider animate-pulse">
                  <Radio className="w-3.5 h-3.5" />
                  Trực tiếp
                </span>
              )}
              <span className="text-white text-sm font-semibold truncate max-w-[200px]">
                {session?.title || 'Phòng phát trực tiếp'}
              </span>
              <span className="flex items-center gap-1 text-slate-300 text-xs font-medium pl-2 border-l border-white/20">
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                {viewerCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-full font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Kiểm duyệt AI tự động
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Màn hình Video / Cảnh báo ngắt sóng */}
          <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-black">
            {isStreamEnded ? (
              /* MÀN HÌNH THÔNG BÁO LIVESTREAM ĐÃ KẾT THÚC CHUẨN FACEBOOK / TIKTOK */
              <div id="live-ended-overlay" className="relative w-full h-full flex items-center justify-center p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-black overflow-hidden animate-fadeIn">
                {/* Hiệu ứng ánh sáng hào quang ambient nền */}
                <div className="absolute w-80 h-80 rounded-full bg-rose-500/10 filter blur-3xl -top-10 -left-10 pointer-events-none" />
                <div className="absolute w-80 h-80 rounded-full bg-indigo-500/10 filter blur-3xl -bottom-10 -right-10 pointer-events-none" />

                {/* Khung Card thông báo chính */}
                <div className="relative z-10 max-w-md w-full bg-slate-900/90 border border-slate-700/70 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl backdrop-blur-xl">
                  
                  {/* Avatar streamer kèm huy hiệu kết thúc */}
                  <div className="relative mb-4">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-slate-700 via-rose-500/50 to-indigo-500/50 shadow-xl">
                      <img
                        src={session?.streamer_avatar || DEFAULT_AVATAR}
                        alt={session?.streamer_name || 'Streamer'}
                        className="w-full h-full rounded-full object-cover bg-slate-800"
                        onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                      <Radio className="w-3 h-3 text-rose-400" />
                      Đã kết thúc
                    </div>
                  </div>

                  {/* Tiêu đề thông báo */}
                  <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
                    Buổi phát trực tiếp đã kết thúc
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mb-5 max-w-xs leading-relaxed">
                    Cảm ơn bạn đã tham gia và theo dõi buổi phát trực tiếp của{' '}
                    <span className="text-indigo-300 font-bold">{streamEndedInfo.streamerName || session?.streamer_name || 'Streamer'}</span>.
                  </p>

                  {/* Bảng thống kê tóm tắt buổi live */}
                  <div className="w-full grid grid-cols-2 gap-3 mb-6 bg-slate-800/70 border border-slate-700/50 rounded-2xl p-3.5">
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mb-0.5">
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        Lượt xem
                      </span>
                      <span className="text-base font-bold text-white">{viewerCount || 1}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-slate-700/60">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mb-0.5">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        Bình luận
                      </span>
                      <span className="text-base font-bold text-white">{comments.length}</span>
                    </div>
                  </div>

                  {/* Nút thao tác rời phòng */}
                  <button
                    type="button"
                    id="btn-leave-ended-livestream"
                    onClick={onClose}
                    className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Rời phòng & Quay lại bảng tin</span>
                  </button>
                </div>
              </div>
            ) : isTerminated ? (
              <div className="flex flex-col items-center justify-center text-center p-8 bg-rose-950/80 border border-rose-500/50 rounded-2xl max-w-lg m-4 shadow-2xl backdrop-blur-lg">
                <AlertTriangle className="w-16 h-16 text-rose-500 animate-bounce mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">PHÒNG LIVE ĐÃ BỊ CƯỠNG CHẾ DỪNG</h3>
                <p className="text-sm text-rose-200 mb-4">{terminationReason || 'Nội dung vi phạm nghiêm trọng quy chuẩn phòng chống bạo lực mạng.'}</p>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition"
                >
                  Rời phòng
                </button>
              </div>
            ) : effectiveMode === 'broadcast' && localStream ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
                />
                
                {/* Khi streamer tạm tắt camera */}
                {isVideoOff && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950/90 backdrop-blur-md">
                    <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center mb-3 shadow-inner">
                      <VideoOff className="w-8 h-8 text-rose-400" />
                    </div>
                    <p className="text-sm font-bold text-white mb-1">Camera đang tạm tắt</p>
                    <p className="text-xs text-slate-400">Micro và âm thanh vẫn đang được phát sóng trực tiếp</p>
                  </div>
                )}

                {/* Huy hiệu hiển thị trạng thái Camera và Micro thời gian thực trên góc video */}
                <div className="absolute top-16 left-4 z-10 flex items-center gap-2">
                  <div className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-md border ${
                    !isVideoOff && hasCamera
                      ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 shadow-xs'
                      : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${!isVideoOff && hasCamera ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                    {isVideoOff ? 'Camera: Tắt' : hasCamera ? 'Camera: Hoạt động' : 'Không có camera'}
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-md border ${
                    !isMuted && hasMic
                      ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 shadow-xs'
                      : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${!isMuted && hasMic ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                    {isMuted ? 'Mic: Đã tắt tiếng' : hasMic ? 'Mic: Hoạt động' : 'Không có mic'}
                  </div>
                </div>
              </div>
            ) : effectiveMode === 'broadcast' && cameraError ? (
              <div className="flex flex-col items-center justify-center text-center p-6 text-slate-300 max-w-md">
                <div className="w-16 h-16 rounded-full bg-rose-950/80 border-2 border-rose-500/40 flex items-center justify-center mb-3">
                  <VideoOff className="w-8 h-8 text-rose-400 animate-pulse" />
                </div>
                <h4 className="text-white text-base font-bold mb-1">Chưa thể kết nối Camera</h4>
                <p className="text-xs text-slate-400 mb-4">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLocalStream(null);
                    setCameraError(null);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-indigo-600/30"
                >
                  Thử kết nối lại Camera & Mic
                </button>
              </div>
            ) : effectiveMode === 'view' && remoteStream ? (
              /* KHÁN GIẢ ĐANG XEM LUỒNG VIDEO TRỰC TIẾP THẬT */
              <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
                <video
                  ref={viewerVideoRef}
                  autoPlay
                  playsInline
                  muted={isViewerMuted}
                  controls={false}
                  disablePictureInPicture
                  className="w-full h-full object-cover"
                />

                {/* Khi streamer tạm tắt camera */}
                {streamerIsVideoOff && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950/90 backdrop-blur-md">
                    <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center mb-3 shadow-inner">
                      <VideoOff className="w-8 h-8 text-rose-400" />
                    </div>
                    <p className="text-sm font-bold text-white mb-1">Streamer đang tạm tắt Camera</p>
                    <p className="text-xs text-slate-400">Âm thanh vẫn đang được phát sóng trực tiếp</p>
                  </div>
                )}

                {/* Bảng điều khiển âm thanh và trạng thái dành cho người xem */}
                <div className="absolute top-16 left-4 z-20 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextMuted = !isViewerMuted;
                      setIsViewerMuted(nextMuted);
                      if (viewerVideoRef.current) {
                        viewerVideoRef.current.muted = nextMuted;
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border transition cursor-pointer shadow-lg ${
                      isViewerMuted
                        ? 'bg-rose-950/80 border-rose-500/50 text-rose-300 hover:bg-rose-900/90'
                        : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/90'
                    }`}
                  >
                    {isViewerMuted ? (
                      <>
                        <VolumeX className="w-4 h-4 text-rose-400 animate-pulse" />
                        <span>Chạm để bật tiếng</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                        <span>Đang phát âm thanh</span>
                      </>
                    )}
                  </button>

                  <div className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-md border bg-slate-900/80 border-white/10 text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>Đang xem trực tiếp</span>
                  </div>
                </div>
              </div>
            ) : effectiveMode === 'view' ? (
              /* ĐANG ĐỒNG BỘ TÍN HIỆU WEBRTC HOẶC CHỜ STREAMER */
              <div className="flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-300 max-w-lg m-4">
                <div className="relative mb-5">
                  <div className="w-24 h-24 rounded-full bg-slate-800/90 border-2 border-indigo-500/40 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                    <Radio className="w-10 h-10 text-indigo-400 animate-pulse" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${streamerOnline ? 'bg-rose-400' : 'bg-amber-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-4 w-4 ${streamerOnline ? 'bg-rose-600' : 'bg-amber-500'}`}></span>
                  </span>
                </div>

                <h4 className="text-white text-lg font-bold mb-1.5">
                  {session?.title || 'Phòng phát trực tiếp'}
                </h4>
                <p className="text-sm text-indigo-300 font-semibold mb-2">
                  {session?.streamer_name || 'Người dùng'} đang phát sóng
                </p>
                <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
                  {streamerOnline
                    ? 'Đang đồng bộ tín hiệu video thời gian thực từ camera của streamer qua giao thức WebRTC độ trễ cực thấp...'
                    : `Streamer (${session?.streamer_name || 'Người dùng'}) hiện chưa vào phòng live hoặc thiết bị chưa sẵn sàng.`}
                </p>

                <button
                  type="button"
                  onClick={requestStreamFromStreamer}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {streamerOnline ? 'Làm mới kết nối video' : 'Thử kết nối lại với Streamer'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-24 h-24 rounded-full bg-slate-800/80 border-2 border-indigo-500/30 flex items-center justify-center mb-4 shadow-inner">
                  <Video className="w-10 h-10 text-indigo-400 animate-pulse" />
                </div>
                <h4 className="text-white text-lg font-bold mb-1">
                  {session?.streamer_name || 'Người dùng'} đang phát sóng
                </h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  Luồng phát trực tiếp được mã hóa và giám sát bởi hệ thống phân tích ngôn từ bạo lực mạng thời gian thực.
                </p>
              </div>
            )}

            {/* Hiệu ứng bong bóng cảm xúc bay lượn sinh động trên màn hình video */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
              {floatingReactions.map((r) => {
                const animClass = r.animationType === 1
                  ? 'animate-float-sway-1'
                  : r.animationType === 2
                  ? 'animate-float-sway-2'
                  : 'animate-float-sway-3';
                return (
                  <div
                    key={r.id}
                    style={{
                      right: `${r.right}%`,
                      fontSize: `${r.size || 36}px`,
                      '--float-duration': `${r.duration || 2.8}s`,
                      textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
                    }}
                    className={`absolute bottom-20 select-none pointer-events-none will-change-transform ${animClass}`}
                  >
                    {r.emoji}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Thanh điều khiển dưới đáy Video */}
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2">
              {!isStreamEnded && effectiveMode === 'broadcast' && (
                <>
                  <button
                    id="btn-toggle-mic"
                    type="button"
                    onClick={toggleMic}
                    title={isMuted ? "Bật micro" : "Tắt micro"}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition border shadow-lg cursor-pointer ${
                      isMuted
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-black/60 border-white/20 text-white hover:bg-black/80'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  <button
                    id="btn-toggle-camera"
                    type="button"
                    onClick={toggleVideo}
                    title={isVideoOff ? "Bật camera" : "Tắt camera"}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition border shadow-lg cursor-pointer ${
                      isVideoOff
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-black/60 border-white/20 text-white hover:bg-black/80'
                    }`}
                  >
                    {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isStreamEnded && (
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md p-1.5 rounded-full border border-white/10">
                  {['❤️', '👏', '🔥', '🛡️'].map((emoji) => (
                    <button
                      key={emoji}
                      id={`btn-reaction-${emoji}`}
                      onClick={() => handleSendReaction(emoji)}
                      className="w-9 h-9 rounded-full hover:bg-white/20 flex items-center justify-center text-lg transition transform hover:scale-125 active:scale-95 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {!isStreamEnded && effectiveMode === 'broadcast' && (
                <button
                  type="button"
                  id="btn-end-livestream"
                  onClick={() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      try {
                        wsRef.current.send(JSON.stringify({
                          type: 'STREAM_ENDED',
                          session_id: session?.id,
                          streamer_name: currentUser?.full_name || session?.streamer_name
                        }));
                      } catch (e) {}
                    }
                    if (onEndStream) {
                      onEndStream(session?.id);
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold rounded-full flex items-center gap-1.5 transition shadow-lg shadow-rose-600/30 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  Kết thúc phát sóng
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KHUNG PHẢI: KHUNG CHAT REALTIME CÓ KIỂM DUYỆT TỰ ĐỘNG */}
        <div className="w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-72 lg:h-full">
          
          {/* Header Chat */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span className="text-white text-sm font-semibold">Trò chuyện trực tiếp</span>
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Lọc bạo lực mạng
            </span>
          </div>

          {/* Danh sách bình luận */}
          <div id="live-chat-messages-container" className="flex-1 overflow-y-auto p-4 space-y-3">
            {comments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs">
                <Sparkles className="w-6 h-6 text-slate-600 mb-1" />
                Hãy là người đầu tiên gửi lời chào văn minh!
              </div>
            ) : (
              comments.map((c, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs animate-fadeIn live-comment-item">
                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold shrink-0">
                    {c.user_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0 bg-slate-800/60 p-2.5 rounded-2xl rounded-tl-none border border-slate-700/50">
                    <span className="font-semibold text-indigo-300 block mb-0.5">{c.user_name}</span>
                    <p className="text-slate-200 break-words leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Cảnh báo vi phạm (Nudge / Warning Toast) */}
          {nudgeAlert && (
            <div id="live-nudge-alert" className="mx-3 mb-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="leading-tight font-medium">{nudgeAlert}</span>
            </div>
          )}

          {/* Cảnh báo kết thúc buổi live */}
          {isStreamEnded && (
            <div id="live-ended-chat-notice" className="mx-3 mb-2 p-2.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-slate-300 text-xs flex items-center gap-2 animate-fadeIn">
              <Radio className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="leading-tight">Buổi phát trực tiếp đã kết thúc. Cảm ơn mọi người đã tương tác văn minh!</span>
            </div>
          )}

          {/* Ô nhập bình luận */}
          <form onSubmit={handleSendComment} className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center gap-2">
            <input
              id="live-chat-input"
              type="text"
              value={inputComment}
              onChange={(e) => setInputComment(e.target.value)}
              placeholder={isStreamEnded ? "Buổi phát trực tiếp đã kết thúc" : "Gửi bình luận văn minh..."}
              className="flex-1 bg-slate-800/80 border border-slate-700 rounded-full px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isTerminated || isStreamEnded}
            />
            <button
              id="live-chat-send-btn"
              type="submit"
              disabled={!inputComment.trim() || isTerminated || isStreamEnded}
              className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center transition shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Send, Image as ImageIcon, Smile, MoreVertical, 
  Phone, Video, Check, CheckCheck, Clock, RotateCw, Loader2, MessageSquare, ArrowLeft,
  UserCheck, UserX, AlertCircle, ShieldAlert, Flag,
  Info, Maximize2, Minimize2, Paperclip, BellOff,
  User, FileText, ChevronRight, Ban, RotateCcw, ExternalLink, X, ZoomIn, Link as LinkIcon, Download,
  PhoneMissed, PhoneOff, Users, UserPlus, Camera, Pencil, Calendar
} from 'lucide-react';
import { messageService } from '../services/messageService';
import { authService } from '../services/authService';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { extractSharedMediaAndLinks, formatFileSize, validateFileAttachment } from '../utils/messageMediaLogic';
import { fetchStories, fetchUserStoriesApi } from '../api/client';
import VideoCallModal from './VideoCallModal';
import CreateGroupModal from './CreateGroupModal';
import GroupVideoCallModal from './GroupVideoCallModal';
import {
  CALL_STATUS,
  CALL_LOG_REASON,
  DEFAULT_ICE_SERVERS,
  formatCallDuration,
  formatCallLogText,
  toggleMediaTrack,
  stopMediaStream,
  applyVideoTrackToPeer
} from '../utils/callMediaLogic';
import { FaceFilterManager } from '../utils/faceFilterLogic';
import { MeshCallManager } from '../utils/meshCallManager';
import { useTranslation } from '../utils/i18n';
import { formatRelativeTime } from '../utils/timeAgo';
import {
  getMessageDateDivider,
  getMessageTimeDivider,
  formatFullTimestamp
} from '../utils/chatTimeDividers';

const EMOJI_CATEGORIES = [
  {
    name: 'Mặt cười & Cảm xúc',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', '😜', '🤪', '😎', '🥳', '😴', '🤯']
  },
  {
    name: 'Cử chỉ & Trái tim',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '🤟', '👌', '👋', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💖', '💯', '🔥']
  },
  {
    name: 'Đồ vật & Biểu tượng',
    emojis: ['🎉', '🎊', '🎈', '🎁', '🏆', '🌟', '⭐', '✨', '🚀', '💡', '📌', '☕', '🍕', '🍔', '🍦', '🐱', '🐶', '🌸', '🌈', '☀️', '🎵', '💬']
  }
];

const getWsBaseUrl = () => {
  const configured = import.meta.env.VITE_FASTAPI_URL || import.meta.env.VITE_API_URL;
  if (configured) {
    return configured.replace(/^http/, 'ws');
  }
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5000';
  return `${protocol}//${host}`;
};

function createAuthenticatedRealtimeSocket(wsUrl, userId) {
  const token = authService.getToken();
  if (!token) throw new Error('Bạn cần đăng nhập để kết nối cuộc gọi.');
  return new WebSocket(`${wsUrl}/api/v1/messages/ws/${encodeURIComponent(userId)}`, [
    'nexussocial',
    `bearer.${token}`,
  ]);
}

function FormattedMessageText({ text, isMe }) {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  const firstUrlMatch = text.match(urlRegex);
  const firstUrl = firstUrlMatch ? firstUrlMatch[0] : null;

  let domain = '';
  if (firstUrl) {
    try {
      domain = new URL(firstUrl).hostname;
    } catch {
      domain = firstUrl;
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="break-words leading-relaxed">
        {parts.map((part, i) => {
          if (part.match(urlRegex)) {
            return (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`underline underline-offset-2 font-medium hover:opacity-80 transition cursor-pointer break-all ${
                  isMe ? 'text-blue-100 hover:text-white' : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
                }`}
              >
                {part}
              </a>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>

      {firstUrl && (
        <a
          href={firstUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`block p-2 rounded-xl text-xs transition border cursor-pointer ${
            isMe 
              ? 'bg-blue-700/40 hover:bg-blue-700/60 border-blue-400/40 text-blue-50' 
              : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold truncate">
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{domain}</span>
          </div>
          <span className="text-[11px] opacity-75 truncate block mt-0.5">{firstUrl}</span>
        </a>
      )}
    </div>
  );
}

function formatOnlineStatusText(user, isEn = false) {
  if (!user) return '';
  if (user.isOnline) {
    return isEn ? 'Active now' : 'Đang trực tuyến';
  }

  const dateInput = user.rawLastSeen || user.lastSeen;
  if (!dateInput || dateInput === 'Gần đây' || dateInput === 'Recently') {
    return isEn ? 'Active recently' : 'Hoạt động gần đây';
  }

  // Nếu dateInput là ISO string hoặc hợp lệ với new Date()
  const parsedDate = new Date(dateInput);
  if (!isNaN(parsedDate.getTime()) && (typeof dateInput !== 'string' || dateInput.includes('T') || dateInput.includes('-') || dateInput.includes(':'))) {
    const diffMs = Math.max(0, Date.now() - parsedDate.getTime());
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60 || diffMin <= 0) {
      return isEn ? 'Online just now' : 'Online cách đây vài giây';
    }
    if (diffMin < 60) {
      return isEn ? `Online ${diffMin} minute${diffMin > 1 ? 's' : ''} ago` : `Online cách đây ${diffMin} phút`;
    }
    if (diffHours < 24) {
      return isEn ? `Online ${diffHours} hour${diffHours > 1 ? 's' : ''} ago` : `Online cách đây ${diffHours} giờ`;
    }
    if (diffDays < 7) {
      return isEn ? `Online ${diffDays} day${diffDays > 1 ? 's' : ''} ago` : `Online cách đây ${diffDays} ngày`;
    }
    const d = parsedDate.getDate().toString().padStart(2, '0');
    const m = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
    const y = parsedDate.getFullYear();
    return isEn ? `Online on ${d}/${m}/${y}` : `Online ngày ${d}/${m}/${y}`;
  }

  // Nếu dateInput là chuỗi tương đối
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (trimmed === 'Vừa xong' || trimmed === 'Just now') {
      return isEn ? 'Online just now' : 'Online cách đây vài giây';
    }
    if (trimmed === 'Gần đây' || trimmed === 'Recently') {
      return isEn ? 'Active recently' : 'Hoạt động gần đây';
    }
    const minMatch = trimmed.match(/^(\d+)\s*phút(?:\s*trước)?$/i);
    if (minMatch) {
      return isEn ? `Online ${minMatch[1]}m ago` : `Online cách đây ${minMatch[1]} phút`;
    }
    const hourMatch = trimmed.match(/^(\d+)\s*giờ(?:\s*trước)?$/i);
    if (hourMatch) {
      return isEn ? `Online ${hourMatch[1]}h ago` : `Online cách đây ${hourMatch[1]} giờ`;
    }
    const dayMatch = trimmed.match(/^(\d+)\s*ngày(?:\s*trước)?$/i);
    if (dayMatch) {
      return isEn ? `Online ${dayMatch[1]}d ago` : `Online cách đây ${dayMatch[1]} ngày`;
    }
    if (trimmed.startsWith('Online')) {
      return trimmed;
    }
    return isEn ? `Online: ${trimmed}` : `Hoạt động: ${trimmed}`;
  }

  return isEn ? 'Active recently' : 'Hoạt động gần đây';
}

export default function MessagesView({ 
  currentUser, 
  initialChatUser, 
  initialChatUserId, 
  onOpenReportModal, 
  onRequireAuth,
  onOpenProfile,
  onOpenStoryViewer,
  onUnreadCountChange
}) {
  const { t, isEn } = useTranslation();
  if (!currentUser) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900 rounded-2xl m-4 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Yêu cầu đăng nhập</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          Người dùng chưa đăng nhập sẽ không sử dụng được chức năng nhắn tin. Vui lòng đăng nhập để tiếp tục.
        </p>
        <button
          onClick={() => onRequireAuth && onRequireAuth("Vui lòng đăng nhập để sử dụng tính năng nhắn tin")}
          className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  // Tab danh sách bên trái: 'main' (Hộp thư chính) | 'requests' (Tin nhắn chờ từ người lạ)
  const [inboxTab, setInboxTab] = useState('main');

  // Dữ liệu Story trays để hiển thị viền xanh & icon đám mây
  const [storyTrays, setStoryTrays] = useState([]);
  useEffect(() => {
    fetchStories()
      .then(res => setStoryTrays(res?.data || []))
      .catch(() => {});
  }, []);

  // Tạo Map: userId → { hasUnviewed, hasTextStory, tray } để tra cứu nhanh
  const userStoryMap = useMemo(() => {
    const map = new Map();
    for (const tray of storyTrays) {
      const uid = String(tray.author?.id);
      map.set(uid, {
        hasUnviewed: Boolean(tray.hasUnviewedStories),
        hasTextStory: Array.isArray(tray.stories) && tray.stories.some(s => s.storyType === 'text'),
        hasStory: true,
        tray,
      });
    }
    return map;
  }, [storyTrays]);

  // Danh sách các cuộc trò chuyện thực tế từ CSDL
  const [conversations, setConversations] = useState([]);

  // Cuộc trò chuyện đang chọn
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  
  // Modal tạo nhóm chat mới
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Trạng thái cập nhật thông tin nhóm (Tên nhóm, Ảnh nhóm)
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [editedGroupName, setEditedGroupName] = useState('');
  const [isUpdatingGroupName, setIsUpdatingGroupName] = useState(false);
  const [isUpdatingGroupAvatar, setIsUpdatingGroupAvatar] = useState(false);
  const groupAvatarInputRef = useRef(null);

  // Trạng thái mở rộng toàn màn hình & Panel chi tiết
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [isEdgeToEdge, setIsEdgeToEdge] = useState(false);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const prevMessagesLengthRef = useRef(activeMessages.length);
  const selectedConversationIdRef = useRef(selectedConversationId);
  selectedConversationIdRef.current = selectedConversationId;

  // Cuộc trò chuyện nháp khi bấm 'Nhắn tin' từ profile mà chưa gửi gì (không kẹt trong list chat)
  const [draftConversation, setDraftConversation] = useState(null);

  // Trạng thái Biểu tượng cảm xúc & Đính kèm đa phương tiện
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const [selectedFileAttachment, setSelectedFileAttachment] = useState(null); // { name, size, dataUrl }
  const [selectedImageModal, setSelectedImageModal] = useState(null);
  const [showAllMediaModal, setShowAllMediaModal] = useState(false);
  const [recallingMessage, setRecallingMessage] = useState(null);
  const [isRecalling, setIsRecalling] = useState(false);
  const [sidebarActiveTab, setSidebarActiveTab] = useState('media'); // 'media' | 'links'
  const [allMediaTab, setAllMediaTab] = useState('media');
  const fileInputRef = useRef(null);
  const docFileInputRef = useRef(null);
  const inputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Trạng thái Cuộc gọi thoại & Video Call WebRTC
  const [callStatus, setCallStatus] = useState(CALL_STATUS.IDLE);
  const [callType, setCallType] = useState('video');
  const [callPartnerUser, setCallPartnerUser] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [activeCallFilterId, setActiveCallFilterId] = useState('none');

  // Trạng thái Cuộc gọi nhóm WebRTC (Group Video Call)
  const [groupCallModalOpen, setGroupCallModalOpen] = useState(false);
  const [groupCallConversationId, setGroupCallConversationId] = useState(null);
  const [groupCallGroupName, setGroupCallGroupName] = useState('');
  const [groupCallGroupAvatar, setGroupCallGroupAvatar] = useState(null);
  const [groupCallParticipants, setGroupCallParticipants] = useState([]);
  const [groupCallRemoteStreams, setGroupCallRemoteStreams] = useState({});
  const [groupLocalStream, setGroupLocalStream] = useState(null);
  const [groupCallDuration, setGroupCallDuration] = useState(0);
  const [isGroupMuted, setIsGroupMuted] = useState(false);
  const [isGroupVideoOff, setIsGroupVideoOff] = useState(false);
  const [isGroupScreenSharing, setIsGroupScreenSharing] = useState(false);
  const [groupScreenSharingUsers, setGroupScreenSharingUsers] = useState({});
  const [groupActiveFilterId, setGroupActiveFilterId] = useState('none');
  const [activeGroupCallsStatus, setActiveGroupCallsStatus] = useState({});
  const [incomingGroupCall, setIncomingGroupCall] = useState(null);

  const isGroupScreenSharingRef = useRef(false);
  const wsRef = useRef(null);
  const wsMessageDispatcherRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const rawCameraStreamRef = useRef(null);
  const filterManagerRef = useRef(null);
  const callTimerRef = useRef(null);
  // Ref đếm timeout khi người được gọi không trả lời
  const callTimeoutRef = useRef(null);
  const activeCallPartnerIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const meshCallManagerRef = useRef(null);
  const groupCallTimerRef = useRef(null);
  const groupRawCameraStreamRef = useRef(null);
  const groupFilterManagerRef = useRef(null);
  const groupScreenStreamRef = useRef(null);

  // Đóng emoji picker khi click ra ngoài
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showEmojiPicker]);

  // Đếm số lượng tin nhắn chờ từ người lạ (chỉ tính nếu mình là người nhận)
  const pendingRequestsCount = conversations.filter(c => c.status === 'pending' && c.initiatedBy !== currentUser?.id).length;

  // Lấy hội thoại hiện tại (ưu tiên tìm trong danh sách chính thức, nếu không có lấy draftConversation)
  const currentConversation = conversations.find(c => String(c.id) === String(selectedConversationId)) ||
    (draftConversation && String(draftConversation.id) === String(selectedConversationId) ? draftConversation : null);

  const isBlocked = currentConversation?.status === 'blocked';
  const isBlockedByMe = isBlocked && String(currentConversation?.blockedBy) === String(currentUser?.id);

  // File, Ảnh & Liên kết đã gửi trong cuộc trò chuyện hiện tại
  const { media: sharedMedia, links: sharedLinks } = extractSharedMediaAndLinks(activeMessages);

  // Tự động nạp story của đối tác trò chuyện nếu họ là người lạ (chưa có trong storyTrays bạn bè)
  useEffect(() => {
    const partnerId = currentConversation?.user?.id;
    if (!partnerId || currentConversation?.is_group) return;
    if (storyTrays.some(t => String(t.author?.id) === String(partnerId))) return;

    fetchUserStoriesApi(partnerId)
      .then(res => {
        const tray = res?.data;
        if (tray && tray.stories?.length > 0) {
          setStoryTrays(prev => [...prev.filter(t => String(t.author?.id) !== String(partnerId)), tray]);
        }
      })
      .catch(() => {});
  }, [currentConversation?.user?.id, currentConversation?.is_group, storyTrays]);

  const targetInitialUserId = initialChatUser?.id || initialChatUserId;
  const targetInitialUserTs = initialChatUser?._ts || 0;

  // Tải danh sách cuộc trò chuyện từ Backend FastAPI (giữ nguyên messages của conversation đã nạp)
  const loadServerConversations = async (autoSelect = false) => {
    if (!currentUser) return;
    try {
      const data = await messageService.getConversations();
      if (data && Array.isArray(data)) {
        setConversations(prev => {
          return data.map(c => {
            const existing = prev.find(p => String(p.id) === String(c.id));
            const isGroup = c.type === 'group';
            return {
              id: String(c.id),
              status: c.status,
              type: c.type || 'direct',
              name: c.name || null,
              avatar: c.avatar || null,
              memberCount: c.member_count || (c.members?.length || 2),
              members: c.members || [],
              initiatedBy: c.initiated_by || '',
              blockedBy: c.blocked_by || null,
              isRequester: Boolean(c.is_requester ?? (c.initiated_by === currentUser?.id)),
              user: c.user ? {
                id: c.user?.id || '',
                name: c.user?.name || 'Người dùng',
                username: c.user?.username || '',
                avatar: c.user?.avatar || DEFAULT_AVATAR,
                isOnline: Boolean(c.user?.is_online),
                isFriend: c.user?.is_friend ?? false,
                bio: c.user?.bio || '',
                rawLastSeen: c.user?.last_seen || null,
                lastSeen: c.user?.is_online ? 'Vừa xong' : (c.user?.last_seen ? formatRelativeTime(c.user.last_seen) : null)
              } : {
                id: 'group_' + c.id,
                name: c.name || 'Nhóm trò chuyện',
                username: 'group',
                avatar: c.avatar || DEFAULT_AVATAR,
                isOnline: true,
                isFriend: true,
                bio: `${c.member_count || (c.members?.length || 0)} thành viên`,
                lastSeen: 'Vừa xong'
              },
              lastMessage: c.last_message || (isGroup ? 'Bắt đầu cuộc trò chuyện nhóm' : (c.user?.is_friend ? 'Bắt đầu cuộc trò chuyện' : '')),
              lastTime: c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong',
              unreadCount: c.unread_count || 0,
              messages: existing ? (existing.messages || []) : []
            };
          });
        });

        if (targetInitialUserId) {
          const targetIdStr = String(targetInitialUserId);
          const found = data.find(c => String(c.user?.id) === targetIdStr);
          if (found) {
            setSelectedConversationId(String(found.id));
            setDraftConversation(null);
          }
        } else if (autoSelect && data.length > 0 && !selectedConversationIdRef.current) {
          const firstId = String(data[0].id);
          setSelectedConversationId(firstId);
        }
        return data;
      } else {
        setConversations([]);
        return [];
      }
    } catch (err) {
      console.warn("Lỗi nạp danh sách cuộc trò chuyện:", err);
      return [];
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadServerConversations(true);
    }
  }, [currentUser]);

  // Thông báo số lượng tin nhắn chưa đọc lên component cha (Navbar)
  useEffect(() => {
    if (onUnreadCountChange) {
      const total = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      onUnreadCountChange(total);
    }
  }, [conversations, onUnreadCountChange]);

  // Tải tin nhắn của cuộc trò chuyện đang chọn từ CSDL
  const loadMessages = async (convId) => {
    if (!convId || !currentUser) return;
    if (String(convId).startsWith('draft_')) {
      setActiveMessages([]);
      return;
    }
    try {
      const msgs = await messageService.getMessages(convId);
      if (msgs && Array.isArray(msgs)) {
        const formattedMsgs = msgs.map(m => ({
          id: m.id,
          senderId: m.sender_id === currentUser.id ? 'current' : m.sender_id,
          senderName: m.sender_name || null,
          senderAvatar: m.sender_avatar || null,
          text: m.content,
          mediaUrl: m.media_url || null,
          mediaType: m.media_type || 'text',
          isRecalled: Boolean(m.is_recalled),
          createdAt: m.created_at || new Date().toISOString(),
          time: new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          status: m.status || 'sent'
        }));

        if (String(convId) === String(selectedConversationIdRef.current)) {
          setActiveMessages(prev => {
            // Giữ lại các tin nhắn đang gửi hoặc gửi thất bại chưa đồng bộ lên server
            const pending = prev.filter(m => (m.status === 'sending' || m.status === 'failed') && !formattedMsgs.some(f => f.text === m.text));
            return [...formattedMsgs, ...pending];
          });
        }

        setConversations(prev => prev.map(c => {
          if (String(c.id) === String(convId)) {
            return {
              ...c,
              messages: formattedMsgs,
              unreadCount: 0
            };
          }
          return c;
        }));
      }
    } catch (err) {
      console.warn("Lỗi tải tin nhắn:", err);
    }
  };

  useEffect(() => {
    setIsEditingGroupName(false);
    setEditedGroupName('');
    if (selectedConversationId) {
      loadMessages(selectedConversationId);
    } else {
      setActiveMessages([]);
    }
  }, [selectedConversationId]);

  // Đồng bộ trạng thái cuộc gọi nhóm khi mở hội thoại nhóm hoặc định kỳ
  useEffect(() => {
    if (!selectedConversationId) return;
    const conv = conversations.find(c => String(c.id) === String(selectedConversationId));
    if (conv?.type !== 'group') return;

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const st = await messageService.getGroupCallStatus(selectedConversationId);
        if (st && isMounted) {
          setActiveGroupCallsStatus(prev => ({
            ...prev,
            [selectedConversationId]: st,
            [String(selectedConversationId)]: st
          }));
        }
      } catch (err) {
        // silent
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedConversationId, conversations]);

  // Quét trạng thái cuộc gọi của các nhóm song song không gây nghẽn luồng
  useEffect(() => {
    const groupConvs = conversations.filter(c => c.type === 'group');
    if (!groupConvs.length) return;

    Promise.allSettled(groupConvs.map(g => messageService.getGroupCallStatus(g.id)))
      .then(results => {
        const updates = {};
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled' && r.value) {
            const gid = groupConvs[idx].id;
            updates[gid] = r.value;
            updates[String(gid)] = r.value;
          }
        });
        if (Object.keys(updates).length > 0) {
          setActiveGroupCallsStatus(prev => ({ ...prev, ...updates }));
        }
      })
      .catch(() => {});
  }, [conversations.length]);

  // 1. Kết nối Realtime WebSocket tới Backend FastAPI (Port 8000)
  useEffect(() => {
    if (!currentUser?.id) return;

    let ws = null;
    let pingInterval = null;
    let isMounted = true;

    const connectWs = () => {
      try {
        const wsUrl = getWsBaseUrl();
        ws = createAuthenticatedRealtimeSocket(wsUrl, currentUser.id);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsWsConnected(true);
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send('ping');
            }
          }, 20000);
        };

        const handleWsMessage = async (event) => {
          if (event.data === 'pong') return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'NEW_MESSAGE') {
              const msg = data.message;
              const convIdStr = String(data.conversation_id);

              // Cập nhật tin nhắn trong khung chat đang mở ngay lập tức
              if (String(selectedConversationIdRef.current) === convIdStr) {
                setActiveMessages((prev) => {
                  const exists = prev.some((m) => String(m.id) === String(msg.id));
                  if (exists) return prev;
                  // Thay thế tin nhắn optimistic sending (nếu có)
                  const hasSending = prev.some((m) => m.status === 'sending' && (m.text === msg.content || (m.mediaUrl && m.mediaUrl === msg.media_url)));
                  if (hasSending) {
                    return prev.map((m) =>
                      m.status === 'sending' && (m.text === msg.content || (m.mediaUrl && m.mediaUrl === msg.media_url))
                        ? {
                            id: msg.id,
                            senderId: msg.sender_id === currentUser.id ? 'current' : msg.sender_id,
                            senderName: msg.sender_name || null,
                            senderAvatar: msg.sender_avatar || null,
                            text: msg.content,
                            mediaUrl: msg.media_url || null,
                            mediaType: msg.media_type || 'text',
                            isRecalled: Boolean(msg.is_recalled),
                            createdAt: msg.created_at || m.createdAt || new Date().toISOString(),
                            time: new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                            status: msg.status || 'sent',
                          }
                        : m
                    );
                  }
                  return [
                    ...prev,
                    {
                      id: msg.id,
                      senderId: msg.sender_id === currentUser.id ? 'current' : msg.sender_id,
                      senderName: msg.sender_name || null,
                      senderAvatar: msg.sender_avatar || null,
                      text: msg.content,
                      mediaUrl: msg.media_url || null,
                      mediaType: msg.media_type || 'text',
                      isRecalled: Boolean(msg.is_recalled),
                      createdAt: msg.created_at || new Date().toISOString(),
                      time: new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                      status: msg.status || 'sent',
                    },
                  ];
                });

                if (msg.receiver_id === currentUser.id || msg.sender_id !== currentUser.id) {
                  messageService.markRead(convIdStr);
                }
              }

              // Cập nhật danh sách conversations tức thì
              setConversations((prev) => {
                const found = prev.some((c) => String(c.id) === convIdStr);
                if (!found) {
                  loadServerConversations(false);
                  return prev;
                }
                const displayMsg = msg.is_recalled 
                  ? 'Tin nhắn đã được thu hồi' 
                  : (msg.media_type === 'system'
                      ? msg.content
                      : (msg.media_url && msg.media_type === 'image' 
                          ? ('[Hình ảnh] ' + (msg.content || '')) 
                          : (msg.media_url && msg.media_type === 'file' 
                              ? ('[Tệp tin] ' + (msg.content || '')) 
                              : (msg.media_type === 'call_log'
                                  ? ('[Cuộc gọi] ' + (msg.content || ''))
                                  : msg.content))));
                return prev.map((c) => {
                  if (String(c.id) === convIdStr) {
                    const isCurrentChat = String(selectedConversationIdRef.current) === convIdStr;
                    return {
                      ...c,
                      lastMessage: displayMsg,
                      lastTime: new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                      unreadCount: isCurrentChat ? 0 : (c.unreadCount || 0) + 1,
                    };
                  }
                  return c;
                });
              });
            } else if (data.type === 'GROUP_CREATED') {
              loadServerConversations(false);
            } else if (data.type === 'GROUP_UPDATED') {
              const updatedGroup = data.conversation;
              const convIdStr = String(data.conversation_id || (updatedGroup && updatedGroup.id));
              setConversations((prev) => prev.map((c) => {
                if (String(c.id) === convIdStr) {
                  const newName = updatedGroup.name || c.name;
                  const newAvatar = updatedGroup.avatar !== undefined ? updatedGroup.avatar : c.avatar;
                  return {
                    ...c,
                    name: newName,
                    avatar: newAvatar,
                    memberCount: updatedGroup.member_count !== undefined ? updatedGroup.member_count : c.memberCount,
                    members: updatedGroup.members !== undefined ? updatedGroup.members : c.members,
                    user: {
                      ...c.user,
                      name: newName || c.user?.name,
                      avatar: newAvatar || c.user?.avatar || DEFAULT_AVATAR
                    }
                  };
                }
                return c;
              }));
            } else if (data.type === 'MESSAGE_RECALLED') {
              const msgId = data.message_id;
              const convIdStr = String(data.conversation_id);
              if (String(selectedConversationIdRef.current) === convIdStr) {
                setActiveMessages((prev) => prev.map((m) =>
                  String(m.id) === String(msgId)
                    ? { ...m, text: 'Tin nhắn đã được thu hồi', isRecalled: true, mediaUrl: null, status: 'recalled' }
                    : m
                ));
              }
              setConversations((prev) => prev.map((c) => {
                if (String(c.id) === convIdStr) {
                  return {
                    ...c,
                    lastMessage: 'Tin nhắn đã được thu hồi'
                  };
                }
                return c;
              }));
            } else if (data.type === 'CONVERSATION_BLOCKED') {
              const convIdStr = String(data.conversation_id);
              setConversations((prev) => prev.map((c) =>
                String(c.id) === convIdStr
                  ? { ...c, status: 'blocked', blockedBy: data.blocked_by }
                  : c
              ));
            } else if (data.type === 'CONVERSATION_UNBLOCKED') {
              const convIdStr = String(data.conversation_id);
              setConversations((prev) => prev.map((c) =>
                String(c.id) === convIdStr
                  ? { ...c, status: 'accepted', blockedBy: null }
                  : c
              ));
            } else if (data.type === 'CONVERSATION_ACCEPTED') {
              setConversations((prev) =>
                prev.map((c) =>
                  String(c.id) === String(data.conversation_id)
                    ? { ...c, status: 'accepted' }
                    : c
                )
              );
            } else if (data.type === 'CALL_REQUEST') {
              // Nhận lời mời gọi từ người dùng khác
              if (callStatus !== CALL_STATUS.IDLE) {
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'CALL_RESPONSE',
                    receiver_id: data.caller_id,
                    accepted: false,
                    reason: 'busy'
                  }));
                }
              } else {
                setCallPartnerUser({
                  id: data.caller_id,
                  name: data.caller_name || 'Người dùng',
                  avatar: data.caller_avatar || DEFAULT_AVATAR
                });
                setCallType(data.call_type || 'video');
                setCallStatus(CALL_STATUS.INCOMING);
                activeCallPartnerIdRef.current = String(data.caller_id);
              }
            } else if (data.type === 'CALL_RESPONSE') {
              // Phản hồi từ phía người nhận cuộc gọi
              if (data.accepted) {
                setCallStatus(CALL_STATUS.CONNECTED);
                setCallDuration(0);
                // Người nhận bắt máy → hủy timeout chờ
                if (callTimeoutRef.current) {
                  clearTimeout(callTimeoutRef.current);
                  callTimeoutRef.current = null;
                }
                if (callTimerRef.current) clearInterval(callTimerRef.current);
                callTimerRef.current = setInterval(() => {
                  setCallDuration(prev => prev + 1);
                }, 1000);

                // Bên gọi (caller) tạo WebRTC Offer
                const partnerId = activeCallPartnerIdRef.current || data.from_user_id;
                const pc = createPeerConn(partnerId);
                peerConnectionRef.current = pc;
                if (pc) {
                  try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    if (ws && ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'WEBRTC_SIGNAL',
                        receiver_id: partnerId,
                        caller_id: currentUser.id,
                        from_user_id: currentUser.id,
                        signal_type: 'offer',
                        sdp: offer
                      }));
                    }
                  } catch (offerErr) {
                    console.warn('Lỗi tạo WebRTC offer:', offerErr);
                  }
                }
              } else {
                // Người nhận từ chối cuộc gọi hoặc đang bận / offline
                if (callTimeoutRef.current) {
                  clearTimeout(callTimeoutRef.current);
                  callTimeoutRef.current = null;
                }
                const partnerId = activeCallPartnerIdRef.current || data.from_user_id;
                cleanupCall();
                recordCallLog(data.reason || 'declined', 0, partnerId, callType);
              }
            } else if (data.type === 'WEBRTC_SIGNAL') {
              const partnerId = activeCallPartnerIdRef.current || data.from_user_id || data.caller_id;
              if (data.signal_type === 'offer') {
                let pc = peerConnectionRef.current;
                if (!pc) {
                  pc = createPeerConn(partnerId);
                  peerConnectionRef.current = pc;
                }
                if (pc && typeof RTCSessionDescription !== 'undefined') {
                  try {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    // Xử lý các ICE candidate đến sớm trước remoteDescription
                    if (pendingCandidatesRef.current?.length) {
                      for (const cand of pendingCandidatesRef.current) {
                        try {
                          await pc.addIceCandidate(new RTCIceCandidate(cand));
                        } catch (ce) {
                          console.warn('Lỗi add pending candidate:', ce);
                        }
                      }
                      pendingCandidatesRef.current = [];
                    }

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    if (ws && ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'WEBRTC_SIGNAL',
                        receiver_id: partnerId,
                        caller_id: currentUser.id,
                        from_user_id: currentUser.id,
                        signal_type: 'answer',
                        sdp: answer
                      }));
                    }
                  } catch (err) {
                    console.warn('Lỗi xử lý WebRTC offer:', err);
                  }
                }
              } else if (data.signal_type === 'answer') {
                const pc = peerConnectionRef.current;
                if (pc && typeof RTCSessionDescription !== 'undefined') {
                  try {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    if (pendingCandidatesRef.current?.length) {
                      for (const cand of pendingCandidatesRef.current) {
                        try {
                          await pc.addIceCandidate(new RTCIceCandidate(cand));
                        } catch (ce) {
                          console.warn('Lỗi add pending candidate:', ce);
                        }
                      }
                      pendingCandidatesRef.current = [];
                    }
                  } catch (err) {
                    console.warn('Lỗi xử lý WebRTC answer:', err);
                  }
                }
              }
            } else if (data.type === 'CALL_CANDIDATE') {
              const pc = peerConnectionRef.current;
              if (pc && data.candidate && typeof RTCIceCandidate !== 'undefined') {
                if (!pc.remoteDescription) {
                  pendingCandidatesRef.current.push(data.candidate);
                } else {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                  } catch (candErr) {
                    console.warn('Lỗi thêm ICE candidate:', candErr);
                  }
                }
              }
            } else if (data.type === 'CALL_ENDED') {
              if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current);
                callTimeoutRef.current = null;
              }
              cleanupCall();
            } else if (data.type === 'GROUP_CALL_STATUS') {
              const cId = data.conversation_id;
              if (cId) {
                const statusObj = {
                  is_active: Boolean(data.is_active),
                  participants_count: data.participants_count || 0,
                  initiator_id: data.initiator_id,
                  call_type: data.call_type || 'video'
                };
                setActiveGroupCallsStatus(prev => ({
                  ...prev,
                  [cId]: statusObj,
                  [String(cId)]: statusObj
                }));
              }
            } else if (data.type === 'GROUP_CALL_INVITE') {
              if (!groupCallModalOpen && String(data.initiator_id) !== String(currentUser?.id)) {
                setIncomingGroupCall({
                  conversation_id: data.conversation_id,
                  caller_name: data.caller_name || 'Thành viên',
                  caller_avatar: data.caller_avatar,
                  call_type: data.call_type || 'video',
                  participants_count: data.participants_count || 1
                });
              }
            } else if (data.type === 'GROUP_CALL_STARTED') {
              if (data.room) {
                setGroupCallParticipants(data.room.participants || []);
              }
            } else if (data.type === 'GROUP_CALL_ROOM_STATE') {
              const existingParticipants = data.participants || [];
              setGroupCallParticipants(existingParticipants);
              if (meshCallManagerRef.current) {
                for (const p of existingParticipants) {
                  if (String(p.user_id) !== String(currentUser?.id)) {
                    meshCallManagerRef.current.createPeer(p.user_id, true);
                  }
                }
              }
            } else if (data.type === 'GROUP_CALL_USER_JOINED') {
              const newUser = data.user;
              if (newUser && String(newUser.user_id) !== String(currentUser?.id)) {
                setGroupCallParticipants(prev => {
                  if (prev.some(p => String(p.user_id) === String(newUser.user_id))) return prev;
                  return [...prev, newUser];
                });
                if (meshCallManagerRef.current) {
                  meshCallManagerRef.current.createPeer(newUser.user_id, false);
                  // Nếu bản thân đang chia sẻ màn hình, báo ngay cho thành viên mới gia nhập
                  if (isGroupScreenSharingRef.current) {
                    meshCallManagerRef.current.sendSignal(newUser.user_id, {
                      type: 'SCREEN_SHARE_CHANGE',
                      is_sharing: true
                    });
                  }
                }
              }
            } else if (data.type === 'GROUP_CALL_USER_LEFT') {
              const leftUserId = String(data.user_id);
              setGroupCallParticipants(prev => prev.filter(p => String(p.user_id) !== leftUserId));
              setGroupCallRemoteStreams(prev => {
                const next = { ...prev };
                delete next[leftUserId];
                return next;
              });
              if (meshCallManagerRef.current) {
                meshCallManagerRef.current.removePeer(leftUserId);
              }
            } else if (data.type === 'GROUP_CALL_SIGNAL') {
              const fromUserId = data.from_user_id;
              if (fromUserId && meshCallManagerRef.current) {
                meshCallManagerRef.current.handleSignal(fromUserId, data.signal || data);
              }
            } else if (data.type === 'USER_STATUS') {
              const targetUid = String(data.user_id);
              const isOnline = Boolean(data.is_online);
              const rawLastSeen = data.last_seen || (isOnline ? null : new Date().toISOString());
              const lastSeenText = isOnline ? 'Vừa xong' : (rawLastSeen ? formatRelativeTime(rawLastSeen) : 'Vừa xong');

              setConversations(prev => prev.map(conv => {
                if (conv.user && String(conv.user.id) === targetUid) {
                  return {
                    ...conv,
                    user: {
                      ...conv.user,
                      isOnline,
                      rawLastSeen,
                      lastSeen: lastSeenText
                    }
                  };
                }
                if (conv.type === 'group' && Array.isArray(conv.members)) {
                  return {
                    ...conv,
                    members: conv.members.map(m => String(m.id) === targetUid ? { ...m, isOnline, rawLastSeen, lastSeen: lastSeenText } : m)
                  };
                }
                return conv;
              }));

              setDraftConversation(prev => {
                if (prev && prev.user && String(prev.user.id) === targetUid) {
                  return {
                    ...prev,
                    user: {
                      ...prev.user,
                      isOnline,
                      rawLastSeen,
                      lastSeen: lastSeenText
                    }
                  };
                }
                return prev;
              });
            }
          } catch (e) {
            console.warn('Lỗi xử lý WebSocket message:', e);
          }
        };

        wsMessageDispatcherRef.current = handleWsMessage;
        ws.onmessage = handleWsMessage;

        ws.onclose = () => {
          setIsWsConnected(false);
          clearInterval(pingInterval);
          wsRef.current = null;
          if (isMounted) {
            setTimeout(connectWs, 3000);
          }
        };

        ws.onerror = () => {
          setIsWsConnected(false);
          ws?.close();
        };
      } catch (err) {
        console.warn('Lỗi khởi tạo WebSocket tin nhắn:', err);
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      if (ws) {
        ws.close();
      }
    };
  }, [currentUser?.id]);

  // Đồng bộ trạng thái hoạt động thực tế định kỳ (mỗi 30s)
  useEffect(() => {
    if (!currentUser?.id) return;
    let isMounted = true;

    const syncOnlineStatuses = async () => {
      const partnerIds = conversations
        .filter(c => c.user?.id)
        .map(c => String(c.user.id));
      if (partnerIds.length === 0) return;

      try {
        const statuses = await messageService.getUsersOnlineStatus(partnerIds);
        if (!isMounted || !statuses || typeof statuses !== 'object') return;

        setConversations(prev => prev.map(conv => {
          if (conv.user?.id && statuses[conv.user.id]) {
            const st = statuses[conv.user.id];
            const isOnline = Boolean(st.is_online);
            const rawLastSeen = st.last_seen || (isOnline ? null : conv.user.rawLastSeen);
            const lastSeen = isOnline ? 'Vừa xong' : (rawLastSeen ? formatRelativeTime(rawLastSeen) : conv.user.lastSeen);
            return {
              ...conv,
              user: {
                ...conv.user,
                isOnline,
                rawLastSeen,
                lastSeen
              }
            };
          }
          return conv;
        }));
      } catch (err) {
        console.warn('Lỗi đồng bộ online status:', err);
      }
    };

    // Chạy đồng bộ ngay lập tức và định kỳ mỗi 30s
    syncOnlineStatuses();
    const interval = setInterval(syncOnlineStatuses, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser?.id, conversations.length]);

  // Ghi nhận nhật ký cuộc gọi vào khung chat và đồng bộ cơ sở dữ liệu
  const recordCallLog = async (reason, duration = 0, targetPartnerId = null, cType = null) => {
    const partnerId = targetPartnerId || activeCallPartnerIdRef.current || callPartnerUser?.id;
    if (!partnerId || !currentUser?.id) return;

    const usedCallType = cType || callType || 'video';
    const logText = formatCallLogText({
      callType: usedCallType,
      reason,
      duration
    });

    const nowIso = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const tempId = `call_log_${Date.now()}`;
    const convIdStr = String(selectedConversationIdRef.current);

    // Cập nhật optimistic vào activeMessages nếu đang mở cuộc trò chuyện này
    setActiveMessages((prev) => [
      ...prev,
      {
        id: tempId,
        senderId: 'current',
        text: logText,
        mediaUrl: null,
        mediaType: 'call_log',
        isRecalled: false,
        createdAt: nowIso,
        time: nowTime,
        status: 'sending'
      }
    ]);

    // Cập nhật danh sách conversations
    setConversations((prev) => prev.map((c) => {
      if (String(c.id) === convIdStr || String(c.user?.id) === String(partnerId)) {
        return {
          ...c,
          lastMessage: `[Cuộc gọi] ${logText}`,
          lastTime: nowTime
        };
      }
      return c;
    }));

    try {
      await messageService.sendMessage(partnerId, logText, null, 'call_log');
    } catch (err) {
      console.warn('Lỗi ghi nhật ký cuộc gọi:', err);
    }
  };

  // Dọn dẹp tài nguyên cuộc gọi (gọi sau mọi kết thúc: timeout, từ chối, kết thúc bình thường)
  const cleanupCall = () => {
    // Hủy bộ đếm thời gian cuộc gọi đang kết nối
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    // Hủy timeout chờ người nhận bắt máy
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    rawCameraStreamRef.current = null;
    setLocalStream(null);

    if (filterManagerRef.current) {
      filterManagerRef.current.destroy();
      filterManagerRef.current = null;
    }
    setActiveCallFilterId('none');

    stopMediaStream(remoteStreamRef.current);
    remoteStreamRef.current = null;
    setRemoteStream(null);

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (err) {
        console.warn('Lỗi đóng PeerConnection:', err);
      }
      peerConnectionRef.current = null;
    }

    pendingCandidatesRef.current = [];
    setCallStatus(CALL_STATUS.IDLE);
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    activeCallPartnerIdRef.current = null;
  };

  // Khởi tạo RTCPeerConnection WebRTC
  const createPeerConn = (targetUserId) => {
    if (typeof RTCPeerConnection === 'undefined') return null;
    try {
      const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'CALL_CANDIDATE',
            receiver_id: targetUserId,
            candidate: event.candidate
          }));
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          setRemoteStream(event.streams[0]);
        } else if (event.track) {
          let stream = remoteStreamRef.current;
          if (!stream) {
            stream = new MediaStream();
            remoteStreamRef.current = stream;
            setRemoteStream(stream);
          }
          stream.addTrack(event.track);
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      return pc;
    } catch (err) {
      console.warn('Không thể khởi tạo RTCPeerConnection:', err);
      return null;
    }
  };

  // Đảm bảo WebSocket kết nối sẵn sàng trước khi gửi dữ liệu quan trọng
  const ensureWebSocketReady = async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return true;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return true;
      }
    }
    try {
      const wsUrl = getWsBaseUrl();
      const newWs = createAuthenticatedRealtimeSocket(wsUrl, currentUser.id);
      newWs.onmessage = (event) => wsMessageDispatcherRef.current?.(event);
      wsRef.current = newWs;
      return await new Promise((resolve) => {
        newWs.onopen = () => {
          setIsWsConnected(true);
          resolve(true);
        };
        newWs.onerror = () => resolve(false);
        newWs.onclose = () => resolve(false);
        setTimeout(() => resolve(false), 2500);
      });
    } catch (e) {
      console.warn('Lỗi kết nối lại WebSocket:', e);
      return false;
    }
  };

  // Bắt đầu cuộc gọi (Audio hoặc Video)
  const startCall = async (type = 'video') => {
    const targetUser = currentConversation?.user;
    if (!targetUser?.id || !currentUser?.id || isBlocked) return;

    // Tự động thử kết nối lại nếu WebSocket chưa sẵn sàng
    const isWsReady = await ensureWebSocketReady();
    if (!isWsReady || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('Không thể thực hiện cuộc gọi: Chưa kết nối máy chủ thời gian thực (FastAPI Port 8000). Vui lòng đảm bảo Backend đang chạy và thử lại.');
      return;
    }

    try {
      let stream = null;
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: type === 'video',
          audio: true
        });
        rawCameraStreamRef.current = stream;
        localStreamRef.current = stream;
        setLocalStream(stream);
      }
    } catch (err) {
      alert('Không thể truy cập Camera/Microphone. Vui lòng cấp quyền trong trình duyệt để gọi.');
      return;
    }

    setCallType(type);
    setCallPartnerUser(targetUser);
    setCallStatus(CALL_STATUS.OUTGOING);
    activeCallPartnerIdRef.current = String(targetUser.id);

    wsRef.current.send(JSON.stringify({
      type: 'CALL_REQUEST',
      caller_id: currentUser.id,
      receiver_id: targetUser.id,
      call_type: type,
      caller_name: currentUser.name || 'Người dùng',
      caller_avatar: currentUser.avatar || DEFAULT_AVATAR
    }));

    // ⏱ Tự động hủy cuộc gọi sau 30 giây nếu người nhận không bắt máy
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = setTimeout(() => {
      const partnerId = activeCallPartnerIdRef.current;
      // Chỉ xử lý nếu vẫn đang trong trạng thái chờ (OUTGOING)
      if (wsRef.current?.readyState === WebSocket.OPEN && partnerId) {
        wsRef.current.send(JSON.stringify({
          type: 'CALL_ENDED',
          receiver_id: partnerId,
          reason: 'no_answer'
        }));
      }
      cleanupCall();
      recordCallLog('missed', 0, partnerId, type);
    }, 30000);
  };

  // Trả lời cuộc gọi đến
  const handleAcceptCall = async () => {
    const partnerId = activeCallPartnerIdRef.current || callPartnerUser?.id;
    if (!partnerId) return;

    try {
      let stream = null;
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true
        });
        rawCameraStreamRef.current = stream;
        localStreamRef.current = stream;
        setLocalStream(stream);
      }
    } catch (err) {
      console.warn('Không thể truy cập camera/mic khi nhận cuộc gọi:', err);
    }

    setCallStatus(CALL_STATUS.CONNECTED);
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    const pc = createPeerConn(partnerId);
    peerConnectionRef.current = pc;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'CALL_RESPONSE',
        receiver_id: partnerId,
        from_user_id: currentUser.id,
        caller_id: partnerId,
        accepted: true
      }));
    }
  };

  // Từ chối cuộc gọi đến
  const handleDeclineCall = () => {
    const partnerId = activeCallPartnerIdRef.current || callPartnerUser?.id;
    if (partnerId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'CALL_RESPONSE',
        receiver_id: partnerId,
        accepted: false,
        reason: 'declined'
      }));
    }
    cleanupCall();
  };

  // Kết thúc cuộc gọi
  const handleEndCall = () => {
    const partnerId = activeCallPartnerIdRef.current || callPartnerUser?.id;
    const isOutgoing = callStatus === CALL_STATUS.OUTGOING;
    const isConnected = callStatus === CALL_STATUS.CONNECTED;
    const currentDuration = callDuration;
    const currentCallType = callType;

    if (partnerId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'CALL_ENDED',
        receiver_id: partnerId,
        reason: isOutgoing ? 'cancelled' : 'completed',
        duration: currentDuration
      }));
    }

    cleanupCall();

    if (isOutgoing) {
      recordCallLog('cancelled', 0, partnerId, currentCallType);
    } else if (isConnected) {
      recordCallLog('completed', currentDuration, partnerId, currentCallType);
    }
  };

  // Bật/Tắt Micro
  const handleToggleMic = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    toggleMediaTrack(localStreamRef.current, 'audio', !nextMuted);
  };

  // Bật/Tắt Camera
  const handleToggleCamera = () => {
    const nextOff = !isVideoOff;
    setIsVideoOff(nextOff);
    toggleMediaTrack(localStreamRef.current, 'video', !nextOff);
  };

  // Chọn bộ lọc AR / Hiệu ứng khuôn mặt
  const handleSelectCallFilter = async (filterId) => {
    setActiveCallFilterId(filterId);
    const rawStream = rawCameraStreamRef.current || localStreamRef.current;
    if (!rawStream) return;

    if (filterId === 'none') {
      if (filterManagerRef.current) {
        filterManagerRef.current.setFilter('none');
      }
      const rawVideoTrack = rawStream.getVideoTracks ? rawStream.getVideoTracks()[0] : null;
      if (rawVideoTrack && peerConnectionRef.current) {
        await applyVideoTrackToPeer(peerConnectionRef.current, rawVideoTrack);
      }
      localStreamRef.current = rawStream;
      setLocalStream(rawStream);
      return;
    }

    try {
      if (!filterManagerRef.current) {
        const mgr = new FaceFilterManager();
        await mgr.init(rawStream);
        filterManagerRef.current = mgr;
      }
      filterManagerRef.current.setFilter(filterId);
      const filteredStream = filterManagerRef.current.getFilteredStream();
      if (filteredStream) {
        let combinedStream = filteredStream;
        if (typeof MediaStream !== 'undefined') {
          combinedStream = new MediaStream();
          if (rawStream.getAudioTracks) {
            rawStream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
          }
          if (filteredStream.getVideoTracks) {
            filteredStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
          }
        }

        const filteredVideoTrack = filteredStream.getVideoTracks ? filteredStream.getVideoTracks()[0] : null;
        if (filteredVideoTrack && peerConnectionRef.current) {
          await applyVideoTrackToPeer(peerConnectionRef.current, filteredVideoTrack);
        }
        localStreamRef.current = combinedStream;
        setLocalStream(combinedStream);
      }
    } catch (err) {
      console.warn('Lỗi khi kích hoạt filter khuôn mặt:', err);
    }
  };

  // =================== XỬ LÝ GỌI VIDEO NHÓM (GROUP VIDEO CALL) ===================
  const handleLeaveGroupCall = () => {
    const cId = groupCallConversationId;
    if (cId) {
      messageService.leaveGroupCall(cId);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && cId) {
      wsRef.current.send(JSON.stringify({
        type: 'GROUP_CALL_LEAVE',
        conversation_id: cId
      }));
    }

    if (groupCallTimerRef.current) {
      clearInterval(groupCallTimerRef.current);
      groupCallTimerRef.current = null;
    }

    if (meshCallManagerRef.current) {
      meshCallManagerRef.current.destroy();
      meshCallManagerRef.current = null;
    }

    if (groupFilterManagerRef.current) {
      groupFilterManagerRef.current.destroy();
      groupFilterManagerRef.current = null;
    }

    if (groupScreenStreamRef.current) {
      stopMediaStream(groupScreenStreamRef.current);
      groupScreenStreamRef.current = null;
    }

    if (groupRawCameraStreamRef.current) {
      stopMediaStream(groupRawCameraStreamRef.current);
      groupRawCameraStreamRef.current = null;
    }

    if (groupLocalStream) {
      stopMediaStream(groupLocalStream);
      setGroupLocalStream(null);
    }

    setGroupCallModalOpen(false);
    setGroupCallConversationId(null);
    setGroupCallParticipants([]);
    setGroupCallRemoteStreams({});
    setGroupCallDuration(0);
    setIsGroupMuted(false);
    setIsGroupVideoOff(false);
    setIsGroupScreenSharing(false);
    isGroupScreenSharingRef.current = false;
    setGroupScreenSharingUsers({});
    setGroupActiveFilterId('none');
  };

  const startGroupCall = async (conversationId) => {
    if (!conversationId) return;

    // 1. Kiểm tra trạng thái hiện tại trên local: nếu đang có cuộc gọi thì chuyển ngay sang tham gia
    const localStatus = activeGroupCallsStatus[conversationId] || activeGroupCallsStatus[String(conversationId)];
    if (localStatus?.is_active && (localStatus.participants_count > 0 || localStatus.participants?.length > 0)) {
      return joinGroupCall(conversationId);
    }

    // 2. Kiểm tra nhanh qua REST API để phòng trường hợp WebSocket hoặc Polling có độ trễ
    try {
      const remoteStatus = await messageService.getGroupCallStatus(conversationId);
      if (remoteStatus?.is_active && remoteStatus.participants_count > 0) {
        setActiveGroupCallsStatus(prev => ({
          ...prev,
          [conversationId]: remoteStatus,
          [String(conversationId)]: remoteStatus
        }));
        return joinGroupCall(conversationId);
      }
    } catch (e) {
      // Tiếp tục quy trình tạo mới nếu kiểm tra lỗi mạng
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Trình duyệt không hỗ trợ truy cập camera/mic.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      groupRawCameraStreamRef.current = stream;
      setGroupLocalStream(stream);

      const conv = conversations.find(c => String(c.id) === String(conversationId));
      const groupName = conv?.name || conv?.user?.name || 'Nhóm chat';
      const groupAvatar = conv?.avatar || conv?.user?.avatar || null;

      setGroupCallConversationId(conversationId);
      setGroupCallGroupName(groupName);
      setGroupCallGroupAvatar(groupAvatar);
      setGroupCallModalOpen(true);
      setGroupCallDuration(0);
      setIsGroupMuted(false);
      setIsGroupVideoOff(false);
      setIsGroupScreenSharing(false);

      if (groupCallTimerRef.current) clearInterval(groupCallTimerRef.current);
      groupCallTimerRef.current = setInterval(() => {
        setGroupCallDuration(prev => prev + 1);
      }, 1000);

      // Cập nhật trạng thái ngay lập tức trên UI người khởi tạo
      const initStatus = {
        is_active: true,
        participants_count: 1,
        initiator_id: currentUser?.id,
        call_type: 'video'
      };
      setActiveGroupCallsStatus(prev => ({
        ...prev,
        [conversationId]: initStatus,
        [String(conversationId)]: initStatus
      }));

      // Khởi tạo Mesh Manager
      const mesh = new MeshCallManager();
      mesh.init({
        localStream: stream,
        onSignal: (toUserId, signal) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'GROUP_CALL_SIGNAL',
              conversation_id: conversationId,
              to_user_id: toUserId,
              signal
            }));
          }
        },
        onRemoteStream: (remoteUserId, rStream) => {
          setGroupCallRemoteStreams(prev => ({
            ...prev,
            [String(remoteUserId)]: rStream
          }));
        },
        onPeerLeft: (remoteUserId) => {
          setGroupCallRemoteStreams(prev => {
            const next = { ...prev };
            delete next[String(remoteUserId)];
            return next;
          });
        },
        onScreenShareChange: (remoteUserId, isSharing) => {
          setGroupScreenSharingUsers(prev => ({
            ...prev,
            [String(remoteUserId)]: isSharing
          }));
        }
      });
      meshCallManagerRef.current = mesh;

      // 1. Đảm bảo WebSocket sẵn sàng truyền tín hiệu
      await ensureWebSocketReady();

      // 2. Lưu trạng thái phòng qua REST API và lấy danh sách thành viên hiện có (nếu có ai vừa tạo trước)
      const startRes = await messageService.startGroupCall(conversationId, 'video');
      if (startRes && startRes.existing_participants && startRes.existing_participants.length > 0) {
        setGroupCallParticipants(startRes.participants || startRes.existing_participants);
        for (const p of startRes.existing_participants) {
          if (String(p.user_id) !== String(currentUser?.id)) {
            mesh.createPeer(p.user_id, true);
          }
        }
      }

      // 3. Gửi tín hiệu WebSocket realtime
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'GROUP_CALL_START',
          conversation_id: conversationId,
          call_type: 'video',
          caller_name: currentUser?.name || 'Thành viên',
          caller_avatar: currentUser?.avatar || null
        }));
      }
    } catch (err) {
      console.warn('Lỗi bắt đầu cuộc gọi nhóm:', err);
      alert('Không thể truy cập camera hoặc mic để gọi video nhóm.');
    }
  };

  const joinGroupCall = async (conversationId) => {
    if (!conversationId) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Trình duyệt không hỗ trợ truy cập camera/mic.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      groupRawCameraStreamRef.current = stream;
      setGroupLocalStream(stream);

      const conv = conversations.find(c => String(c.id) === String(conversationId));
      const groupName = conv?.name || conv?.user?.name || 'Nhóm chat';
      const groupAvatar = conv?.avatar || conv?.user?.avatar || null;

      setGroupCallConversationId(conversationId);
      setGroupCallGroupName(groupName);
      setGroupCallGroupAvatar(groupAvatar);
      setGroupCallModalOpen(true);
      setGroupCallDuration(0);
      setIsGroupMuted(false);
      setIsGroupVideoOff(false);
      setIsGroupScreenSharing(false);

      if (groupCallTimerRef.current) clearInterval(groupCallTimerRef.current);
      groupCallTimerRef.current = setInterval(() => {
        setGroupCallDuration(prev => prev + 1);
      }, 1000);

      // Khởi tạo Mesh Manager
      const mesh = new MeshCallManager();
      mesh.init({
        localStream: stream,
        onSignal: (toUserId, signal) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'GROUP_CALL_SIGNAL',
              conversation_id: conversationId,
              to_user_id: toUserId,
              signal
            }));
          }
        },
        onRemoteStream: (remoteUserId, rStream) => {
          setGroupCallRemoteStreams(prev => ({
            ...prev,
            [String(remoteUserId)]: rStream
          }));
        },
        onPeerLeft: (remoteUserId) => {
          setGroupCallRemoteStreams(prev => {
            const next = { ...prev };
            delete next[String(remoteUserId)];
            return next;
          });
        },
        onScreenShareChange: (remoteUserId, isSharing) => {
          setGroupScreenSharingUsers(prev => ({
            ...prev,
            [String(remoteUserId)]: isSharing
          }));
        }
      });
      meshCallManagerRef.current = mesh;

      // 1. Đảm bảo WebSocket kết nối sẵn sàng TRƯỚC KHI tạo peer và gửi Offer!
      await ensureWebSocketReady();

      // 2. Thêm thành viên vào phòng qua REST API
      const joinRes = await messageService.joinGroupCall(conversationId);
      if (joinRes && joinRes.participants) {
        setGroupCallParticipants(joinRes.participants);
        for (const p of joinRes.participants) {
          if (String(p.user_id) !== String(currentUser?.id)) {
            mesh.createPeer(p.user_id, true);
          }
        }
      }

      // 3. Gửi tín hiệu WebSocket realtime
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'GROUP_CALL_JOIN',
          conversation_id: conversationId,
          user_name: currentUser?.name || 'Thành viên',
          user_avatar: currentUser?.avatar || null
        }));
      }
    } catch (err) {
      console.warn('Lỗi tham gia cuộc gọi nhóm:', err);
      alert('Không thể truy cập camera hoặc mic để tham gia cuộc gọi nhóm.');
    }
  };

  const handleStartOrJoinGroupCall = async (conversationId) => {
    if (!conversationId) return;
    const localStatus = activeGroupCallsStatus[conversationId] || activeGroupCallsStatus[String(conversationId)];
    if (localStatus?.is_active) {
      return joinGroupCall(conversationId);
    }
    try {
      const remoteStatus = await messageService.getGroupCallStatus(conversationId);
      if (remoteStatus?.is_active && remoteStatus.participants_count > 0) {
        setActiveGroupCallsStatus(prev => ({
          ...prev,
          [conversationId]: remoteStatus,
          [String(conversationId)]: remoteStatus
        }));
        return joinGroupCall(conversationId);
      }
    } catch (e) {
      // Bỏ qua
    }
    return startGroupCall(conversationId);
  };

  const handleToggleGroupMic = () => {
    const next = !isGroupMuted;
    setIsGroupMuted(next);
    toggleMediaTrack(groupLocalStream, 'audio', !next);
    if (groupRawCameraStreamRef.current) {
      toggleMediaTrack(groupRawCameraStreamRef.current, 'audio', !next);
    }
  };

  const handleToggleGroupCamera = () => {
    const next = !isGroupVideoOff;
    setIsGroupVideoOff(next);
    toggleMediaTrack(groupLocalStream, 'video', !next);
    if (groupRawCameraStreamRef.current) {
      toggleMediaTrack(groupRawCameraStreamRef.current, 'video', !next);
    }
  };

  const handleToggleGroupScreenShare = async () => {
    if (!isGroupScreenSharing) {
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          alert('Trình duyệt của bạn không hỗ trợ chia sẻ màn hình');
          return;
        }
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        groupScreenStreamRef.current = screenStream;
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        if (screenVideoTrack) {
          screenVideoTrack.onended = () => {
            handleToggleGroupScreenShare();
          };

          let combinedStream = screenStream;
          if (groupLocalStream && typeof MediaStream !== 'undefined') {
            combinedStream = new MediaStream([
              screenVideoTrack,
              ...groupLocalStream.getAudioTracks()
            ]);
          }

          if (meshCallManagerRef.current) {
            await meshCallManagerRef.current.replaceVideoTrack(screenVideoTrack);
            meshCallManagerRef.current.setLocalStream(combinedStream);
            meshCallManagerRef.current.broadcastSignal({
              type: 'SCREEN_SHARE_CHANGE',
              is_sharing: true
            });
          }

          setGroupLocalStream(combinedStream);
          isGroupScreenSharingRef.current = true;
          setIsGroupScreenSharing(true);
          setGroupScreenSharingUsers(prev => ({
            ...prev,
            [String(currentUser?.id)]: true
          }));
        }
      } catch (err) {
        console.warn('Lỗi khi chia sẻ màn hình trong nhóm:', err);
      }
    } else {
      if (groupScreenStreamRef.current) {
        stopMediaStream(groupScreenStreamRef.current);
        groupScreenStreamRef.current = null;
      }
      isGroupScreenSharingRef.current = false;
      setIsGroupScreenSharing(false);
      setGroupScreenSharingUsers(prev => ({
        ...prev,
        [String(currentUser?.id)]: false
      }));

      const rawStream = groupRawCameraStreamRef.current;
      const cameraVideoTrack = rawStream?.getVideoTracks ? rawStream.getVideoTracks()[0] : null;

      if (cameraVideoTrack && meshCallManagerRef.current) {
        await meshCallManagerRef.current.replaceVideoTrack(cameraVideoTrack);
        if (rawStream) {
          meshCallManagerRef.current.setLocalStream(rawStream);
        }
        meshCallManagerRef.current.broadcastSignal({
          type: 'SCREEN_SHARE_CHANGE',
          is_sharing: false
        });
      }
      if (rawStream) {
        setGroupLocalStream(rawStream);
      }
    }
  };

  const handleSelectGroupFilter = async (filterId) => {
    setGroupActiveFilterId(filterId);
    const rawStream = groupRawCameraStreamRef.current;
    if (!rawStream) return;

    if (filterId === 'none') {
      if (groupFilterManagerRef.current) {
        groupFilterManagerRef.current.setFilter('none');
      }
      const rawVideoTrack = rawStream.getVideoTracks ? rawStream.getVideoTracks()[0] : null;
      if (rawVideoTrack && meshCallManagerRef.current) {
        await meshCallManagerRef.current.replaceVideoTrack(rawVideoTrack);
      }
      setGroupLocalStream(rawStream);
      return;
    }

    try {
      if (!groupFilterManagerRef.current) {
        const mgr = new FaceFilterManager();
        await mgr.init(rawStream);
        groupFilterManagerRef.current = mgr;
      }
      groupFilterManagerRef.current.setFilter(filterId);
      const filteredStream = groupFilterManagerRef.current.getFilteredStream();
      if (filteredStream) {
        let combinedStream = filteredStream;
        if (typeof MediaStream !== 'undefined') {
          combinedStream = new MediaStream();
          if (rawStream.getAudioTracks) {
            rawStream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
          }
          if (filteredStream.getVideoTracks) {
            filteredStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
          }
        }

        const filteredVideoTrack = filteredStream.getVideoTracks ? filteredStream.getVideoTracks()[0] : null;
        if (filteredVideoTrack && meshCallManagerRef.current) {
          await meshCallManagerRef.current.replaceVideoTrack(filteredVideoTrack);
        }
        setGroupLocalStream(combinedStream);
      }
    } catch (err) {
      console.warn('Lỗi áp dụng filter trong cuộc gọi nhóm:', err);
    }
  };

  // Tự động kiểm tra trạng thái cuộc gọi nhóm khi mở cuộc trò chuyện hoặc danh sách thay đổi
  useEffect(() => {
    if (!conversations?.length) return;
    conversations.forEach(c => {
      if (c.type === 'group' && c.id) {
        messageService.getGroupCallStatus(c.id).then(status => {
          if (status) {
            setActiveGroupCallsStatus(prev => ({
              ...prev,
              [c.id]: status,
              [String(c.id)]: status
            }));
          }
        });
      }
    });
  }, [conversations, selectedConversationId]);

  // 2. Polling dự phòng (fallback) để đồng bộ dữ liệu
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      loadServerConversations(false);
      if (selectedConversationIdRef.current && !String(selectedConversationIdRef.current).startsWith('draft_')) {
        loadMessages(selectedConversationIdRef.current);
      }
      // Định kỳ cập nhật trạng thái cuộc gọi của các nhóm
      if (Array.isArray(conversations)) {
        conversations.forEach(c => {
          if (c.type === 'group' && c.id) {
            messageService.getGroupCallStatus(c.id).then(status => {
              if (status) {
                setActiveGroupCallsStatus(prev => ({
                  ...prev,
                  [c.id]: status,
                  [String(c.id)]: status
                }));
              }
            });
          }
        });
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [currentUser, conversations]);

  // Tự động chọn cuộc trò chuyện khi nhận initialChatUser hoặc initialChatUserId (từ Trang cá nhân hoặc Bạn bè)
  useEffect(() => {
    if (!targetInitialUserId || !currentUser) return;
    const targetIdStr = String(targetInitialUserId);
    if (String(currentUser.id) === targetIdStr) return;

    let isSubscribed = true;

    // 1. Kiểm tra xem cuộc trò chuyện đã có sẵn trong state conversations chưa
    const existing = conversations.find(c => String(c.user?.id) === targetIdStr);
    if (existing) {
      setDraftConversation(null);
      setInboxTab(existing.status === 'pending' && existing.initiatedBy !== currentUser?.id ? 'requests' : 'main');
      setSelectedConversationId(String(existing.id));
      setMobileShowChat(true);
      return;
    }

    // 2. MỞ KHUNG CHAT + Ô NHẬP TIN NHẮN TỨC THÌ (0ms) bằng initialChatUser
    // Đảm bảo người dùng luôn thấy ngay ô nhập tin nhắn mà không bị chậm hoặc màn hình trống
    const immediateDraft = {
      id: 'draft_' + targetIdStr,
      status: 'pending',
      initiatedBy: currentUser?.id || '',
      isRequester: true,
      isDraft: true,
      user: {
        id: targetIdStr,
        name: initialChatUser?.name || 'Người dùng',
        username: initialChatUser?.username || '',
        avatar: initialChatUser?.avatar || DEFAULT_AVATAR,
        isOnline: Boolean(initialChatUser?.isOnline ?? initialChatUser?.is_online),
        isFriend: Boolean(initialChatUser?.isFriend ?? initialChatUser?.is_friend),
        bio: initialChatUser?.bio || '',
        rawLastSeen: initialChatUser?.last_seen || null,
        lastSeen: (initialChatUser?.isOnline ?? initialChatUser?.is_online) ? 'Vừa xong' : (initialChatUser?.last_seen ? formatRelativeTime(initialChatUser.last_seen) : null)
      },
      lastMessage: '',
      lastTime: 'Vừa xong',
      unreadCount: 0,
      messages: []
    };

    setDraftConversation(immediateDraft);
    setSelectedConversationId(immediateDraft.id);
    setActiveMessages([]);
    setInboxTab('main');
    setMobileShowChat(true);

    // 3. Trong nền, đồng bộ thêm chi tiết từ backend (nếu có cuộc trò chuyện cũ hoặc bạn bè)
    const syncPartnerInfo = async () => {
      try {
        const res = await messageService.getOrCreateConversation(targetIdStr);
        if (!isSubscribed) return;

        if (res) {
          if (res.conversation_id) {
            const convId = String(res.conversation_id);
            setDraftConversation(null);
            setSelectedConversationId(convId);
            loadMessages(convId);
            loadServerConversations(false);
          } else if (res.user) {
            setDraftConversation(prev => {
              if (!prev || prev.id !== immediateDraft.id) return prev;
              return {
                ...prev,
                status: res.status || prev.status,
                user: {
                  ...prev.user,
                  name: res.user.name || prev.user.name,
                  username: res.user.username || prev.user.username,
                  avatar: res.user.avatar || prev.user.avatar,
                  bio: res.user.bio || prev.user.bio,
                  isFriend: Boolean(res.user.is_friend ?? prev.user.isFriend),
                  isOnline: Boolean(res.user.is_online),
                  rawLastSeen: res.user.last_seen || prev.user.rawLastSeen || null,
                  lastSeen: res.user.is_online ? 'Vừa xong' : (res.user.last_seen ? formatRelativeTime(res.user.last_seen) : prev.user.lastSeen)
                }
              };
            });
          }
        }
      } catch (err) {
        console.warn("Lỗi đồng bộ thông tin đối tác nhắn tin:", err);
      }
    };

    syncPartnerInfo();

    return () => {
      isSubscribed = false;
    };
  }, [targetInitialUserId, targetInitialUserTs, currentUser]);

  // Khi CHUYỂN cuộc trò chuyện: Đặt vị trí cuộn xuống đáy TỨC THÌ (0ms, không trượt animation)
  useEffect(() => {
    const scrollToBottomInstant = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    };
    scrollToBottomInstant();
    const frameId = requestAnimationFrame(scrollToBottomInstant);
    prevMessagesLengthRef.current = activeMessages.length;
    return () => cancelAnimationFrame(frameId);
  }, [selectedConversationId]);

  // Khi CÓ TIN NHẮN MỚI hoặc ĐANG GÕ: Cuộn mượt mà trong nội bộ container tin nhắn
  useEffect(() => {
    const currentLen = activeMessages.length;
    if (currentLen > prevMessagesLengthRef.current || isTyping) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
    prevMessagesLengthRef.current = currentLen;
  }, [activeMessages.length, isTyping]);

  // Chọn hội thoại và đánh dấu đã xem
  const handleSelectConversation = (convId) => {
    if (String(convId) === String(selectedConversationId)) return;
    // Hủy bỏ trạng thái draft khi người dùng chuyển sang chat khác mà không gửi gì
    setDraftConversation(null);

    const strId = String(convId);
    setSelectedConversationId(strId);
    setMobileShowChat(true);

    const existing = conversations.find(c => String(c.id) === strId);
    if (existing && existing.messages && existing.messages.length > 0) {
      setActiveMessages(existing.messages);
    } else {
      setActiveMessages([]);
    }

    setConversations(prev => prev.map(c => 
      String(c.id) === strId && c.unreadCount > 0 ? { ...c, unreadCount: 0 } : c
    ));
    if (currentUser && !isNaN(convId)) {
      messageService.markRead(convId);
    }
  };

  // HÀNH ĐỘNG 1: Chấp nhận cuộc trò chuyện từ người lạ -> Chuyển sang hộp thư chính
  const handleAcceptRequest = (convId) => {
    setConversations(prev => prev.map(c => {
      if (c.id === convId) {
        return {
          ...c,
          status: 'accepted'
        };
      }
      return c;
    }));
    setInboxTab('main');
    if (currentUser && !isNaN(convId)) {
      messageService.acceptConversation(convId);
    }
  };

  // HÀNH ĐỘNG 2: Xóa / Từ chối cuộc trò chuyện từ người lạ
  const handleDeclineRequest = (convId) => {
    if (window.confirm('Bạn có muốn xóa cuộc trò chuyện này khỏi danh sách chờ không?')) {
      const remaining = conversations.filter(c => c.id !== convId);
      setConversations(remaining);
      const nextConv = remaining.find(c => c.status === inboxTab) || remaining[0];
      setSelectedConversationId(nextConv?.id || null);
      if (currentUser && !isNaN(convId)) {
        messageService.declineConversation(convId);
      }
    }
  };

  // HÀNH ĐỘNG 3: Thu hồi tin nhắn đã gửi (mở modal xác nhận chuyên nghiệp)
  const handleRecallMessage = (msgOrId) => {
    const target = typeof msgOrId === 'object' && msgOrId !== null
      ? msgOrId
      : activeMessages.find(m => String(m.id) === String(msgOrId)) || { id: msgOrId };
    setRecallingMessage(target);
  };

  const handleConfirmRecall = async () => {
    if (!recallingMessage) return;
    const msgId = recallingMessage.id;
    setIsRecalling(true);
    try {
      await messageService.recallMessage(msgId);
      setActiveMessages(prev => prev.map(m => 
        String(m.id) === String(msgId)
          ? { ...m, text: 'Tin nhắn đã được thu hồi', isRecalled: true, mediaUrl: null, status: 'recalled' }
          : m
      ));
      setConversations(prev => prev.map(c => {
        if (String(c.id) === String(selectedConversationId)) {
          return {
            ...c,
            lastMessage: 'Tin nhắn đã được thu hồi'
          };
        }
        return c;
      }));
      setRecallingMessage(null);
    } catch (err) {
      console.error("Lỗi thu hồi tin nhắn:", err);
      alert(err.message || 'Không thể thu hồi tin nhắn');
    } finally {
      setIsRecalling(false);
    }
  };

  // HÀNH ĐỘNG 4: Chặn người dùng trong cuộc trò chuyện
  const handleBlockConversation = async (convId) => {
    if (!convId) return;
    const partnerName = currentConversation?.user?.name || 'người dùng này';
    if (!window.confirm(`Bạn có chắc muốn chặn ${partnerName}? Bạn và người này sẽ không thể gửi tin nhắn cho nhau nữa.`)) return;
    try {
      const ok = await messageService.blockConversation(convId);
      if (ok) {
        setConversations(prev => prev.map(c => 
          String(c.id) === String(convId)
            ? { ...c, status: 'blocked', blockedBy: currentUser?.id }
            : c
        ));
      }
    } catch (err) {
      alert('Không thể chặn cuộc trò chuyện');
    }
  };

  // HÀNH ĐỘNG 5: Bỏ chặn người dùng
  const handleUnblockConversation = async (convId) => {
    if (!convId) return;
    try {
      const ok = await messageService.unblockConversation(convId);
      if (ok) {
        setConversations(prev => prev.map(c => 
          String(c.id) === String(convId)
            ? { ...c, status: 'accepted', blockedBy: null }
            : c
        ));
      }
    } catch (err) {
      alert('Không thể bỏ chặn cuộc trò chuyện');
    }
  };

  // HÀNH ĐỘNG 6: Chọn ảnh đính kèm
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP, GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Dung lượng ảnh tối đa là 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImagePreview(event.target.result);
      setSelectedFileAttachment(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // HÀNH ĐỘNG 7: Chọn tệp tin đính kèm
  const handleDocumentSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFileAttachment(file, 15 * 1024 * 1024);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedFileAttachment({
        name: file.name,
        size: file.size,
        dataUrl: event.target.result
      });
      setSelectedImagePreview(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // HÀNH ĐỘNG 7.1: Đổi ảnh đại diện nhóm
  const handleGroupAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentConversation || currentConversation.type !== 'group') return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP, GIF)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Dung lượng ảnh tối đa là 5MB');
      return;
    }

    setIsUpdatingGroupAvatar(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const avatarUrl = event.target.result;
        const updated = await messageService.updateGroup(currentConversation.id, { avatarUrl });
        const finalAvatar = updated.avatar || avatarUrl;
        setConversations(prev => prev.map(c => {
          if (String(c.id) === String(currentConversation.id)) {
            return {
              ...c,
              avatar: finalAvatar,
              user: { ...c.user, avatar: finalAvatar }
            };
          }
          return c;
        }));
      } catch (err) {
        alert(err.message || 'Không thể cập nhật ảnh đại diện nhóm');
      } finally {
        setIsUpdatingGroupAvatar(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // HÀNH ĐỘNG 7.2: Đổi tên nhóm
  const handleStartEditGroupName = () => {
    setEditedGroupName(currentConversation?.name || '');
    setIsEditingGroupName(true);
  };

  const handleCancelEditGroupName = () => {
    setIsEditingGroupName(false);
    setEditedGroupName('');
  };

  const handleSaveGroupName = async () => {
    const trimmed = editedGroupName.trim();
    if (!trimmed) {
      alert('Tên nhóm không được để trống');
      return;
    }
    if (trimmed === currentConversation?.name) {
      setIsEditingGroupName(false);
      return;
    }

    setIsUpdatingGroupName(true);
    try {
      const updated = await messageService.updateGroup(currentConversation.id, { name: trimmed });
      const finalName = updated.name || trimmed;
      setConversations(prev => prev.map(c => {
        if (String(c.id) === String(currentConversation.id)) {
          return {
            ...c,
            name: finalName,
            user: { ...c.user, name: finalName }
          };
        }
        return c;
      }));
      setIsEditingGroupName(false);
    } catch (err) {
      alert(err.message || 'Không thể cập nhật tên nhóm');
    } finally {
      setIsUpdatingGroupName(false);
    }
  };

  // Xử lý gửi tin nhắn (Bằng nút Gửi hoặc phím Enter, hỗ trợ ảnh, tài liệu và văn bản)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const content = inputText.trim();
    const mediaUrl = selectedImagePreview || selectedFileAttachment?.dataUrl || null;
    const mediaType = selectedFileAttachment ? 'file' : (selectedImagePreview ? 'image' : 'text');
    const finalCaption = content || (selectedFileAttachment ? selectedFileAttachment.name : '');
    if ((!finalCaption && !mediaUrl) || !selectedConversationId) return;

    const timeNow = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();
    const tempId = 'msg-' + Date.now();

    // 1. Trạng thái 1: Đang gửi (optimistic message)
    const optimisticMsg = {
      id: tempId,
      senderId: 'current',
      text: finalCaption,
      fileName: selectedFileAttachment?.name || null,
      fileSize: selectedFileAttachment?.size || null,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType,
      isRecalled: false,
      createdAt: nowIso,
      time: timeNow,
      status: 'sending'
    };

    const previewFileName = selectedFileAttachment?.name;
    setInputText('');
    setSelectedImagePreview(null);
    setSelectedFileAttachment(null);
    setShowEmojiPicker(false);
    setActiveMessages(prev => [...prev, optimisticMsg]);
    setConversations(prev => prev.map(c => {
      if (String(c.id) === String(selectedConversationId)) {
        let lastMsgLabel = finalCaption;
        if (!finalCaption) {
          if (mediaType === 'image') lastMsgLabel = '[Hình ảnh]';
          else if (mediaType === 'file') lastMsgLabel = `[Tệp tin] ${previewFileName || ''}`;
        }
        return {
          ...c,
          lastMessage: lastMsgLabel,
          lastTime: timeNow,
          messages: [...(c.messages || []), optimisticMsg]
        };
      }
      return c;
    }));

    // Gửi tin nhắn qua Backend
    const isGroup = currentConversation?.type === 'group';
    const targetUserId = currentConversation?.user?.id || targetInitialUserId;
    try {
      let serverMsg = null;
      if (currentUser) {
        if (isGroup) {
          serverMsg = await messageService.sendMessage(null, finalCaption, mediaUrl, mediaType, currentConversation.id);
        } else if (targetUserId) {
          serverMsg = await messageService.sendMessage(targetUserId, finalCaption, mediaUrl, mediaType);
        }
      }

      // Trạng thái 2: Đã gửi (Server đã nhận và lưu thành công)
      setActiveMessages(prev => prev.map(m => m.id === tempId ? {
        ...m,
        id: serverMsg ? serverMsg.id : m.id,
        status: serverMsg?.status || 'sent',
        mediaUrl: serverMsg?.media_url || m.mediaUrl,
        mediaType: serverMsg?.media_type || m.mediaType,
        isRecalled: Boolean(serverMsg?.is_recalled),
        createdAt: serverMsg?.created_at || m.createdAt
      } : m));

      if (serverMsg?.conversation_id) {
        const realConvId = String(serverMsg.conversation_id);
        setSelectedConversationId(realConvId);
        setDraftConversation(null);
      }

      setConversations(prev => prev.map(c => {
        if (String(c.id) === String(selectedConversationId)) {
          return {
            ...c,
            messages: (c.messages || []).map(m => m.id === tempId ? {
              ...m,
              id: serverMsg ? serverMsg.id : m.id,
              status: serverMsg?.status || 'sent',
              mediaUrl: serverMsg?.media_url || m.mediaUrl,
              mediaType: serverMsg?.media_type || m.mediaType,
              isRecalled: Boolean(serverMsg?.is_recalled),
              createdAt: serverMsg?.created_at || m.createdAt
            } : m)
          };
        }
        return c;
      }));

      await loadServerConversations(false);
    } catch (err) {
      console.warn("Lỗi gửi tin nhắn:", err);
      // Sự cố hệ thống / Mất kết nối mạng: Chuyển sang 'failed' (Gửi thất bại kèm nút Gửi lại)
      setActiveMessages(prev => prev.map(m => m.id === tempId ? {
        ...m,
        status: 'failed'
      } : m));

      setConversations(prev => prev.map(c => {
        if (String(c.id) === String(selectedConversationId)) {
          return {
            ...c,
            messages: (c.messages || []).map(m => m.id === tempId ? {
              ...m,
              status: 'failed'
            } : m)
          };
        }
        return c;
      }));
    }
  };

  // Xử lý gửi lại khi tin nhắn bị thất bại (Retry button)
  const handleRetryMessage = async (failedMsg) => {
    // 1. Chuyển lại trạng thái thành "Đang gửi"
    setActiveMessages(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: 'sending' } : m));
    setConversations(prev => prev.map(c => {
      if (String(c.id) === String(selectedConversationId)) {
        return {
          ...c,
          messages: (c.messages || []).map(m => m.id === failedMsg.id ? { ...m, status: 'sending' } : m)
        };
      }
      return c;
    }));

    const isGroup = currentConversation?.type === 'group';
    const targetUserId = currentConversation?.user?.id || targetInitialUserId;
    try {
      let serverMsg = null;
      if (currentUser) {
        if (isGroup) {
          serverMsg = await messageService.sendMessage(null, failedMsg.text, failedMsg.mediaUrl, failedMsg.mediaType || 'text', currentConversation.id);
        } else if (targetUserId) {
          serverMsg = await messageService.sendMessage(targetUserId, failedMsg.text, failedMsg.mediaUrl, failedMsg.mediaType || 'text');
        }
      }

      // Đã gửi
      setActiveMessages(prev => prev.map(m => m.id === failedMsg.id ? {
        ...m,
        id: serverMsg ? serverMsg.id : m.id,
        status: serverMsg?.status || 'sent'
      } : m));

      if (serverMsg?.conversation_id) {
        const realConvId = String(serverMsg.conversation_id);
        setSelectedConversationId(realConvId);
        setDraftConversation(null);
      }

      setConversations(prev => prev.map(c => {
        if (String(c.id) === String(selectedConversationId)) {
          return {
            ...c,
            messages: (c.messages || []).map(m => m.id === failedMsg.id ? {
              ...m,
              id: serverMsg ? serverMsg.id : m.id,
              status: serverMsg?.status || 'sent'
            } : m)
          };
        }
        return c;
      }));

      await loadServerConversations(false);
    } catch (err) {
      setActiveMessages(prev => prev.map(m => m.id === failedMsg.id ? {
        ...m,
        status: 'failed'
      } : m));

      setConversations(prev => prev.map(c => {
        if (String(c.id) === String(selectedConversationId)) {
          return {
            ...c,
            messages: (c.messages || []).map(m => m.id === failedMsg.id ? {
              ...m,
              status: 'failed'
            } : m)
          };
        }
        return c;
      }));
    }
  };

  // Lọc cuộc trò chuyện theo Tab (Chính hay Tin nhắn chờ) và theo ô tìm kiếm
  const displayedConversations = conversations.filter(c => {
    if (!c) return false;
    const isPendingForMe = c.status === 'pending' && c.initiatedBy !== currentUser?.id;
    const matchTab = (inboxTab === 'requests') ? isPendingForMe : !isPendingForMe;
    const nameStr = c.type === 'group' ? (c.name || '') : (c.user?.name || '');
    const usernameStr = c.type === 'group' ? '' : (c.user?.username || '');
    const searchLower = (searchTerm || '').toLowerCase();
    const matchSearch = nameStr.toLowerCase().includes(searchLower) ||
                        usernameStr.toLowerCase().includes(searchLower);
    return matchTab && matchSearch;
  });

  // Tìm ID tin nhắn đã xem mới nhất của chính mình để chỉ hiển thị avatar ở tin nhắn đó
  let lastReadMessageId = null;
  for (let i = activeMessages.length - 1; i >= 0; i--) {
    const m = activeMessages[i];
    if (m.senderId === 'current' && (m.status === 'read' || !m.status)) {
      lastReadMessageId = String(m.id);
      break;
    }
  }

  return (
    <main className={`w-full h-full min-h-0 flex flex-col overflow-hidden transition-all duration-200 ${
      isEdgeToEdge ? 'p-0' : 'p-2 sm:p-3 lg:p-4'
    }`}>
      <div className={`bg-white dark:bg-slate-900 shadow-sm border border-slate-200/90 dark:border-slate-800 h-full w-full flex min-h-0 overflow-hidden ${
        isEdgeToEdge ? 'rounded-none border-x-0 border-b-0' : 'rounded-2xl sm:rounded-3xl'
      }`}>
        
        {/* ================= CỘT TRÁI: DANH SÁCH CUỘC TRÒ CHUYỆN ================= */}
        <aside 
          className={
            'w-full md:w-80 lg:w-[350px] xl:w-[390px] border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 shrink-0 h-full overflow-hidden ' +
            (mobileShowChat ? 'hidden md:flex' : 'flex')
          }
        >
          {/* CỤM CỐ ĐỊNH ĐỨNG YÊN: HEADER + HỘP THƯ CHÍNH/CHỜ + Ô TÌM KIẾM */}
          <div className="shrink-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
            {/* Header danh sách chat */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-xs">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">{t('messages.chats')}</h2>
                  <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                    <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
                    <span className={isWsConnected ? 'text-slate-400 dark:text-slate-400 font-medium' : 'text-amber-500 font-medium'}>
                      {isWsConnected ? t('messages.realtime_connected') : t('messages.connecting')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Nút Tạo nhóm chat mới */}
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(true)}
                  className="px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                  title="Tạo nhóm trò chuyện mới"
                >
                  <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="hidden sm:inline">{t('messages.create_group')}</span>
                </button>

                {/* Nút toggle Tràn viền (Edge-to-Edge) */}
                <button
                  onClick={() => setIsEdgeToEdge(!isEdgeToEdge)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
                  title={isEdgeToEdge ? 'Thu về khung viền bo tròn' : 'Mở rộng tràn viền 100%'}
                >
                  {isEdgeToEdge ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* 2 Tab: Hộp thư chính & Tin nhắn chờ (Người lạ) - ĐỂ YÊN CỐ ĐỊNH */}
            <div className="flex px-3 pt-2 pb-2 bg-slate-50/80 dark:bg-slate-950/40 gap-1.5 border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setInboxTab('main');
                  if (draftConversation) setDraftConversation(null);
                }}
                className={
                  'flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ' +
                  (inboxTab === 'main'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/50')
                }
              >
                <span>{t('messages.main_inbox')}</span>
              </button>

              <button
                onClick={() => {
                  setInboxTab('requests');
                  if (draftConversation) setDraftConversation(null);
                }}
                className={
                  'flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 relative ' +
                  (inboxTab === 'requests'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/50')
                }
              >
                <span>{t('messages.message_requests')}</span>
                {pendingRequestsCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black animate-pulse">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            </div>

            {/* Ô tìm kiếm - ĐỂ YÊN CỐ ĐỊNH */}
            <div className="p-3 bg-white dark:bg-slate-900">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={inboxTab === 'main' ? t('messages.search_placeholder') : t('messages.search_requests')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-750 focus:bg-white dark:focus:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl border border-transparent focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* VÙNG CUỘN ĐỘC LẬP: DANH SÁCH CÁC CUỘC TRÒ CHUYỆN */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60 overscroll-contain">
            {displayedConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {inboxTab === 'main' ? (
                  <div className="py-6 flex flex-col items-center">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-3">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-700 dark:text-slate-200">
                      {isEn ? 'No conversations yet' : 'Chưa có cuộc trò chuyện nào'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[220px]">
                      {isEn 
                        ? 'Visit a friend\'s profile or Friends tab to start chatting!'
                        : 'Vào trang cá nhân bạn bè hoặc mục Bạn bè để bấm "Nhắn tin" bắt đầu trò chuyện!'}
                    </p>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-3">
                      <CheckCheck className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-700 dark:text-slate-200">
                      {isEn ? 'No message requests' : 'Không có tin nhắn chờ nào'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[220px]">
                      {isEn 
                        ? 'When non-friends message you, requests will appear here.'
                        : 'Khi người lạ gửi tin nhắn đến, yêu cầu sẽ xuất hiện tại đây.'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              displayedConversations.map((conv) => {
                const isSelected = conv.id === selectedConversationId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={
                      'w-full p-3 sm:p-3.5 flex items-center gap-3 text-left transition duration-150 cursor-pointer ' +
                      (isSelected ? 'bg-blue-50/90 dark:bg-slate-800/90 border-l-4 border-blue-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50')
                    }
                  >
                    {/* Avatar */}
                    {conv.type === 'group' ? (
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center ring-2 ring-slate-100 dark:ring-slate-800 shadow-2xs">
                          {conv.avatar ? (
                            <img src={conv.avatar} alt={conv.name} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <Users className="w-6 h-6" />
                          )}
                        </div>
                      </div>
                    ) : (() => {
                      const storyInfo = userStoryMap.get(String(conv.user?.id));
                      return (
                        <div 
                          className="relative shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (storyInfo) {
                              if (onOpenStoryViewer) {
                                onOpenStoryViewer({ tray: storyInfo.tray, userId: conv.user?.id });
                              }
                            } else if (onOpenProfile) {
                              onOpenProfile(conv.user);
                            }
                          }}
                          title={storyInfo ? (storyInfo.hasUnviewed ? 'Nhấn để xem tin mới' : 'Nhấn để xem tin') : 'Bấm để xem trang cá nhân'}
                        >
                          {/* Viền story: xanh nếu chưa xem, xám nếu đã xem hết */}
                          {storyInfo ? (
                            <div className={`rounded-full p-[2.5px] ${storyInfo.hasUnviewed ? 'bg-gradient-to-tr from-blue-500 to-sky-400 ring-0' : 'bg-slate-300 dark:bg-slate-700'}`}>
                              <div className="rounded-full p-[2px] bg-white dark:bg-slate-900">
                                <img
                                  src={conv.user?.avatar || DEFAULT_AVATAR}
                                  alt={conv.user?.name || ''}
                                  className="w-10 h-10 rounded-full object-cover cursor-pointer"
                                />
                              </div>
                            </div>
                          ) : (
                            <img
                              src={conv.user?.avatar || DEFAULT_AVATAR}
                              alt={conv.user?.name || ''}
                              className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 shadow-2xs hover:ring-2 hover:ring-blue-500 transition cursor-pointer"
                            />
                          )}
                          {/* Icon đám mây nếu có text story */}
                          {storyInfo?.hasTextStory && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow border-2 border-white dark:border-slate-900 z-10">
                              <svg viewBox="0 0 20 14" className="w-3 h-3 fill-white">
                                <path d="M4.5 11.5A3 3 0 0 1 2 8.5a3 3 0 0 1 2.4-2.94A4 4 0 0 1 12 4.1a3.5 3.5 0 0 1 5.5 2.9 3 3 0 0 1-.5 5.5H4.5z"/>
                              </svg>
                            </div>
                          )}
                          {conv.user?.isOnline && (
                            <span 
                              title={formatOnlineStatusText(conv.user, isEn)}
                              className={`absolute ${storyInfo ? 'bottom-0.5 right-0.5' : 'bottom-0 right-0'} w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full`} 
                            />
                          )}
                        </div>
                      );
                    })()}

                    {/* Tên & Tin nhắn cuối */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={'text-sm font-bold truncate flex items-center gap-1.5 ' + (isSelected ? 'text-blue-900 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100')}>
                          <span className="truncate">{conv.type === 'group' ? (conv.name || 'Nhóm trò chuyện') : (conv.user?.name || 'Người dùng')}</span>
                          {conv.type === 'group' && (
                            <span className="shrink-0 px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded text-[10px] font-semibold">
                              Nhóm
                            </span>
                          )}
                          {conv.type === 'group' && (activeGroupCallsStatus[conv.id]?.is_active || activeGroupCallsStatus[String(conv.id)]?.is_active) && (
                            <span className="shrink-0 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                              Đang gọi
                            </span>
                          )}
                        </h3>
                        <span className="text-[11px] text-slate-400 shrink-0 ml-1">
                          {conv.lastTime}
                        </span>
                      </div>
                      <p className={'text-xs truncate ' + (
                        (conv.type === 'group' && (activeGroupCallsStatus[conv.id]?.is_active || activeGroupCallsStatus[String(conv.id)]?.is_active))
                          ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                          : conv.unreadCount > 0 ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
                      )}>
                        {conv.type === 'group' && (activeGroupCallsStatus[conv.id]?.is_active || activeGroupCallsStatus[String(conv.id)]?.is_active)
                          ? '🟢 Cuộc gọi video nhóm đang diễn ra • Bấm để vào'
                          : conv.lastMessage}
                      </p>
                    </div>

                    {/* Nút Tham gia nhanh hoặc Huy hiệu chưa đọc */}
                    {conv.type === 'group' && (activeGroupCallsStatus[conv.id]?.is_active || activeGroupCallsStatus[String(conv.id)]?.is_active) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConversationId(String(conv.id));
                          joinGroupCall(conv.id);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs hover:scale-105 shrink-0 ml-1 cursor-pointer"
                        title="Tham gia cuộc gọi nhóm ngay"
                      >
                        Vào gọi
                      </button>
                    ) : conv.unreadCount > 0 && (
                      <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-[11px] font-bold flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ================= CỘT GIỮA: KHUNG CHAT CHI TIẾT ================= */}
        <section 
          className={
            'flex-1 min-w-0 min-h-0 h-full flex flex-col bg-slate-50/40 dark:bg-slate-950/70 overflow-hidden ' +
            (!mobileShowChat ? 'hidden md:flex' : 'flex')
          }
        >
          {currentConversation && currentConversation.user ? (
            <>
              {/* Header khung chat - CỐ ĐỊNH Ở ĐỈNH */}
              <div className="shrink-0 p-3 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setMobileShowChat(false);
                      if (draftConversation) setDraftConversation(null);
                    }}
                    className="md:hidden p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {currentConversation.type === 'group' ? (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      {currentConversation.avatar ? (
                        <img src={currentConversation.avatar} alt={currentConversation.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5" />
                      )}
                    </div>
                  ) : (() => {
                    const headerStoryInfo = userStoryMap.get(String(currentConversation.user?.id));
                    return (
                      <div 
                        className="relative cursor-pointer group shrink-0"
                        onClick={() => {
                          if (headerStoryInfo) {
                            if (onOpenStoryViewer) {
                              onOpenStoryViewer({ tray: headerStoryInfo.tray, userId: currentConversation.user.id });
                            }
                          } else if (onOpenProfile) {
                            onOpenProfile(currentConversation.user);
                          }
                        }}
                        title={headerStoryInfo ? (headerStoryInfo.hasUnviewed ? 'Nhấn để xem tin mới' : 'Nhấn để xem tin') : 'Bấm để xem trang cá nhân'}
                      >
                        {headerStoryInfo ? (
                          <div className={`rounded-full p-[2px] ${headerStoryInfo.hasUnviewed ? 'bg-gradient-to-tr from-blue-500 to-sky-400' : 'bg-slate-300 dark:bg-slate-700'}`}>
                            <div className="rounded-full p-[1.5px] bg-white dark:bg-slate-900">
                              <img
                                src={currentConversation.user.avatar || DEFAULT_AVATAR}
                                alt={currentConversation.user.name}
                                className="w-9 h-9 rounded-full object-cover"
                              />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={currentConversation.user.avatar || DEFAULT_AVATAR}
                            alt={currentConversation.user.name}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 shadow-2xs group-hover:ring-2 group-hover:ring-blue-500 transition"
                          />
                        )}
                        {currentConversation.user.isOnline && (
                          <span 
                            title={formatOnlineStatusText(currentConversation.user, isEn)}
                            className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" 
                          />
                        )}
                      </div>
                    );
                  })()}

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 
                        onClick={() => currentConversation.type !== 'group' && onOpenProfile && onOpenProfile(currentConversation.user)}
                        className={`text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 leading-tight ${currentConversation.type !== 'group' ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''} transition`}
                      >
                        {currentConversation.type === 'group' ? (currentConversation.name || 'Nhóm trò chuyện') : currentConversation.user.name}
                      </h3>
                      {currentConversation.type === 'group' ? (
                        <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-bold">
                          Nhóm
                        </span>
                      ) : currentConversation.status === 'pending' ? (
                        <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded text-[10px] font-bold">
                          Người lạ
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      {currentConversation.type === 'group' ? (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {currentConversation.memberCount || currentConversation.members?.length || 0} thành viên
                        </span>
                      ) : currentConversation.user.isOnline ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{isEn ? 'Active now' : 'Đang trực tuyến'}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                          <span>{formatOnlineStatusText(currentConversation.user, isEn)}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Actions ở Header Chat */}
                <div className="flex items-center gap-1 sm:gap-1.5 text-slate-500 dark:text-slate-400">
                  {currentConversation.type !== 'group' && (
                    <>
                      <button 
                        type="button"
                        onClick={() => startCall('audio')}
                        disabled={isBlocked}
                        title={isBlocked ? "Cuộc trò chuyện đang bị chặn" : "Gọi thoại"}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => startCall('video')}
                        disabled={isBlocked}
                        title={isBlocked ? "Cuộc trò chuyện đang bị chặn" : "Gọi video"}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </>
                  )}

                  {currentConversation.type === 'group' && (
                    (activeGroupCallsStatus[currentConversation.id]?.is_active || activeGroupCallsStatus[String(currentConversation.id)]?.is_active) ? (
                      <button
                        type="button"
                        onClick={() => joinGroupCall(currentConversation.id)}
                        title="Tham gia cuộc gọi nhóm đang diễn ra"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 animate-pulse cursor-pointer"
                      >
                        <Video className="w-4 h-4" />
                        <span>Tham gia gọi ({(activeGroupCallsStatus[currentConversation.id] || activeGroupCallsStatus[String(currentConversation.id)])?.participants_count || 1})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartOrJoinGroupCall(currentConversation.id)}
                        title="Bắt đầu hoặc tham gia gọi video nhóm"
                        className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl transition cursor-pointer text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
                      >
                        <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-xs font-semibold hidden md:inline">Gọi nhóm</span>
                      </button>
                    )
                  )}

                  {/* Nút Báo cáo cuộc trò chuyện */}
                  <button 
                    onClick={() => {
                      const convAuthor = currentConversation.isGroup
                        ? { name: currentConversation.name || 'Nhóm trò chuyện', username: 'group' }
                        : (currentConversation.user || { name: 'Người dùng', username: 'user' });
                      onOpenReportModal && onOpenReportModal({
                        targetType: 'message',
                        targetId: currentConversation.id,
                        targetAuthor: convAuthor,
                        contentExcerpt: currentConversation.lastMessage || ('Cuộc trò chuyện với ' + (convAuthor.name || 'thành viên'))
                      });
                    }}
                    title="Báo cáo cuộc trò chuyện này vi phạm"
                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition cursor-pointer text-slate-400 dark:text-slate-400"
                  >
                    <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* Nút Toggle Panel Thông tin người dùng (Cột 3) */}
                  <button 
                    onClick={() => setShowInfoSidebar(!showInfoSidebar)}
                    title={showInfoSidebar ? 'Ẩn thông tin hội thoại' : 'Xem thông tin người dùng & file đã gửi'}
                    className={`p-2 rounded-xl transition cursor-pointer hidden lg:flex ${
                      showInfoSidebar 
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' 
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* Nút Toggle Tràn viền */}
                  <button
                    onClick={() => setIsEdgeToEdge(!isEdgeToEdge)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition cursor-pointer hidden sm:flex"
                    title={isEdgeToEdge ? 'Thu về khung bo tròn' : 'Mở rộng tràn viền 100%'}
                  >
                    {isEdgeToEdge ? (
                      <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* BANNER THÔNG BÁO CUỘC GỌI NHÓM ĐANG DIỄN RA */}
              {currentConversation.type === 'group' && (activeGroupCallsStatus[currentConversation.id]?.is_active || activeGroupCallsStatus[String(currentConversation.id)]?.is_active) && !groupCallModalOpen && (
                <div className="shrink-0 p-3.5 sm:px-6 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between gap-3 text-emerald-950 dark:text-emerald-200 animate-fadeIn shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3.5 w-3.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                    </span>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                        <span>Cuộc gọi video nhóm đang diễn ra</span>
                      </p>
                      <p className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                        {(activeGroupCallsStatus[currentConversation.id] || activeGroupCallsStatus[String(currentConversation.id)])?.participants_count || 1} người đang trong cuộc gọi • Nhấn để tham gia cùng nhóm
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => joinGroupCall(currentConversation.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-600/30 hover:scale-105 cursor-pointer shrink-0"
                  >
                    <Video className="w-4 h-4" />
                    <span>Tham gia ngay</span>
                  </button>
                </div>
              )}

              {/* BANNER XÁC NHẬN TIN NHẮN CHỜ TỪ NGƯỜI LẠ (CHỈ BÊN NGƯỜI NHẬN MỚI CẦN XÁC NHẬN) */}
              {currentConversation.status === 'pending' && currentConversation.initiatedBy !== currentUser?.id && (
                <div className="shrink-0 p-4 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-xl shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-100">Yêu cầu trò chuyện từ người lạ</h4>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        {currentConversation.user.name} chưa có trong danh sách bạn bè của bạn. Chấp nhận để chuyển vào Hộp thư chính.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAcceptRequest(currentConversation.id)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Chấp nhận
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(currentConversation.id)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" /> Từ chối
                    </button>
                  </div>
                </div>
              )}

              {/* THÔNG BÁO NHẸ NHÀNG DÀNH CHO BÊN NGƯỜI GỬI (KHÔNG CHẶN NHẮN TIN) */}
              {currentConversation.status === 'pending' && currentConversation.initiatedBy === currentUser?.id && activeMessages.length > 0 && (
                <div className="shrink-0 px-4 py-2 bg-blue-50/80 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50 flex items-center justify-between text-blue-800 dark:text-blue-200 text-xs animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Tin nhắn đã gửi. Đối phương sẽ thấy trong mục <strong>Tin nhắn chờ</strong> và cần xác nhận để chuyển sang Hộp thư chính.</span>
                  </div>
                </div>
              )}

              {/* Danh sách tin nhắn (Tự động dồn từ dưới lên, cuộn độc lập bên trong) */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col overscroll-contain"
              >
                {/* Spacer linh hoạt: Đẩy toàn bộ nội dung xuống sát đáy khi ít tin nhắn */}
                <div className="flex-1 min-h-2 sm:min-h-4" />

                {/* Thông tin mở đầu cuộc trò chuyện (Gọn gàng, đồng bộ cho mọi người) */}
                <div className="py-4 sm:py-6 flex flex-col items-center text-center space-y-1.5 mb-2 shrink-0">
                  <div 
                    className="relative mb-0.5 cursor-pointer group"
                    onClick={() => onOpenProfile && onOpenProfile(currentConversation.user)}
                    title="Bấm để xem trang cá nhân"
                  >
                    <img
                      src={currentConversation.user.avatar || DEFAULT_AVATAR}
                      alt={currentConversation.user.name}
                      className="w-14 h-14 rounded-full object-cover ring-4 ring-slate-100 dark:ring-slate-800 shadow-xs group-hover:ring-blue-400 transition"
                    />
                    {currentConversation.user.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                    )}
                  </div>
                  <h4 
                    onClick={() => onOpenProfile && onOpenProfile(currentConversation.user)}
                    className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 leading-tight cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    {currentConversation.user.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    {currentConversation.user.bio || (currentConversation.user.isFriend ? 'Bạn bè trên WINGS' : 'Trò chuyện trên WINGS')}
                  </p>
                  <div className="pt-0.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700">
                      {currentConversation.user.isFriend ? 'Đã là bạn bè trên WINGS' : 'Bắt đầu cuộc trò chuyện'}
                    </span>
                  </div>

                  {/* Gợi ý lời chào khi cuộc trò chuyện mới được tạo (chưa có tin nhắn) */}
                  {activeMessages.length === 0 && (
                    <div className="pt-3 flex flex-col items-center gap-2">
                      <p className="text-xs text-slate-400 font-medium">Gợi ý gửi lời chào:</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {['Xin chào! 👋', 'Chào bạn nhé! 😊', 'Rất vui được làm quen! 🎉'].map((greeting, gIdx) => (
                          <button
                            key={gIdx}
                            onClick={() => {
                              setInputText(greeting);
                            }}
                            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 hover:border-blue-300 rounded-full text-xs font-semibold shadow-2xs transition cursor-pointer"
                          >
                            {greeting}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Nhóm danh sách các tin nhắn */}
                <div className="flex flex-col w-full">
                  {activeMessages.map((msg, idx) => {
                    const prevMsg = activeMessages[idx - 1];
                    const nextMsg = activeMessages[idx + 1];

                    const dateDivider = getMessageDateDivider(msg, prevMsg, isEn);
                    const timeDivider = getMessageTimeDivider(msg, prevMsg);

                    if (msg.mediaType === 'system') {
                      return (
                        <div key={msg.id} className="w-full flex flex-col">
                          {dateDivider && (
                            <div className="flex items-center justify-center my-4 w-full select-none" data-testid="chat-date-divider">
                              <div className="flex items-center gap-1.5 px-3.5 py-1 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xs text-slate-500 dark:text-slate-400 text-xs font-semibold rounded-full shadow-2xs border border-slate-200/60 dark:border-slate-700/60">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                <span>{dateDivider}</span>
                              </div>
                            </div>
                          )}
                          {!dateDivider && timeDivider && (
                            <div className="flex items-center justify-center my-3 w-full select-none" data-testid="chat-time-divider">
                              <div className="flex items-center gap-1 px-2.5 py-0.5 bg-slate-100/60 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-[11px] font-medium rounded-full">
                                <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                <span>{timeDivider}</span>
                              </div>
                            </div>
                          )}
                          <div className="flex justify-center my-3 w-full">
                            <div className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs rounded-full font-medium shadow-2xs border border-slate-200/60 dark:border-slate-700 max-w-md text-center">
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isSameSenderAsPrev = Boolean(
                      prevMsg &&
                      !dateDivider &&
                      !timeDivider &&
                      prevMsg.mediaType !== 'system' &&
                      String(prevMsg.senderId) === String(msg.senderId) &&
                      prevMsg.time === msg.time
                    );

                    const isSameSenderAsNext = Boolean(
                      nextMsg &&
                      nextMsg.mediaType !== 'system' &&
                      String(nextMsg.senderId) === String(msg.senderId) &&
                      Boolean(msg.time) &&
                      nextMsg.time === msg.time
                    );

                    const isMe = msg.senderId === 'current';
                    const isLastRead = isMe && String(msg.id) === lastReadMessageId;
                    const isGroup = currentConversation?.type === 'group';
                    const senderAvatar = (isGroup ? msg.senderAvatar : currentConversation.user?.avatar) || DEFAULT_AVATAR;

                    const showTimestamp = !isSameSenderAsNext;
                    const hasFooter = (showTimestamp && Boolean(msg.time)) ||
                      msg.status === 'sending' ||
                      msg.status === 'failed' ||
                      ((msg.status === 'read' || !msg.status) && isLastRead);

                    const itemMarginTop = (idx === 0 || dateDivider || timeDivider)
                      ? 'mt-1'
                      : isSameSenderAsPrev ? 'mt-1' : 'mt-3.5';
                    const fullTimeTooltip = msg.createdAt ? formatFullTimestamp(msg.createdAt, isEn) : (msg.time || '');

                    return (
                      <div key={msg.id} className="w-full flex flex-col">
                        {dateDivider && (
                          <div className="flex items-center justify-center my-4 w-full select-none" data-testid="chat-date-divider">
                            <div className="flex items-center gap-1.5 px-3.5 py-1 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xs text-slate-500 dark:text-slate-400 text-xs font-semibold rounded-full shadow-2xs border border-slate-200/60 dark:border-slate-700/60">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <span>{dateDivider}</span>
                            </div>
                          </div>
                        )}
                        {!dateDivider && timeDivider && (
                          <div className="flex items-center justify-center my-3 w-full select-none" data-testid="chat-time-divider">
                            <div className="flex items-center gap-1 px-2.5 py-0.5 bg-slate-100/60 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-[11px] font-medium rounded-full">
                              <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              <span>{timeDivider}</span>
                            </div>
                          </div>
                        )}
                        <div
                          className={'flex items-end gap-2.5 ' + itemMarginTop + (isMe ? ' justify-end' : ' justify-start')}
                        >
                          {!isMe && (
                            <img
                              src={senderAvatar}
                              alt=""
                              onClick={() => !isGroup && onOpenProfile && onOpenProfile(currentConversation.user)}
                              title={msg.senderName || currentConversation.user?.name || 'Người dùng'}
                              className={`w-8 h-8 rounded-full object-cover shrink-0 mb-1 ring-2 ring-slate-100 dark:ring-slate-800 ${!isGroup ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : ''} transition ${isSameSenderAsNext ? 'opacity-0 pointer-events-none' : ''}`}
                            />
                          )}

                          <div className={'max-w-[80%] sm:max-w-[70%] lg:max-w-[65%] group relative flex flex-col ' + (isMe ? 'items-end' : 'items-start')}>
                            {!isMe && isGroup && msg.senderName && !isSameSenderAsPrev && (
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 px-1">
                                {msg.senderName}
                              </span>
                            )}

                            {/* Hàng ngang chứa tin nhắn và nút thao tác nhanh khi hover */}
                            <div className={'flex items-center gap-1.5 group/bubble ' + (isMe ? 'flex-row' : 'flex-row-reverse')}>
                              {/* Nút hành động hiển thị khi hover */}
                              {isMe ? (
                                !msg.isRecalled && msg.status !== 'sending' && msg.status !== 'failed' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRecallMessage(msg)}
                                    title="Thu hồi tin nhắn này"
                                    className="opacity-0 group-hover/bubble:opacity-100 text-slate-400 hover:text-rose-500 transition cursor-pointer p-1 text-[11px] flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Thu hồi</span>
                                  </button>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const authorObj = currentConversation.isGroup
                                      ? { name: msg.senderName || 'Thành viên nhóm', username: 'member' }
                                      : (currentConversation.user || { name: 'Người dùng', username: 'user' });
                                    onOpenReportModal && onOpenReportModal({
                                      targetType: 'message',
                                      targetId: msg.id,
                                      targetAuthor: authorObj,
                                      contentExcerpt: msg.text || (msg.mediaUrl ? '[Hình ảnh đính kèm]' : ''),
                                      imageUrl: msg.mediaUrl || null
                                    });
                                  }}
                                  title="Báo cáo tin nhắn này"
                                  className="opacity-0 group-hover/bubble:opacity-100 text-slate-300 hover:text-rose-500 transition cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                                >
                                  <Flag className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Nội dung tin nhắn: Thu hồi hoặc Nhật ký cuộc gọi hoặc Hiển thị thường (ảnh + chữ + link) */}
                            {msg.isRecalled ? (
                              <div
                                title={fullTimeTooltip}
                                className={
                                  'px-4 py-2.5 rounded-2xl text-xs sm:text-sm italic leading-relaxed break-words shadow-2xs flex items-center gap-1.5 ' +
                                  (isMe
                                    ? 'bg-blue-100/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border border-blue-200/60 dark:border-blue-800/40 rounded-br-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-bl-xs')
                                }
                              >
                                <RotateCcw className="w-3.5 h-3.5 opacity-70 shrink-0" />
                                <span>Tin nhắn đã được thu hồi</span>
                              </div>
                            ) : msg.mediaType === 'call_log' ? (() => {
                              const isGroup = currentConversation.type === 'group';
                              const isMissed = msg.text?.includes('nhỡ');
                              const isRejected = msg.text?.includes('từ chối');
                              const isCancelled = msg.text?.includes('hủy');
                              const isEnded = msg.text?.includes('kết thúc');

                              const statusLabel = isMissed
                                ? '• Cuộc gọi nhỡ'
                                : isRejected
                                  ? '• Bị từ chối'
                                  : isCancelled
                                    ? '• Đã hủy'
                                    : isEnded
                                      ? '• Đã kết thúc'
                                      : isGroup
                                        ? '• Cuộc gọi nhóm'
                                        : '• Cuộc gọi';

                              return (
                                <div
                                  className={
                                    'p-3 sm:p-3.5 rounded-2xl text-sm shadow-2xs border flex items-center gap-3 transition min-w-[240px] max-w-xs sm:max-w-sm ' +
                                    (isMissed || isRejected
                                      ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/50 text-slate-800 dark:text-slate-100'
                                      : isCancelled
                                        ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50 text-slate-800 dark:text-slate-100'
                                        : isMe
                                          ? 'bg-blue-50/90 dark:bg-slate-800 border-blue-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-br-xs'
                                          : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-xs')
                                  }
                                >
                                  <div
                                    className={
                                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ' +
                                      (isMissed || isRejected
                                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                                        : isCancelled
                                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                                          : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400')
                                    }
                                  >
                                    {isGroup ? (
                                      <Video className="w-5 h-5" />
                                    ) : isMissed ? (
                                      <PhoneMissed className="w-5 h-5" />
                                    ) : isRejected || isCancelled ? (
                                      <PhoneOff className="w-5 h-5" />
                                    ) : msg.text?.includes('thoại') ? (
                                      <Phone className="w-5 h-5" />
                                    ) : (
                                      <Video className="w-5 h-5" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0 pr-1">
                                    <div className="font-semibold text-xs sm:text-sm truncate flex items-center gap-1.5">
                                      <span className="truncate">{msg.text}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                      <span title={fullTimeTooltip} className="cursor-default select-none">{msg.time}</span>
                                      <span className={`font-medium ${
                                        isMissed || isRejected
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : isCancelled
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : 'text-slate-500 dark:text-slate-400'
                                      }`}>
                                        {statusLabel}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isGroup) {
                                        handleStartOrJoinGroupCall(currentConversation.id);
                                      } else {
                                        startCall(msg.text?.includes('thoại') ? 'audio' : 'video');
                                      }
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1 transition shadow-xs cursor-pointer shrink-0 hover:scale-105 active:scale-95 bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
                                    title={isGroup ? 'Gọi nhóm lại' : 'Gọi lại ngay'}
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                    <span>Gọi lại</span>
                                  </button>
                                </div>
                              );
                            })() : (
                              <div
                                title={fullTimeTooltip}
                                className={
                                  'px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-2xs ' +
                                  (isMe
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-bl-xs')
                                }
                              >
                                {/* Tệp tin đính kèm (nếu có) */}
                                {msg.mediaType === 'file' && msg.mediaUrl && (
                                  <a
                                    href={msg.mediaUrl}
                                    download={msg.text || msg.fileName || 'tep-tin'}
                                    className={
                                      'p-3 mb-1.5 rounded-xl flex items-center gap-3 transition border ' +
                                      (isMe
                                        ? 'bg-white/15 hover:bg-white/25 border-white/25 text-white'
                                        : 'bg-slate-50 dark:bg-slate-750 hover:bg-blue-50/60 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100')
                                    }
                                    title="Bấm để tải về"
                                  >
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'}`}>
                                      <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-2">
                                      <span className="font-semibold text-xs truncate block">{msg.text || msg.fileName || 'Tệp đính kèm'}</span>
                                      <span className={`text-[10px] block ${isMe ? 'text-white/80' : 'text-slate-400 dark:text-slate-400'}`}>Bấm để tải về</span>
                                    </div>
                                    <Download className="w-4 h-4 shrink-0 opacity-80" />
                                  </a>
                                )}

                                {/* Ảnh đính kèm (nếu có) */}
                                {msg.mediaType !== 'file' && msg.mediaUrl && (
                                  <div className="mb-2 rounded-xl overflow-hidden cursor-pointer group/img max-w-xs">
                                    <img
                                      src={msg.mediaUrl}
                                      alt="Ảnh đính kèm"
                                      onClick={() => setSelectedImageModal(msg.mediaUrl)}
                                      className="max-h-60 w-auto rounded-lg object-cover hover:opacity-90 transition shadow-2xs"
                                    />
                                  </div>
                                )}

                                {/* Văn bản tin nhắn có nhận diện Link (chỉ hiển thị nếu không phải tin file đơn thuần) */}
                                {msg.text && msg.mediaType !== 'file' && (
                                  <FormattedMessageText
                                    text={msg.text}
                                    isMe={isMe}
                                  />
                                )}
                              </div>
                            )}
                            </div>

                            {/* Thông tin chân tin nhắn (mốc thời gian, trạng thái gửi/xem) */}
                            {hasFooter && (
                              <div
                                className={
                                  'flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 px-1 ' +
                                  (isMe ? 'justify-end' : 'justify-start')
                                }
                              >
                                {showTimestamp && (
                                  <span title={fullTimeTooltip} className="cursor-default select-none">
                                    {msg.time}
                                  </span>
                                )}
                                {isMe && (
                                  <div className="flex items-center gap-1.5">
                                    {/* Trạng thái 1: Đang gửi */}
                                    {msg.status === 'sending' && (
                                      <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium animate-pulse" title="Đang gửi...">
                                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                        <span>Đang gửi...</span>
                                      </span>
                                    )}

                                    {/* Trạng thái 2: Đã gửi */}
                                    {showTimestamp && msg.status === 'sent' && (
                                      <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium" title="Đã gửi">
                                        <Check className="w-3 h-3 text-slate-400" />
                                        <span>Đã gửi</span>
                                      </span>
                                    )}

                                    {/* Trạng thái 3: Đã nhận */}
                                    {showTimestamp && msg.status === 'delivered' && (
                                      <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium" title="Đã nhận">
                                        <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Đã nhận</span>
                                      </span>
                                    )}

                                    {/* Trạng thái 4: Đã xem */}
                                    {(msg.status === 'read' || !msg.status) && isLastRead && (
                                      <div 
                                        className="flex items-center gap-1 text-[10px] text-blue-600 font-medium" 
                                        title={currentConversation.type === 'group' ? 'Đã xem' : `Đã xem bởi ${currentConversation.user?.name || ''}`}
                                      >
                                        <span>Đã xem</span>
                                        {currentConversation.type !== 'group' && currentConversation.user?.avatar && (
                                          <img
                                            src={currentConversation.user.avatar}
                                            alt={currentConversation.user?.name || ''}
                                            className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-blue-300 shadow-2xs"
                                          />
                                        )}
                                      </div>
                                    )}

                                    {/* Trạng thái lỗi: Gửi thất bại kèm nút Gửi lại */}
                                    {msg.status === 'failed' && (
                                      <div className="flex items-center gap-1.5 text-rose-500 font-medium">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span className="text-[10px]">Gửi thất bại</span>
                                        <button
                                          type="button"
                                          onClick={() => handleRetryMessage(msg)}
                                          className="ml-0.5 px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-md text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                          title="Nhấn để gửi lại tin nhắn này"
                                        >
                                          <RotateCw className="w-2.5 h-2.5" /> Gửi lại
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Trạng thái đối phương đang gõ */}
                  {isTyping && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs italic py-1">
                      <img
                        src={currentConversation.user.avatar}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800"
                      />
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 rounded-full flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                      <span className="text-slate-500 dark:text-slate-400">{currentConversation.user.name} đang soạn tin...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Thanh nhập tin nhắn (hoặc thông báo khi bị chặn) */}
              {isBlocked ? (
                <div className="shrink-0 p-4 bg-slate-100 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                    <Ban className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>
                      {isBlockedByMe 
                        ? 'Bạn đã chặn người dùng này. Bỏ chặn để tiếp tục gửi tin nhắn.' 
                        : 'Bạn không thể gửi tin nhắn cho người dùng này do cuộc trò chuyện đã bị chặn.'}
                    </span>
                  </div>
                  {isBlockedByMe && (
                    <button
                      type="button"
                      onClick={() => handleUnblockConversation(currentConversation.id)}
                      className="px-4 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      Bỏ chặn
                    </button>
                  )}
                </div>
              ) : (
                <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 relative">
                  {/* Xem trước ảnh đính kèm trước khi gửi */}
                  {selectedImagePreview && (
                    <div className="px-4 pt-3 flex items-center gap-2">
                      <div className="relative inline-block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xs group">
                        <img 
                          src={selectedImagePreview} 
                          alt="Xem trước ảnh" 
                          className="w-16 h-16 object-cover" 
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedImagePreview(null)}
                          className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-black text-white rounded-full transition cursor-pointer"
                          title="Hủy chọn ảnh"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">Ảnh đã chọn sẵn sàng gửi kèm</span>
                    </div>
                  )}

                  {/* Xem trước tệp tin đính kèm trước khi gửi */}
                  {selectedFileAttachment && (
                    <div className="px-4 pt-3 flex items-center gap-2">
                      <div className="flex items-center gap-2.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl shadow-2xs">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <div className="max-w-[200px] sm:max-w-xs truncate">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{selectedFileAttachment.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{formatFileSize(selectedFileAttachment.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedFileAttachment(null)}
                          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition cursor-pointer ml-1"
                          title="Hủy chọn tệp tin"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">Tệp tin đã chọn sẵn sàng gửi</span>
                    </div>
                  )}

                  {/* Bảng chọn Emoji Picker */}
                  {showEmojiPicker && (
                    <div 
                      ref={emojiPickerRef}
                      className="absolute bottom-full left-4 mb-2 w-72 sm:w-80 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-2xl shadow-xl z-30 p-3 max-h-72 overflow-y-auto animate-fadeIn"
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-750">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Biểu tượng cảm xúc</span>
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(false)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-750 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {EMOJI_CATEGORIES.map((cat, idx) => (
                          <div key={idx}>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              {cat.name}
                            </div>
                            <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
                              {cat.emojis.map((emoji, eIdx) => (
                                <button
                                  key={eIdx}
                                  type="button"
                                  onClick={() => {
                                    setInputText(prev => prev + emoji);
                                    inputRef.current?.focus();
                                  }}
                                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-slate-750 rounded-lg transition cursor-pointer"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hidden File Input cho gửi ảnh */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />

                  {/* Hidden File Input cho gửi tệp tin / tài liệu */}
                  <input
                    type="file"
                    ref={docFileInputRef}
                    className="hidden"
                    onChange={handleDocumentSelect}
                  />

                  <form 
                    onSubmit={handleSendMessage}
                    className="p-3 sm:p-4 flex items-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Gửi ảnh"
                      className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => docFileInputRef.current?.click()}
                      title="Đính kèm tệp tin"
                      className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      title="Biểu tượng cảm xúc"
                      className={`p-2 rounded-xl transition cursor-pointer ${
                        showEmojiPicker ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-500' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    <input
                      ref={inputRef}
                      type="text"
                      placeholder={
                        currentConversation.status === 'pending'
                          ? 'Chấp nhận cuộc trò chuyện để trả lời...'
                          : ('Nhắn tin cho ' + currentConversation.user.name + '... (Nhấn Enter để gửi)')
                      }
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (inputText.trim() || selectedImagePreview || selectedFileAttachment) {
                            handleSendMessage(e);
                          }
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-750 focus:bg-white dark:focus:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-full border border-transparent focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition"
                    />

                    <button
                      type="submit"
                      disabled={!inputText.trim() && !selectedImagePreview && !selectedFileAttachment}
                      title={inputText.trim() || selectedImagePreview || selectedFileAttachment ? "Gửi tin nhắn (Enter)" : "Nhập nội dung hoặc đính kèm ảnh/tệp tin để gửi"}
                      className={
                        'p-2.5 rounded-full text-white transition shadow-sm ' +
                        (inputText.trim() || selectedImagePreview || selectedFileAttachment
                          ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 scale-105 cursor-pointer'
                          : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60')
                      }
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">Chưa chọn cuộc trò chuyện</h3>
              <p className="text-sm mt-1 max-w-sm">
                Hãy chọn một người từ danh sách bên trái để bắt đầu xem tin nhắn!
              </p>
            </div>
          )}
        </section>

        {/* ================= CỘT 3: THÔNG TIN NGƯỜI DÙNG & TÙY CHỌN TRÒ CHUYỆN ================= */}
        {showInfoSidebar && currentConversation && currentConversation.user && (
          <aside className="hidden lg:flex w-72 xl:w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col shrink-0 h-full min-h-0 overflow-y-auto animate-fadeIn">
            {/* Header Cột 3 */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Thông tin đoạn chat</h3>
              <button 
                onClick={() => setShowInfoSidebar(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Đóng panel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Thông tin đại diện */}
            <div className="p-6 flex flex-col items-center text-center border-b border-slate-100 dark:border-slate-800">
              {currentConversation.type === 'group' ? (
                <div className="relative group/avatar mb-3">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center ring-4 ring-slate-100 dark:ring-slate-800 shadow-md overflow-hidden">
                    {currentConversation.avatar ? (
                      <img src={currentConversation.avatar} alt={currentConversation.name} className="w-20 h-20 rounded-full object-cover" />
                    ) : (
                      <Users className="w-10 h-10" />
                    )}
                  </div>
                  {/* Nút đổi ảnh nhóm */}
                  <button
                    type="button"
                    onClick={() => groupAvatarInputRef.current?.click()}
                    disabled={isUpdatingGroupAvatar}
                    className="absolute inset-0 bg-slate-900/50 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                    title="Đổi ảnh đại diện nhóm"
                  >
                    {isUpdatingGroupAvatar ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-5 h-5" />
                        <span className="text-[10px] font-medium mt-0.5">Đổi ảnh</span>
                      </>
                    )}
                  </button>
                  <input
                    type="file"
                    ref={groupAvatarInputRef}
                    onChange={handleGroupAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              ) : (
                <div 
                  className="relative mb-3 cursor-pointer group shrink-0"
                  onClick={() => onOpenProfile && onOpenProfile(currentConversation.user)}
                  title="Bấm để xem trang cá nhân"
                >
                  <img 
                    src={currentConversation.user.avatar || DEFAULT_AVATAR} 
                    alt={currentConversation.user.name} 
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-slate-100 dark:ring-slate-800 shadow-md group-hover:ring-2 group-hover:ring-blue-500 transition"
                  />
                  {currentConversation.user.isOnline && (
                    <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                  )}
                </div>
              )}

              {currentConversation.type === 'group' ? (
                isEditingGroupName ? (
                  <div className="w-full mt-1 mb-2 px-2 flex flex-col items-center gap-1.5 animate-fadeIn">
                    <input
                      type="text"
                      value={editedGroupName}
                      onChange={(e) => setEditedGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveGroupName();
                        if (e.key === 'Escape') handleCancelEditGroupName();
                      }}
                      autoFocus
                      placeholder="Nhập tên nhóm..."
                      maxLength={100}
                      className="w-full text-center text-sm font-semibold text-slate-800 dark:text-slate-100 border border-blue-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 rounded-lg px-2 py-1 bg-slate-50 dark:bg-slate-800"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSaveGroupName}
                        disabled={isUpdatingGroupName || !editedGroupName.trim()}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                        title="Lưu tên nhóm"
                      >
                        {isUpdatingGroupName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditGroupName}
                        disabled={isUpdatingGroupName}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                        title="Hủy"
                      >
                        <X className="w-3.5 h-3.5" />
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 group/title max-w-full px-2">
                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                      {currentConversation.name || 'Nhóm trò chuyện'}
                    </h4>
                    <button
                      type="button"
                      onClick={handleStartEditGroupName}
                      className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer shrink-0"
                      title="Đổi tên nhóm"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              ) : (
                <h4 
                  onClick={() => onOpenProfile && onOpenProfile(currentConversation.user)}
                  className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition truncate max-w-full"
                >
                  {currentConversation.user.name}
                </h4>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {currentConversation.type === 'group' 
                  ? `${currentConversation.memberCount || currentConversation.members?.length || 0} thành viên`
                  : `@${currentConversation.user.username}`}
              </p>
              <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                currentConversation.type === 'group'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                  : currentConversation.user.isOnline 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {currentConversation.type === 'group' ? (
                  'Nhóm trò chuyện'
                ) : (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full ${currentConversation.user.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    <span>{formatOnlineStatusText(currentConversation.user, isEn)}</span>
                  </>
                )}
              </span>

              {/* Phím tắt tác vụ nhanh */}
              <div className="grid grid-cols-3 gap-2 w-full mt-5">
                <button 
                  onClick={() => currentConversation.type !== 'group' && onOpenProfile && onOpenProfile(currentConversation.user)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  title={currentConversation.type === 'group' ? 'Thành viên' : 'Trang cá nhân'}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
                    {currentConversation.type === 'group' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-medium">{currentConversation.type === 'group' ? 'Thành viên' : 'Trang cá nhân'}</span>
                </button>

                <button 
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  title="Tắt thông báo"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
                    <BellOff className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-medium">Tắt báo</span>
                </button>

                <button 
                  onClick={() => {
                    const convAuthor = currentConversation.isGroup
                      ? { name: currentConversation.name || 'Nhóm trò chuyện', username: 'group' }
                      : (currentConversation.user || { name: 'Người dùng', username: 'user' });
                    onOpenReportModal && onOpenReportModal({
                      targetType: 'message',
                      targetId: currentConversation.id,
                      targetAuthor: convAuthor,
                      contentExcerpt: currentConversation.lastMessage || ('Đoạn chat với ' + (currentConversation.name || convAuthor.name))
                    });
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                  title="Báo cáo vi phạm"
                >
                  <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-medium">Báo cáo</span>
                </button>
              </div>
            </div>

            {/* Danh sách thành viên (nếu là nhóm) */}
            {currentConversation.type === 'group' && currentConversation.members?.length > 0 && (
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  <span>Thành viên ({currentConversation.members.length})</span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {currentConversation.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                      <img
                        src={m.avatar || DEFAULT_AVATAR}
                        alt={m.name}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-100 dark:ring-slate-800 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{m.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">@{m.username}</p>
                      </div>
                      {String(m.id) === String(currentUser?.id) && (
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded">
                          Bạn
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File, Ảnh & Link đã gửi */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <span>File, Ảnh & Link đã gửi</span>
                {(sharedMedia.length > 0 || sharedLinks.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAllMediaTab(sidebarActiveTab);
                      setShowAllMediaModal(true);
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer font-normal text-xs transition"
                  >
                    Xem tất cả
                  </button>
                )}
              </div>

              {/* Sub-tabs chuyển đổi giữa Ảnh & File và Link */}
              <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setSidebarActiveTab('media')}
                  className={`flex-1 py-1 rounded-md font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    sidebarActiveTab === 'media'
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Ảnh & File</span>
                  {sharedMedia.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 rounded-full font-bold">
                      {sharedMedia.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarActiveTab('links')}
                  className={`flex-1 py-1 rounded-md font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    sidebarActiveTab === 'links'
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Link</span>
                  {sharedLinks.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 rounded-full font-bold">
                      {sharedLinks.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Nội dung danh sách theo tab */}
              {sidebarActiveTab === 'media' ? (
                sharedMedia.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {sharedMedia.slice(0, 6).map((item) => (
                      item.type === 'file' ? (
                        <a
                          key={item.id}
                          href={item.url}
                          download={item.fileName || 'tep-tin'}
                          className="relative group rounded-lg p-1.5 border border-slate-200/80 dark:border-slate-700 aspect-square flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50/80 dark:hover:bg-slate-750 transition cursor-pointer"
                          title={item.fileName || 'Tệp đính kèm'}
                        >
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-0.5" />
                          <span className="text-[9px] text-slate-700 dark:text-slate-200 truncate max-w-full font-medium leading-tight px-0.5">{item.fileName || 'Tệp tin'}</span>
                          <Download className="w-3 h-3 text-slate-400 group-hover:text-blue-600 mt-1" />
                        </a>
                      ) : (
                        <div
                          key={item.id}
                          className="relative group rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700 aspect-square cursor-pointer"
                          onClick={() => setSelectedImageModal(item.url)}
                        >
                          <img
                            src={item.url}
                            alt="media"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            <ZoomIn className="w-4 h-4" />
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-3">Chưa có ảnh hoặc file nào được gửi</p>
                )
              ) : (
                sharedLinks.length > 0 ? (
                  <div className="space-y-1.5">
                    {sharedLinks.slice(0, 4).map((linkItem) => (
                      <a
                        key={linkItem.id}
                        href={linkItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50/70 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-700 hover:border-blue-200 flex items-center justify-between gap-2 transition group cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                            <ExternalLink className="w-3 h-3 shrink-0 text-slate-400 group-hover:text-blue-500" />
                            <span className="truncate">{linkItem.domain}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                            {linkItem.url}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-3">Chưa có liên kết nào được gửi</p>
                )
              )}
            </div>

            {/* Cài đặt riêng tư */}
            <div className="p-4 space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Quyền riêng tư & Hỗ trợ
              </div>
              <button 
                onClick={() => {
                  onOpenReportModal && onOpenReportModal({
                    targetType: 'message',
                    targetId: currentConversation.id,
                    targetAuthor: currentConversation.user,
                    contentExcerpt: currentConversation.lastMessage
                  });
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition cursor-pointer"
              >
                <Flag className="w-4 h-4 text-rose-500" />
                <span>Báo cáo cuộc trò chuyện này</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  if (isBlockedByMe) {
                    handleUnblockConversation(currentConversation.id);
                  } else {
                    handleBlockConversation(currentConversation.id);
                  }
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition cursor-pointer ${
                  isBlockedByMe 
                    ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400'
                }`}
              >
                <Ban className={`w-4 h-4 ${isBlockedByMe ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                <span>{isBlockedByMe ? 'Bỏ chặn người dùng này' : 'Chặn tin nhắn & cuộc gọi'}</span>
              </button>
            </div>
          </aside>
        )}

        {/* Modal Xem ảnh phóng to (Lightbox) */}
        {selectedImageModal && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn"
            onClick={() => setSelectedImageModal(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <img
                src={selectedImageModal}
                alt="Chi tiết ảnh"
                className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />
              <button
                type="button"
                onClick={() => setSelectedImageModal(null)}
                className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black text-white rounded-full transition cursor-pointer"
                title="Đóng xem ảnh"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Modal Xem tất cả File, Ảnh & Link đã gửi */}
        {showAllMediaModal && (
          <div 
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn"
            onClick={() => setShowAllMediaModal(false)}
          >
            <div 
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-800 animate-scaleUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">File, Ảnh & Link đã gửi</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hội thoại với {currentConversation?.user?.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllMediaModal(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex items-center px-6 border-b border-slate-200 dark:border-slate-800 gap-6">
                <button
                  type="button"
                  onClick={() => setAllMediaTab('media')}
                  className={`py-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
                    allMediaTab === 'media'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Ảnh & File ({sharedMedia.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAllMediaTab('links')}
                  className={`py-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
                    allMediaTab === 'links'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Liên kết / Link ({sharedLinks.length})</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 min-h-[300px]">
                {allMediaTab === 'media' ? (
                  sharedMedia.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {sharedMedia.map((item) => (
                        item.type === 'file' ? (
                          <a
                            key={item.id}
                            href={item.url}
                            download={item.fileName || 'tep-tin'}
                            className="relative group rounded-xl p-3 border border-slate-200 dark:border-slate-700 aspect-square flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800 hover:bg-blue-50/80 dark:hover:bg-slate-750 transition cursor-pointer shadow-2xs hover:shadow-md"
                            title={item.fileName || 'Tệp đính kèm'}
                          >
                            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-1.5" />
                            <span className="text-xs text-slate-700 dark:text-slate-200 truncate max-w-full font-semibold">{item.fileName || 'Tệp tin'}</span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1 font-medium">
                              <Download className="w-3 h-3" /> Tải về
                            </span>
                            {item.time && (
                              <span className="absolute bottom-1 right-1 text-[9px] bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-md">
                                {item.time}
                              </span>
                            )}
                          </a>
                        ) : (
                          <div
                            key={item.id}
                            className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square cursor-pointer shadow-2xs hover:shadow-md transition"
                            onClick={() => {
                              setSelectedImageModal(item.url);
                            }}
                          >
                            <img
                              src={item.url}
                              alt="media"
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <ZoomIn className="w-5 h-5" />
                            </div>
                            {item.time && (
                              <span className="absolute bottom-1 right-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded-md">
                                {item.time}
                              </span>
                            )}
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                      <ImageIcon className="w-12 h-12 mb-2 stroke-1 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm">Chưa có ảnh hoặc file nào được chia sẻ trong đoạn chat này</p>
                    </div>
                  )
                ) : (
                  sharedLinks.length > 0 ? (
                    <div className="space-y-2">
                      {sharedLinks.map((linkItem) => (
                        <a
                          key={linkItem.id}
                          href={linkItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-blue-50/70 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 hover:border-blue-300 flex items-center justify-between gap-3 transition group cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                              <ExternalLink className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-blue-500" />
                              <span className="truncate">{linkItem.domain}</span>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate block mt-0.5">
                              {linkItem.url}
                            </span>
                          </div>
                          {linkItem.time && (
                            <span className="text-[11px] text-slate-400 shrink-0">
                              {linkItem.time}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                      <LinkIcon className="w-12 h-12 mb-2 stroke-1 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm">Chưa có liên kết nào được chia sẻ trong đoạn chat này</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Cuộc gọi thoại & Video Call WebRTC */}
        <VideoCallModal
          callStatus={callStatus}
          callType={callType}
          partnerUser={callPartnerUser}
          localStream={localStream}
          remoteStream={remoteStream}
          callDuration={callDuration}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          activeFilterId={activeCallFilterId}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
          onEndCall={handleEndCall}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onSelectFilter={handleSelectCallFilter}
        />

        {/* Modal Cuộc gọi Video Nhóm WebRTC (Group Video Call) */}
        <GroupVideoCallModal
          isOpen={groupCallModalOpen}
          groupName={groupCallGroupName}
          groupAvatar={groupCallGroupAvatar}
          currentUser={currentUser}
          localStream={groupLocalStream}
          participants={groupCallParticipants}
          remoteStreams={groupCallRemoteStreams}
          callDuration={groupCallDuration}
          isMuted={isGroupMuted}
          isVideoOff={isGroupVideoOff}
          isScreenSharing={isGroupScreenSharing}
          screenSharingUsers={groupScreenSharingUsers}
          activeFilterId={groupActiveFilterId}
          onLeaveCall={handleLeaveGroupCall}
          onToggleMic={handleToggleGroupMic}
          onToggleCamera={handleToggleGroupCamera}
          onToggleScreenShare={handleToggleGroupScreenShare}
          onSelectFilter={handleSelectGroupFilter}
        />

        {/* Thông báo cuộc gọi nhóm đến dạng Popup Toast */}
        {incomingGroupCall && !groupCallModalOpen && (
          <div className="fixed top-5 right-5 sm:top-6 sm:right-6 z-[9999] bg-slate-900/98 backdrop-blur-2xl text-white border-2 border-emerald-500/60 p-4 rounded-3xl shadow-2xl flex items-center gap-4 max-w-sm animate-fadeIn ring-4 ring-emerald-500/20">
            <img
              src={incomingGroupCall.caller_avatar || DEFAULT_AVATAR}
              alt={incomingGroupCall.caller_name}
              className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shadow-md shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Cuộc gọi video nhóm</span>
              </p>
              <h4 className="text-sm font-bold truncate text-white">{incomingGroupCall.caller_name} đang gọi...</h4>
              <p className="text-[11px] text-slate-400 truncate">
                {incomingGroupCall.participants_count || 1} người đang trong cuộc gọi
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIncomingGroupCall(null)}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition cursor-pointer"
                title="Bỏ qua"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const cId = incomingGroupCall.conversation_id;
                  setIncomingGroupCall(null);
                  joinGroupCall(cId);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/40 hover:scale-105 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Tham gia</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Xác nhận Thu hồi Tin nhắn chuyên nghiệp */}
        {recallingMessage && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn"
            onClick={() => !isRecalling && setRecallingMessage(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center relative animate-fadeIn scale-100 transition-all"
            >
              {/* Nút đóng góc trên */}
              <button
                type="button"
                disabled={isRecalling}
                onClick={() => setRecallingMessage(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icon & Tiêu đề */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100/80 dark:from-rose-950/40 dark:to-rose-900/30 border border-rose-200/80 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3.5 shadow-xs">
                <RotateCcw className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Thu hồi tin nhắn?
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                Tin nhắn này sẽ được gỡ bỏ đối với tất cả thành viên trong cuộc trò chuyện.
              </p>

              {/* Xem trước nội dung tin nhắn sẽ thu hồi */}
              <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Nội dung tin nhắn:
                </p>
                {recallingMessage.mediaType === 'call_log' ? (
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">{recallingMessage.text}</span>
                  </p>
                ) : recallingMessage.mediaType === 'file' ? (
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">{recallingMessage.text || recallingMessage.fileName || 'Tệp đính kèm'}</span>
                  </p>
                ) : recallingMessage.mediaUrl ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={recallingMessage.mediaUrl}
                      alt="Preview"
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-300 italic truncate">
                      {recallingMessage.text || '[Hình ảnh đính kèm]'}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 line-clamp-3 italic leading-relaxed">
                    "{recallingMessage.text}"
                  </p>
                )}
              </div>

              {/* Hành động */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isRecalling}
                  onClick={() => setRecallingMessage(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isRecalling}
                  onClick={handleConfirmRecall}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isRecalling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang thu hồi...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Thu hồi</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Tạo nhóm chat mới */}
        <CreateGroupModal
          isOpen={showCreateGroupModal}
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={(newGroup) => {
            loadServerConversations(false);
            if (newGroup?.id) {
              setSelectedConversationId(String(newGroup.id));
              setDraftConversation(null);
              setMobileShowChat(true);
            }
          }}
          currentUser={currentUser}
        />

      </div>
    </main>
  );
}

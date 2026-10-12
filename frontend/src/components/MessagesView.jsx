import { useState, useEffect, useRef } from 'react';
import { 
  Search, Send, Image as ImageIcon, Smile, MoreVertical, 
  Phone, Video, Check, CheckCheck, Clock, RotateCw, Loader2, MessageSquare, ArrowLeft,
  UserCheck, UserX, AlertCircle, ShieldAlert, Flag,
  Info, Maximize2, Minimize2, Paperclip, BellOff,
  User, FileText, ChevronRight, Ban
} from 'lucide-react';
import { messageService } from '../services/messageService';

export default function MessagesView({ currentUser, initialChatUserId, onOpenReportModal, onRequireAuth }) {
  if (!currentUser) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl m-4 border border-slate-200 shadow-xs">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Yêu cầu đăng nhập</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
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

  // Danh sách các cuộc trò chuyện thực tế từ CSDL
  const [conversations, setConversations] = useState([]);

  // Cuộc trò chuyện đang chọn
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  
  // Trạng thái mở rộng toàn màn hình & Panel chi tiết
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [isEdgeToEdge, setIsEdgeToEdge] = useState(false);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedConversationIdRef = useRef(selectedConversationId);
  selectedConversationIdRef.current = selectedConversationId;

  // Đếm số lượng tin nhắn chờ từ người lạ
  const pendingRequestsCount = conversations.filter(c => c.status === 'pending').length;

  // Lấy hội thoại hiện tại
  const currentConversation = conversations.find(c => String(c.id) === String(selectedConversationId));

  const prevMessagesLengthRef = useRef(activeMessages.length);

  // Tải danh sách cuộc trò chuyện từ Backend FastAPI (giữ nguyên messages của conversation đã nạp)
  const loadServerConversations = async (autoSelect = false) => {
    if (!currentUser) return;
    try {
      const data = await messageService.getConversations();
      if (data && Array.isArray(data)) {
        setConversations(prev => {
          return data.map(c => {
            const existing = prev.find(p => String(p.id) === String(c.id));
            return {
              id: String(c.id),
              status: c.status,
              user: {
                id: c.user.id,
                name: c.user.name,
                username: c.user.username,
                avatar: c.user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                isOnline: c.user.is_online,
                isFriend: c.user.is_friend,
                bio: c.user.bio,
                lastSeen: 'Vừa xong'
              },
              lastMessage: c.last_message || 'Bắt đầu cuộc trò chuyện',
              lastTime: c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong',
              unreadCount: c.unread_count || 0,
              messages: existing ? (existing.messages || []) : []
            };
          });
        });

        if (autoSelect && data.length > 0 && !selectedConversationIdRef.current) {
          const firstId = String(data[0].id);
          setSelectedConversationId(firstId);
        }
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.warn("Lỗi nạp danh sách cuộc trò chuyện:", err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadServerConversations(true);
    }
  }, [currentUser]);

  // Tải tin nhắn của cuộc trò chuyện đang chọn từ CSDL
  const loadMessages = async (convId) => {
    if (!convId || !currentUser) return;
    try {
      const msgs = await messageService.getMessages(convId);
      if (msgs && Array.isArray(msgs)) {
        const formattedMsgs = msgs.map(m => ({
          id: m.id,
          senderId: m.sender_id === currentUser.id ? 'current' : m.sender_id,
          text: m.content,
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
    if (selectedConversationId) {
      loadMessages(selectedConversationId);
    } else {
      setActiveMessages([]);
    }
  }, [selectedConversationId]);

  // Polling chu kỳ 3s để đồng bộ tin nhắn mới và trạng thái xem từ người khác
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      loadServerConversations(false);
      if (selectedConversationIdRef.current) {
        loadMessages(selectedConversationIdRef.current);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Tự động chọn cuộc trò chuyện khi nhận initialChatUserId (từ Trang cá nhân hoặc Bạn bè)
  useEffect(() => {
    if (!initialChatUserId) return;

    const existing = conversations.find(c => c.user?.id === initialChatUserId);
    if (existing) {
      setSelectedConversationId(existing.id);
      setMobileShowChat(true);
      return;
    }

    // Nếu chưa có trong danh sách hiển thị, gọi API tạo/lấy hội thoại
    if (currentUser) {
      messageService.getOrCreateConversation(initialChatUserId).then(res => {
        if (res && res.conversation_id) {
          loadServerConversations(false).then(() => {
            setSelectedConversationId(String(res.conversation_id));
            setMobileShowChat(true);
          });
        }
      }).catch(console.warn);
    }
  }, [initialChatUserId, currentUser]);

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

  // Xử lý gửi tin nhắn (Bằng nút Gửi hoặc phím Enter)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const content = inputText.trim();
    if (!content || !selectedConversationId) return; // Nút gửi bị vô hiệu hóa khi ô trống

    const timeNow = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const tempId = 'msg-' + Date.now();

    // 1. Trạng thái 1: Đang gửi (optimistic message)
    const optimisticMsg = {
      id: tempId,
      senderId: 'current',
      text: content,
      time: timeNow,
      status: 'sending'
    };

    setInputText('');
    setActiveMessages(prev => [...prev, optimisticMsg]);
    setConversations(prev => prev.map(c => {
      if (String(c.id) === String(selectedConversationId)) {
        return {
          ...c,
          lastMessage: content,
          lastTime: timeNow,
          messages: [...(c.messages || []), optimisticMsg]
        };
      }
      return c;
    }));

    // Gửi tin nhắn qua Backend
    const targetUserId = currentConversation?.user?.id;
    try {
      let serverMsg = null;
      if (currentUser && targetUserId) {
        serverMsg = await messageService.sendMessage(targetUserId, content);
      }

      // Trạng thái 2: Đã gửi (Server đã nhận và lưu thành công)
      setActiveMessages(prev => prev.map(m => m.id === tempId ? {
        ...m,
        id: serverMsg ? serverMsg.id : m.id,
        status: serverMsg?.status || 'sent'
      } : m));

      setConversations(prev => prev.map(c => {
        if (String(c.id) === String(selectedConversationId)) {
          return {
            ...c,
            messages: (c.messages || []).map(m => m.id === tempId ? {
              ...m,
              id: serverMsg ? serverMsg.id : m.id,
              status: serverMsg?.status || 'sent'
            } : m)
          };
        }
        return c;
      }));

      loadServerConversations(false);
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

    const targetUserId = currentConversation?.user?.id;
    try {
      let serverMsg = null;
      if (currentUser && targetUserId) {
        serverMsg = await messageService.sendMessage(targetUserId, failedMsg.text);
      }

      // Đã gửi
      setActiveMessages(prev => prev.map(m => m.id === failedMsg.id ? {
        ...m,
        id: serverMsg ? serverMsg.id : m.id,
        status: serverMsg?.status || 'sent'
      } : m));

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

      loadServerConversations(false);
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
    const matchTab = c.status === (inboxTab === 'main' ? 'accepted' : 'pending');
    const matchSearch = c.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.user.username.toLowerCase().includes(searchTerm.toLowerCase());
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
      <div className={`bg-white shadow-sm border border-slate-200/90 h-full w-full flex min-h-0 overflow-hidden ${
        isEdgeToEdge ? 'rounded-none border-x-0 border-b-0' : 'rounded-2xl sm:rounded-3xl'
      }`}>
        
        {/* ================= CỘT TRÁI: DANH SÁCH CUỘC TRÒ CHUYỆN ================= */}
        <aside 
          className={
            'w-full md:w-80 lg:w-[350px] xl:w-[390px] border-r border-slate-200 flex flex-col bg-white shrink-0 h-full overflow-hidden ' +
            (mobileShowChat ? 'hidden md:flex' : 'flex')
          }
        >
          {/* CỤM CỐ ĐỊNH ĐỨNG YÊN: HEADER + HỘP THƯ CHÍNH/CHỜ + Ô TÌM KIẾM */}
          <div className="shrink-0 bg-white z-10 border-b border-slate-100">
            {/* Header danh sách chat */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-xs">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 leading-tight">Đoạn chat</h2>
                  <p className="text-[11px] text-slate-400">Kết nối & trao đổi thời gian thực</p>
                </div>
              </div>

              {/* Nút toggle Tràn viền (Edge-to-Edge) */}
              <button
                onClick={() => setIsEdgeToEdge(!isEdgeToEdge)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
                title={isEdgeToEdge ? 'Thu về khung viền bo tròn' : 'Mở rộng tràn viền 100%'}
              >
                {isEdgeToEdge ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* 2 Tab: Hộp thư chính & Tin nhắn chờ (Người lạ) - ĐỂ YÊN CỐ ĐỊNH */}
            <div className="flex px-3 pt-2 pb-2 bg-slate-50/80 gap-1.5 border-b border-slate-100">
              <button
                onClick={() => setInboxTab('main')}
                className={
                  'flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ' +
                  (inboxTab === 'main'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60')
                }
              >
                <span>Hộp thư chính</span>
              </button>

              <button
                onClick={() => setInboxTab('requests')}
                className={
                  'flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 relative ' +
                  (inboxTab === 'requests'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60')
                }
              >
                <span>Tin nhắn chờ</span>
                {pendingRequestsCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black animate-pulse">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            </div>

            {/* Ô tìm kiếm - ĐỂ YÊN CỐ ĐỊNH */}
            <div className="p-3 bg-white">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={inboxTab === 'main' ? 'Tìm bạn bè hoặc tin nhắn...' : 'Tìm trong tin nhắn chờ...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 rounded-xl border border-transparent focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* VÙNG CUỘN ĐỘC LẬP: DANH SÁCH CÁC CUỘC TRÒ CHUYỆN */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-50 overscroll-contain">
            {displayedConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {inboxTab === 'main' ? (
                  <div className="py-6 flex flex-col items-center">
                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-3">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-700">Chưa có cuộc trò chuyện nào</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                      Vào trang cá nhân bạn bè hoặc mục Bạn bè để bấm "Nhắn tin" bắt đầu trò chuyện!
                    </p>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-3">
                      <CheckCheck className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-700">Không có tin nhắn chờ nào</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                      Khi người lạ gửi tin nhắn đến, yêu cầu sẽ xuất hiện tại đây.
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
                      (isSelected ? 'bg-blue-50/90 border-l-4 border-blue-600' : 'hover:bg-slate-50')
                    }
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <img
                        src={conv.user.avatar}
                        alt={conv.user.name}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 shadow-2xs"
                      />
                      {conv.user.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                      )}
                    </div>

                    {/* Tên & Tin nhắn cuối */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={'text-sm font-bold truncate ' + (isSelected ? 'text-blue-900' : 'text-slate-800')}>
                          {conv.user.name}
                        </h3>
                        <span className="text-[11px] text-slate-400 shrink-0 ml-1">
                          {conv.lastTime}
                        </span>
                      </div>
                      <p className={'text-xs truncate ' + (conv.unreadCount > 0 ? 'font-bold text-slate-800' : 'text-slate-500')}>
                        {conv.lastMessage}
                      </p>
                    </div>

                    {/* Huy hiệu chưa đọc */}
                    {conv.unreadCount > 0 && (
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
            'flex-1 min-w-0 min-h-0 h-full flex flex-col bg-slate-50/40 overflow-hidden ' +
            (!mobileShowChat ? 'hidden md:flex' : 'flex')
          }
        >
          {currentConversation ? (
            <>
              {/* Header khung chat - CỐ ĐỊNH Ở ĐỈNH */}
              <div className="shrink-0 p-3 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMobileShowChat(false)}
                    className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="relative">
                    <img
                      src={currentConversation.user.avatar}
                      alt={currentConversation.user.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shadow-2xs"
                    />
                    {currentConversation.user.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                        {currentConversation.user.name}
                      </h3>
                      {currentConversation.status === 'pending' && (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded text-[10px] font-bold">
                          Người lạ
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      {currentConversation.user.isOnline ? (
                        <span className="text-emerald-600 font-medium">Đang trực tuyến</span>
                      ) : (
                        <span>Hoạt động: {currentConversation.user.lastSeen}</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Actions ở Header Chat */}
                <div className="flex items-center gap-1 sm:gap-1.5 text-slate-500">
                  <button 
                    title="Gọi thoại thoại"
                    className="p-2 hover:bg-slate-100 hover:text-blue-600 rounded-xl transition cursor-pointer"
                  >
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button 
                    title="Gọi video"
                    className="p-2 hover:bg-slate-100 hover:text-blue-600 rounded-xl transition cursor-pointer"
                  >
                    <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* Nút Báo cáo cuộc trò chuyện */}
                  <button 
                    onClick={() => {
                      onOpenReportModal && onOpenReportModal({
                        targetType: 'message',
                        targetId: currentConversation.id,
                        targetAuthor: currentConversation.user,
                        contentExcerpt: currentConversation.lastMessage || ('Cuộc trò chuyện với ' + currentConversation.user.name)
                      });
                    }}
                    title="Báo cáo cuộc trò chuyện này vi phạm"
                    className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition cursor-pointer text-slate-400"
                  >
                    <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* Nút Toggle Panel Thông tin người dùng (Cột 3) */}
                  <button 
                    onClick={() => setShowInfoSidebar(!showInfoSidebar)}
                    title={showInfoSidebar ? 'Ẩn thông tin hội thoại' : 'Xem thông tin người dùng & file đã gửi'}
                    className={`p-2 rounded-xl transition cursor-pointer hidden lg:flex ${
                      showInfoSidebar 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* Nút Toggle Tràn viền */}
                  <button
                    onClick={() => setIsEdgeToEdge(!isEdgeToEdge)}
                    className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer hidden sm:flex"
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

              {/* BANNER XÁC NHẬN TIN NHẮN CHỜ TỪ NGƯỜI LẠ (NẾU CHƯA CHẤP NHẬN) */}
              {currentConversation.status === 'pending' && (
                <div className="shrink-0 p-4 bg-amber-50/90 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold">Yêu cầu trò chuyện từ người lạ</h4>
                      <p className="text-[11px] text-amber-700">
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
                      className="px-3 py-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" /> Từ chối
                    </button>
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
                  <div className="relative mb-0.5">
                    <img
                      src={currentConversation.user.avatar}
                      alt={currentConversation.user.name}
                      className="w-14 h-14 rounded-full object-cover ring-4 ring-slate-100 shadow-xs"
                    />
                    {currentConversation.user.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                    {currentConversation.user.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    {currentConversation.user.bio || 'Các bạn đã kết nối trò chuyện trên mạng xã hội NexusSocial'}
                  </p>
                  <div className="pt-0.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200/60">
                      Bắt đầu cuộc trò chuyện
                    </span>
                  </div>
                </div>

                {/* Nhóm danh sách các tin nhắn */}
                <div className="space-y-4 w-full">
                  {activeMessages.map((msg) => {
                    const isMe = msg.senderId === 'current';
                    const isLastRead = isMe && String(msg.id) === lastReadMessageId;
                    return (
                        <div
                          key={msg.id}
                          className={'flex items-end gap-2.5 ' + (isMe ? 'justify-end' : 'justify-start')}
                        >
                          {!isMe && (
                            <img
                              src={currentConversation.user.avatar}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover shrink-0 mb-1 ring-2 ring-slate-100"
                            />
                          )}

                          <div className={'max-w-[80%] sm:max-w-[70%] lg:max-w-[65%] group relative ' + (isMe ? 'items-end' : 'items-start')}>
                            <div
                              className={
                                'px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-2xs ' +
                                (isMe
                                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs'
                                  : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs')
                              }
                            >
                              {msg.text}
                            </div>
                            <div
                              className={
                                'flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 px-1 ' +
                                (isMe ? 'justify-end' : 'justify-start')
                              }
                            >
                              <span>{msg.time}</span>
                              {isMe ? (
                                <div className="flex items-center gap-1.5">
                                  {/* Trạng thái 1: Đang gửi */}
                                  {msg.status === 'sending' && (
                                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium animate-pulse" title="Đang gửi...">
                                      <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                      <span>Đang gửi...</span>
                                    </span>
                                  )}

                                  {/* Trạng thái 2: Đã gửi */}
                                  {msg.status === 'sent' && (
                                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium" title="Đã gửi">
                                      <Check className="w-3 h-3 text-slate-400" />
                                      <span>Đã gửi</span>
                                    </span>
                                  )}

                                  {/* Trạng thái 3: Đã nhận */}
                                  {msg.status === 'delivered' && (
                                    <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium" title="Đã nhận">
                                      <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Đã nhận</span>
                                    </span>
                                  )}

                                  {/* Trạng thái 4: Đã xem (Chỉ hiển thị avatar ở tin nhắn đã xem mới nhất) */}
                                  {(msg.status === 'read' || !msg.status) && isLastRead && (
                                    <div 
                                      className="flex items-center gap-1 text-[10px] text-blue-600 font-medium" 
                                      title={`Đã xem bởi ${currentConversation.user.name}`}
                                    >
                                      <span>Đã xem</span>
                                      <img
                                        src={currentConversation.user.avatar}
                                        alt={currentConversation.user.name}
                                        className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-blue-300 shadow-2xs"
                                      />
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
                            ) : (
                              <button
                                onClick={() => {
                                  onOpenReportModal && onOpenReportModal({
                                    targetType: 'message',
                                    targetId: msg.id,
                                    targetAuthor: currentConversation.user,
                                    contentExcerpt: msg.text
                                  });
                                }}
                                title="Báo cáo tin nhắn này"
                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition cursor-pointer p-0.5"
                              >
                                <Flag className="w-3 h-3" />
                              </button>
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
                        className="w-7 h-7 rounded-full object-cover ring-2 ring-slate-100"
                      />
                      <div className="bg-white border border-slate-200 px-3.5 py-1.5 rounded-full flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                      <span>{currentConversation.user.name} đang soạn tin...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Thanh nhập tin nhắn (Gửi bằng nút gửi hoặc Enter) */}
              <form 
                onSubmit={handleSendMessage}
                className="shrink-0 p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2"
              >
                <button
                  type="button"
                  title="Gửi ảnh"
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  title="Biểu tượng cảm xúc"
                  className="p-2 text-slate-400 hover:text-amber-500 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <Smile className="w-5 h-5" />
                </button>

                <input
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
                      if (inputText.trim()) {
                        handleSendMessage(e);
                      }
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-sm text-slate-800 placeholder-slate-400 rounded-full border border-transparent focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  title={inputText.trim() ? "Gửi tin nhắn (Enter)" : "Nhập nội dung để gửi"}
                  className={
                    'p-2.5 rounded-full text-white transition shadow-sm ' +
                    (inputText.trim()
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 scale-105 cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed opacity-60')
                  }
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4">
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
        {showInfoSidebar && currentConversation && (
          <aside className="hidden lg:flex w-72 xl:w-80 border-l border-slate-200 bg-white flex-col shrink-0 h-full min-h-0 overflow-y-auto animate-fadeIn">
            {/* Header Cột 3 */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Thông tin đoạn chat</h3>
              <button 
                onClick={() => setShowInfoSidebar(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Đóng panel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Thông tin đại diện */}
            <div className="p-6 flex flex-col items-center text-center border-b border-slate-100">
              <div className="relative mb-3">
                <img 
                  src={currentConversation.user.avatar} 
                  alt={currentConversation.user.name} 
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-slate-100 shadow-md"
                />
                {currentConversation.user.isOnline && (
                  <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                )}
              </div>
              <h4 className="text-base font-bold text-slate-900 leading-tight">
                {currentConversation.user.name}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                @{currentConversation.user.username}
              </p>
              <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                currentConversation.user.isOnline 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {currentConversation.user.isOnline ? 'Đang trực tuyến' : `Hoạt động: ${currentConversation.user.lastSeen}`}
              </span>

              {/* Phím tắt tác vụ nhanh */}
              <div className="grid grid-cols-3 gap-2 w-full mt-5">
                <button 
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                  title="Trang cá nhân"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-medium">Trang cá nhân</span>
                </button>

                <button 
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                  title="Tắt thông báo"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                    <BellOff className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-medium">Tắt báo</span>
                </button>

                <button 
                  onClick={() => {
                    onOpenReportModal && onOpenReportModal({
                      targetType: 'message',
                      targetId: currentConversation.id,
                      targetAuthor: currentConversation.user,
                      contentExcerpt: currentConversation.lastMessage || ('Đoạn chat với ' + currentConversation.user.name)
                    });
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                  title="Báo cáo vi phạm"
                >
                  <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-medium">Báo cáo</span>
                </button>
              </div>
            </div>

            {/* File & Phương tiện đã gửi */}
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                <span>File & Ảnh đã gửi</span>
                <span className="text-blue-600 cursor-pointer font-normal">Xem tất cả</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200" alt="media" className="w-full h-16 rounded-lg object-cover hover:opacity-90 transition cursor-pointer" />
                <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200" alt="media" className="w-full h-16 rounded-lg object-cover hover:opacity-90 transition cursor-pointer" />
                <img src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200" alt="media" className="w-full h-16 rounded-lg object-cover hover:opacity-90 transition cursor-pointer" />
              </div>
            </div>

            {/* Cài đặt riêng tư */}
            <div className="p-4 space-y-2">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition cursor-pointer"
              >
                <Flag className="w-4 h-4 text-rose-500" />
                <span>Báo cáo cuộc trò chuyện này</span>
              </button>

              <button 
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <Ban className="w-4 h-4 text-slate-400" />
                <span>Chặn tin nhắn & cuộc gọi</span>
              </button>
            </div>
          </aside>
        )}

      </div>
    </main>
  );
}

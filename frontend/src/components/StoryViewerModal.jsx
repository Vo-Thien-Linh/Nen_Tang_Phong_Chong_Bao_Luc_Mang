import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ChevronLeft, ChevronRight, Eye, EyeOff, Trash2, Heart, 
  ThumbsUp, Smile, AlertCircle, Play, Pause, Volume2, VolumeX, ShieldAlert,
  Send, Loader2, Clock, MoreHorizontal, Link, BellOff, AlertTriangle,
  Share2, Music, Search, Check, Copy, ExternalLink,
  MapPin, AtSign, MessageCircle
} from 'lucide-react';
import { viewStoryApi, reactToStoryApi, deleteStoryApi, fetchStoryViewersApi, interactStoryWidgetApi } from '../api/client';
import { messageService } from '../services/messageService';
import { friendService } from '../services/friendService';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { formatRelativeTime } from '../utils/timeAgo';

const REACTION_ICONS = [
  { type: 'like', label: 'Thích', emoji: '👍' },
  { type: 'love', label: 'Yêu thích', emoji: '❤️' },
  { type: 'haha', label: 'Haha', emoji: '😆' },
  { type: 'wow', label: 'Wow', emoji: '😮' },
  { type: 'sad', label: 'Buồn', emoji: '😢' },
  { type: 'angry', label: 'Phẫn nộ', emoji: '😡' },
];

function getViewerReactionsSummary(viewer) {
  let list = [];
  if (Array.isArray(viewer?.reactions) && viewer.reactions.length > 0) {
    list = viewer.reactions.map((r) => (typeof r === 'string' ? r : r.type)).filter(Boolean);
  } else if (viewer?.reaction_type) {
    list = [viewer.reaction_type];
  }
  if (list.length === 0) return [];

  // Nhóm theo loại cảm xúc và giữ nguyên thứ tự xuất hiện
  const map = new Map();
  for (const type of list) {
    map.set(type, (map.get(type) || 0) + 1);
  }

  return Array.from(map.entries()).map(([type, count]) => {
    const iconObj = REACTION_ICONS.find((r) => r.type === type);
    return {
      type,
      emoji: iconObj?.emoji || '❤️',
      label: iconObj?.label || type,
      count,
    };
  });
}

function StoryCountdownLive({ stk, expiresAt, createdAt }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, isExpired: false });

  useEffect(() => {
    // Tính mốc kết thúc: Ưu tiên targetDate, hoặc expiresAt, hoặc 24h từ lúc tạo
    let target = null;
    if (stk.targetDate) {
      target = new Date(stk.targetDate).getTime();
    } else if (expiresAt) {
      target = new Date(expiresAt).getTime();
    } else if (createdAt) {
      target = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
    } else {
      target = Date.now() + 3 * 3600 * 1000 + 12 * 60 * 1000 + 45 * 1000;
    }

    const calcTime = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds, isExpired: false });
    };

    calcTime();
    const timer = setInterval(calcTime, 1000);
    return () => clearInterval(timer);
  }, [stk.targetDate, expiresAt, createdAt]);

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="w-56 p-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-2xl border border-white/30 select-none text-center">
      <p className="font-extrabold text-[11px] tracking-wider uppercase mb-1 drop-shadow-sm truncate">
        {stk.title || 'SỰ KIỆN ĐẶC BIỆT'}
      </p>
      <div className="font-black text-xl tracking-widest bg-black/25 rounded-xl py-1.5 shadow-inner">
        {timeLeft.isExpired ? (
          <span className="text-xs font-bold tracking-normal">ĐÃ KẾT THÚC 🎉</span>
        ) : (
          `${pad(timeLeft.hours)} : ${pad(timeLeft.minutes)} : ${pad(timeLeft.seconds)}`
        )}
      </div>
    </div>
  );
}

export default function StoryViewerModal({ 
  currentUser, 
  tray, 
  isOpen, 
  onClose, 
  onStoryDeleted,
  onNextTray,
  onPrevTray,
  initialStoryId,
  initialStoryIndex,
  initialShowViewers = false,
  targetViewerId = null,
  onOpenReportModal,
  onStoryViewed,
  onViewPost,
  onOpenStoryViewer,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showStoryMenu, setShowStoryMenu] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewersList, setViewersList] = useState([]);
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);
  const [myReaction, setMyReaction] = useState(null);
  const [revealedStoryIds, setRevealedStoryIds] = useState({});

  // Tổng hợp tất cả cảm xúc của tin đang xem (Facebook Story summary)
  const totalReactionsBreakdown = useMemo(() => {
    const counts = {};
    for (const v of viewersList) {
      const summary = getViewerReactionsSummary(v);
      for (const item of summary) {
        counts[item.type] = (counts[item.type] || 0) + item.count;
      }
    }
    return Object.entries(counts).map(([type, total]) => {
      const iconObj = REACTION_ICONS.find((r) => r.type === type);
      return {
        type,
        emoji: iconObj?.emoji || '❤️',
        label: iconObj?.label || type,
        total,
      };
    });
  }, [viewersList]);

  // Hiệu ứng hạt Reaction bay lượn mượt mà (Facebook style)
  const [floatingParticles, setFloatingParticles] = useState([]);

  // Trạng thái trả lời tin bằng tin nhắn (Reply Story)
  const [replyMessage, setReplyMessage] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySuccessMsg, setReplySuccessMsg] = useState('');
  const [replyErrorMsg, setReplyErrorMsg] = useState('');

  // Giữ chuột / chạm màn hình để tạm dừng tin
  const [isHolding, setIsHolding] = useState(false);
  const pressStartTimeRef = useRef(0);

  // Quản lý Âm nhạc nền cho Story
  const storyAudioRef = useRef(null);

  // Quản lý Modal Chia sẻ tin đăng (Instagram Story Share)
  const [showShareStoryModal, setShowShareStoryModal] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [storySendingStatus, setStorySendingStatus] = useState({});
  const [storyShareMsg, setStoryShareMsg] = useState('');
  const [isCopiedStoryLink, setIsCopiedStoryLink] = useState(false);

  // Quản lý tương tác thực tế với các Widgets (Poll, Question, Slider)
  const [pollVotes, setPollVotes] = useState({});
  const [questionInputs, setQuestionInputs] = useState({});
  const [isSendingQuestion, setIsSendingQuestion] = useState({});
  const [questionSent, setQuestionSent] = useState({});
  const [sliderValues, setSliderValues] = useState({});

  const videoRef = useRef(null);
  const progressTimerRef = useRef(null);

  const stories = tray?.stories || [];
  const safeIndex = stories.length > 0 ? Math.min(currentIndex, stories.length - 1) : 0;
  const currentStory = stories[safeIndex] || null;
  const isAuthor = Boolean(
    (currentUser?.id && tray?.author?.id && String(tray.author.id) === String(currentUser.id)) ||
    (currentUser?.id && currentStory?.author_id && String(currentStory.author_id) === String(currentUser.id)) ||
    tray?.isSelf
  );

  const rawBgStyle = currentStory?.backgroundStyle || currentStory?.background_style;
  const bgStyle = useMemo(() => {
    if (typeof rawBgStyle === 'object' && rawBgStyle !== null) return rawBgStyle;
    if (typeof rawBgStyle === 'string') {
      try { return JSON.parse(rawBgStyle); } catch { return {}; }
    }
    return {};
  }, [rawBgStyle]);

  const isSharedPost = Boolean(bgStyle?.isSharedPost || bgStyle?.originalPostId);
  const storyType = currentStory?.storyType || currentStory?.story_type || (bgStyle?.originalImage ? 'image' : 'text');
  const mediaUrl = currentStory?.mediaUrl || currentStory?.media_url || bgStyle?.originalImage || null;
  const textContent = currentStory?.textContent || currentStory?.text_content || '';

  const storyMusic = useMemo(() => {
    return bgStyle?.music || currentStory?.backgroundStyle?.music || currentStory?.music || null;
  }, [bgStyle, currentStory]);

  // Kiểm tra mức độ kiểm duyệt của tin hiện tại (Áp dụng Phương án A: Bạo lực ẩn cứng, Toxic/NSFW che mờ)
  const isHardHidden = Boolean(
    currentStory && (
      currentStory.isHardHidden ||
      currentStory.aiStatus === 'hidden' ||
      currentStory.ai_status === 'hidden' ||
      currentStory.aiLabel === 'Violence' ||
      currentStory.ai_label === 'Violence' ||
      currentStory.aiLabel === 'Hate Speech' ||
      currentStory.ai_label === 'Hate Speech'
    )
  );

  const isToxic = Boolean(
    currentStory && (
      currentStory.isToxic ||
      currentStory.aiStatus === 'sensitive' ||
      currentStory.ai_status === 'sensitive' ||
      currentStory.aiLabel === 'Toxic' ||
      currentStory.ai_label === 'Toxic'
    )
  );

  const isNsfw = Boolean(
    currentStory && (
      currentStory.isNsfw ||
      currentStory.mediaModerationStatus === 'sensitive' ||
      currentStory.media_moderation_status === 'sensitive' ||
      currentStory.mediaModerationLabel === 'nsfw' ||
      currentStory.media_moderation_label === 'nsfw' ||
      (Number(currentStory.media_moderation_nsfw) >= 0.7)
    )
  );

  const isSensitiveStory = Boolean((isToxic || isNsfw) && !isHardHidden);
  const isStoryRevealed = Boolean(revealedStoryIds[currentStory?.id]);
  const isStoryCovered = Boolean(
    (isSensitiveStory && !isStoryRevealed) ||
    (isHardHidden && !isAuthor)
  );

  const badgeText = isToxic && isNsfw ? 'Toxic & NSFW' : isToxic ? 'Toxic' : 'NSFW';

  // Trạng thái tạm dừng hiệu lực: khi tạm dừng, giữ chuột, đang focus nhập tin nhắn, có nội dung tin nhắn, đang mở menu tùy chọn, modal chia sẻ, danh sách người xem hoặc khi gặp tin nhạy cảm đang bị che cảnh báo
  const isEffectivePaused = Boolean(
    isPaused || 
    isHolding || 
    isInputFocused || 
    replyMessage.trim().length > 0 || 
    showViewers ||
    showStoryMenu ||
    showShareStoryModal ||
    isStoryCovered
  );

  // Đồng bộ tạm dừng video khi tin bị tạm ngưng
  useEffect(() => {
    if (!videoRef.current) return;
    if (isEffectivePaused) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [isEffectivePaused]);

  // Quản lý phát nhạc nền Story
  useEffect(() => {
    if (!storyMusic?.audioUrl) {
      if (storyAudioRef.current) {
        storyAudioRef.current.pause();
        storyAudioRef.current = null;
      }
      return;
    }

    const audio = new Audio(storyMusic.audioUrl);
    audio.loop = true;
    audio.muted = isMuted;

    if (storyMusic.startTime && Number(storyMusic.startTime) > 0) {
      const startSec = Number(storyMusic.startTime);
      audio.addEventListener('loadedmetadata', () => {
        try {
          audio.currentTime = startSec;
        } catch (_) {}
      }, { once: true });
      try {
        audio.currentTime = startSec;
      } catch (_) {}
    }

    storyAudioRef.current = audio;

    if (!isEffectivePaused) {
      audio.play().catch(() => {});
    }

    return () => {
      audio.pause();
      storyAudioRef.current = null;
    };
  }, [currentStory?.id, storyMusic?.audioUrl, storyMusic?.startTime]);

  // Đồng bộ tạm dừng/phát nhạc theo trạng thái Story
  useEffect(() => {
    if (!storyAudioRef.current) return;
    if (isEffectivePaused) {
      storyAudioRef.current.pause();
    } else {
      storyAudioRef.current.play().catch(() => {});
    }
  }, [isEffectivePaused]);

  // Đồng bộ Mute/Unmute
  useEffect(() => {
    if (storyAudioRef.current) {
      storyAudioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Reset khi mở tray mới hoặc điều hướng từ thông báo mục tiêu / chuyển tray Next-Prev
  useEffect(() => {
    if (isOpen && stories.length > 0) {
      let startIndex = 0;
      if (initialStoryId) {
        const foundIdx = stories.findIndex((s) => String(s.id) === String(initialStoryId));
        if (foundIdx >= 0) startIndex = foundIdx;
      } else if (typeof initialStoryIndex === 'number' && initialStoryIndex >= 0 && initialStoryIndex < stories.length) {
        startIndex = initialStoryIndex;
      } else if (tray?.startAtEnd || typeof tray?.initialStoryIndex === 'number') {
        if (typeof tray.initialStoryIndex === 'number') {
          startIndex = Math.min(Math.max(0, tray.initialStoryIndex), stories.length - 1);
        } else if (tray.startAtEnd) {
          startIndex = Math.max(0, stories.length - 1);
        }
      } else {
        const firstUnviewedIndex = stories.findIndex((s) => !s.isViewed);
        if (firstUnviewedIndex >= 0) startIndex = firstUnviewedIndex;
      }

      setCurrentIndex(startIndex);
      setProgress(0);
      setReplyMessage('');
      setReplySuccessMsg('');
      setReplyErrorMsg('');

      // Tự động mở danh sách người xem tin nếu đến từ thông báo cảm xúc/lượt xem
      if (initialShowViewers) {
        setShowViewers(true);
        setIsPaused(true);
        setIsLoadingViewers(true);
        const targetStory = stories[startIndex] || currentStory;
        if (targetStory?.id) {
          fetchStoryViewersApi(targetStory.id, currentUser?.id)
            .then((res) => {
              const list = res?.data || (Array.isArray(res) ? res : []);
              setViewersList(Array.isArray(list) ? list : []);
            })
            .catch((err) => console.warn('Lỗi lấy viewers từ thông báo:', err.message))
            .finally(() => setIsLoadingViewers(false));
        }
      } else {
        setShowViewers(false);
      }
    }
  }, [isOpen, tray?.author?.id, tray?.navId, initialStoryId, initialStoryIndex, initialShowViewers, currentUser?.id]);

  // Khóa cuộn trang nền và hỗ trợ phím Escape / Mũi tên trái phải
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        // Không trigger phím chuyển tin nếu người dùng đang nhập tin nhắn
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          if (e.key === 'Escape') {
            document.activeElement.blur();
          }
          return;
        }

        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'ArrowRight') {
          handleNextStory();
        } else if (e.key === 'ArrowLeft') {
          handlePrevStory();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow || 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, currentIndex, stories.length]);

  // Ghi nhận lượt xem tin và thiết lập myReaction
  useEffect(() => {
    if (!currentStory) return;

    setMyReaction(currentStory.myReaction || null);
    setReplySuccessMsg('');
    setReplyErrorMsg('');
    setShowStoryMenu(false);

    // Ghi nhận lượt xem cho cả người xem lẫn tác giả (để tác giả cũng chuyển viền xám khi đã xem hết)
    if (currentUser?.id) {
      currentStory.isViewed = true;
      if (tray?.stories) {
        tray.stories.forEach(s => {
          if (String(s.id) === String(currentStory.id)) s.isViewed = true;
        });
        tray.hasUnviewedStories = tray.stories.some(s => !s.isViewed);
      }
      viewStoryApi(currentStory.id).catch((err) => console.warn('Lỗi viewStory:', err.message));
      onStoryViewed?.(currentStory.id, tray?.author?.id);
    }
  }, [currentStory?.id]);

  const handleOpenStoryShare = () => {
    setIsPaused(true);
    setShowStoryMenu(false);
    setShowShareStoryModal(true);
    if (friendsList.length === 0) {
      setIsLoadingFriends(true);
      friendService.getFriendsList()
        .then((data) => {
          if (Array.isArray(data)) setFriendsList(data);
          else if (data?.friends && Array.isArray(data.friends)) setFriendsList(data.friends);
        })
        .catch(() => {})
        .finally(() => setIsLoadingFriends(false));
    }
  };

  const buildStoryRefPayload = (kind, extra = {}) => {
    const safeMediaUrl =
      currentStory?.mediaUrl && !String(currentStory.mediaUrl).startsWith('data:')
        ? currentStory.mediaUrl
        : null;
    return {
      kind, // 'reply' | 'mention' | 'share' | 'qa'
      storyId: String(currentStory?.id || ''),
      authorId: String(tray?.author?.id || currentStory?.author_id || ''),
      authorName: tray?.author?.name || currentStory?.author_name || 'Người dùng',
      authorUsername: tray?.author?.username || currentStory?.author_username || '',
      storyType: currentStory?.storyType || currentStory?.story_type || 'image',
      mediaUrl: safeMediaUrl,
      textContent: (currentStory?.textContent || currentStory?.backgroundStyle?.overlayText || '').slice(0, 120) || null,
      bgStyle:
        (currentStory?.storyType || currentStory?.story_type) === 'text'
          ? {
              background: currentStory?.backgroundStyle?.background || null,
              color: currentStory?.backgroundStyle?.color || '#ffffff',
              fontFamily: currentStory?.backgroundStyle?.fontFamily || null,
            }
          : null,
      expiresAt: currentStory?.expiresAt || currentStory?.expires_at || null,
      createdAt: currentStory?.createdAt || currentStory?.created_at || null,
      ...extra,
    };
  };

  const handleSendStoryToFriend = async (friend) => {
    const friendId = friend.id;
    if (storySendingStatus[friendId] === 'sending' || storySendingStatus[friendId] === 'sent') return;

    setStorySendingStatus(prev => ({ ...prev, [friendId]: 'sending' }));
    try {
      const refPayload = buildStoryRefPayload('share');
      const caption = storyShareMsg.trim();
      const textMsg = caption
        ? `[STORY_REF:${JSON.stringify(refPayload)}]\n${caption}`
        : `[STORY_REF:${JSON.stringify(refPayload)}]`;

      await messageService.sendMessage(friendId, textMsg, null, 'text');
      setStorySendingStatus(prev => ({ ...prev, [friendId]: 'sent' }));
      setReplySuccessMsg(`Đã gửi tin tới ${friend.name || friend.username}!`);
      setTimeout(() => setReplySuccessMsg(''), 2500);
    } catch (err) {
      setStorySendingStatus(prev => ({ ...prev, [friendId]: 'error' }));
      setReplyErrorMsg('Gửi tin thất bại, vui lòng thử lại');
      setTimeout(() => setReplyErrorMsg(''), 2500);
    }
  };

  const handleShareStoryExternal = async () => {
    const storyUrl = `${window.location.origin}?story=${currentStory?.id}`;
    const authorName = tray?.author?.name || 'thành viên';
    if (navigator?.share) {
      try {
        await navigator.share({
          title: `Tin của ${authorName} trên WINGS`,
          text: `Xem tin của ${authorName} trên WINGS:`,
          url: storyUrl,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyStoryLink();
        }
      }
    } else {
      handleCopyStoryLink();
    }
  };

  const handleCopyStoryLink = () => {
    const url = `${window.location.origin}?story=${currentStory?.id}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => {
          setReplySuccessMsg('Đã sao chép liên kết tin!');
          setShowStoryMenu(false);
          setTimeout(() => setReplySuccessMsg(''), 2500);
        })
        .catch(() => {
          setReplySuccessMsg('Đã sao chép liên kết tin!');
          setShowStoryMenu(false);
          setTimeout(() => setReplySuccessMsg(''), 2500);
        });
    } else {
      setReplySuccessMsg('Đã sao chép liên kết tin!');
      setShowStoryMenu(false);
      setTimeout(() => setReplySuccessMsg(''), 2500);
    }
  };

  const handleMuteAuthorStories = () => {
    setReplySuccessMsg(`Đã tắt tin của ${tray?.author?.name || 'người này'}!`);
    setShowStoryMenu(false);
    setTimeout(() => setReplySuccessMsg(''), 2500);
  };

  const handleReportStory = () => {
    setShowStoryMenu(false);
    setIsPaused(true);
    if (onOpenReportModal && currentStory) {
      onOpenReportModal({
        targetType: 'story',
        type: 'story',
        targetId: currentStory.id,
        id: currentStory.id,
        targetAuthor: {
          id: tray?.author?.id,
          name: tray?.author?.name || 'Tác giả tin',
          username: tray?.author?.username || 'user',
        },
        targetExcerpt: currentStory.textContent || (currentStory.storyType === 'image' ? '[Hình ảnh Tin]' : '[Video Tin]'),
        contentExcerpt: currentStory.textContent || (currentStory.storyType === 'image' ? '[Hình ảnh Tin]' : '[Video Tin]'),
        imageUrl: currentStory.storyType === 'image' ? currentStory.mediaUrl : null,
        target: currentStory,
      });
    }
  };

  // Bộ đếm tiến trình (Progress bar theo music duration / video / static 5s)
  useEffect(() => {
    if (!isOpen || isEffectivePaused || !currentStory) return;

    const duration = storyMusic?.duration 
      ? Number(storyMusic.duration) * 1000 
      : (currentStory.storyType === 'video' ? 15000 : 5000);
    const interval = 50; // cập nhật mỗi 50ms
    const step = (interval / duration) * 100;

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNextStory();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(progressTimerRef.current);
  }, [isOpen, currentIndex, isEffectivePaused, currentStory?.id, storyMusic?.duration]);

  if (!isOpen || !currentStory) return null;

  const handleNextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else if (onNextTray) {
      onNextTray();
    } else {
      onClose();
    }
  };

  const handlePrevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    } else if (onPrevTray) {
      onPrevTray();
    }
  };

  // Bắt đầu giữ chuột / chạm màn hình để tạm dừng tin
  const handleHoldStart = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    pressStartTimeRef.current = Date.now();
    setIsHolding(true);
  };

  // Thả tay hoặc rời chuột
  const handleHoldEnd = () => {
    setIsHolding(false);
  };

  // Nhấn nhanh (<250ms) mép trái / mép phải để chuyển tin, hoặc nhả chuột sau khi giữ lâu
  const handleTapOrRelease = (direction, e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const duration = Date.now() - pressStartTimeRef.current;
    setIsHolding(false);

    // Nếu nhấp nhanh dưới 250ms -> chuyển tin (next hoặc prev)
    if (duration < 250) {
      if (direction === 'prev') {
        handlePrevStory();
      } else {
        handleNextStory();
      }
    }
    // Nếu giữ trên 250ms -> là hành vi giữ tạm dừng (hold to pause), chỉ tiếp tục chạy chứ không chuyển tin
  };

  // Kích hoạt hiệu ứng hạt Reaction bay bổng đa hướng (Facebook Floating Hearts)
  const handleReact = async (reactionType) => {
    setMyReaction(reactionType);

    const emoji = REACTION_ICONS.find((r) => r.type === reactionType)?.emoji || '❤️';
    const newParticles = Array.from({ length: 8 }).map((_, i) => ({
      id: `${Date.now()}-${i}-${Math.random()}`,
      emoji,
      left: 20 + Math.random() * 60, // Phân bổ ngang ngẫu nhiên 20% - 80%
      scale: 0.85 + Math.random() * 0.7, // Kích thước biến thiên
      delay: i * 65, // Hiệu ứng trễ từng đợt
      duration: 1300 + Math.random() * 400, // 1.3s - 1.7s
      rotate: -25 + Math.random() * 50, // Góc xoay nhẹ
      driftX: -45 + Math.random() * 90, // Lượn sóng nhẹ theo chiều ngang
    }));

    setFloatingParticles((prev) => [...prev, ...newParticles]);

    // Tự động dọn dẹp hạt sau khi bay xong
    setTimeout(() => {
      setFloatingParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 2400);

    try {
      await reactToStoryApi(currentStory.id, reactionType);
      if (currentUser?.id) {
        setViewersList((prev) => {
          return prev.map((v) => {
            if (String(v.viewer_id) === String(currentUser.id)) {
              const currentReactions = Array.isArray(v.reactions)
                ? [...v.reactions]
                : (v.reaction_type ? [{ type: v.reaction_type }] : []);
              currentReactions.push({ type: reactionType, created_at: new Date().toISOString() });
              return {
                ...v,
                reaction_type: reactionType,
                reactions: currentReactions,
              };
            }
            return v;
          });
        });
      }
    } catch (err) {
      console.warn('Lỗi thả reaction:', err.message);
    }
  };

  // Tương tác Thăm dò ý kiến (Poll voting) - Chuẩn nghiệp vụ Instagram/Facebook
  const handleVotePoll = async (stk, option) => {
    const stickerId = stk.id;
    const storyId = currentStory?.id;
    if (!storyId || !stickerId) return;

    if (!currentUser?.id) {
      setReplyErrorMsg('Vui lòng đăng nhập để bình chọn');
      setTimeout(() => setReplyErrorMsg(''), 2500);
      return;
    }

    // Lấy dữ liệu bình chọn hiện tại (ưu tiên dữ liệu từ server hoặc state/local)
    const localKey = `wings_poll_${storyId}_${stickerId}`;
    let savedLocal = null;
    try {
      savedLocal = JSON.parse(localStorage.getItem(localKey) || 'null');
    } catch {}

    const existing = pollVotes[stickerId] || savedLocal || stk.pollData || { countA: 0, countB: 0, voted: null };
    if (existing.voted) return; // Đã bình chọn rồi thì không bình chọn lại

    const isA = option === 'A';
    const updated = {
      voted: option,
      countA: (Number(existing.countA) || 0) + (isA ? 1 : 0),
      countB: (Number(existing.countB) || 0) + (isA ? 0 : 1),
    };

    // Cập nhật UI ngay lập tức (Optimistic UI)
    setPollVotes((prev) => ({ ...prev, [stickerId]: updated }));

    // Lưu bền vững vào localStorage
    try {
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch {}

    // Gửi lên backend lưu vào CSDL
    try {
      await interactStoryWidgetApi(storyId, {
        widgetType: 'poll',
        stickerId,
        option,
      });
    } catch (err) {
      console.warn('Lỗi lưu kết quả bình chọn poll:', err.message);
    }
  };

  // Tương tác Kéo thả thanh cảm xúc (Slider) khi người xem thả tay (onPointerUp / onTouchEnd)
  const handleSliderCommit = async (stk, value) => {
    const stickerId = stk.id;
    const storyId = currentStory?.id;
    if (!storyId || !stickerId) return;

    const numericVal = Math.min(100, Math.max(0, Number(value) || 0));
    setSliderValues((prev) => ({ ...prev, [stickerId]: numericVal }));

    const localKey = `wings_slider_${storyId}_${stickerId}`;
    try {
      localStorage.setItem(localKey, String(numericVal));
    } catch {}

    // Kích hoạt hiệu ứng hạt Emoji (lửa 🔥) bay ngập màn hình chuẩn Instagram
    const emoji = stk.emoji || '🔥';
    const newParticles = Array.from({ length: 12 }).map((_, i) => ({
      id: `slider-${Date.now()}-${i}-${Math.random()}`,
      emoji,
      left: 25 + Math.random() * 50,
      scale: 1.0 + Math.random() * 0.8,
      delay: i * 45,
      duration: 1300 + Math.random() * 400,
      rotate: -20 + Math.random() * 40,
      driftX: -45 + Math.random() * 90,
    }));
    setFloatingParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setFloatingParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 2200);

    // Gửi lên backend lưu vào CSDL
    if (currentUser?.id) {
      try {
        await interactStoryWidgetApi(storyId, {
          widgetType: 'slider',
          stickerId,
          value: numericVal,
        });
      } catch (err) {
        console.warn('Lỗi lưu điểm thanh trượt:', err.message);
      }
    }
  };

  // Tương tác Gửi câu trả lời cho Hộp câu hỏi (Question answering)
  const handleSendQuestion = async (stk) => {
    const text = questionInputs[stk.id]?.trim();
    const authorId = currentStory?.author_id || tray?.author?.id;
    const storyId = currentStory?.id;
    if (!text || !authorId || isSendingQuestion[stk.id]) return;

    if (!currentUser?.id) {
      setReplyErrorMsg('Vui lòng đăng nhập để gửi câu trả lời');
      setTimeout(() => setReplyErrorMsg(''), 3000);
      return;
    }

    setIsSendingQuestion((prev) => ({ ...prev, [stk.id]: true }));
    try {
      const qaRef = buildStoryRefPayload('qa', {
        question: stk.prompt || 'Hỏi tôi bất cứ điều gì',
      });
      const messageContent = `[STORY_REF:${JSON.stringify(qaRef)}]\n${text}`;
      await messageService.sendMessage(authorId, messageContent, null, 'text');

      // Gửi lên backend lưu câu trả lời
      await interactStoryWidgetApi(storyId, {
        widgetType: 'question',
        stickerId: stk.id,
        text,
      });

      // Lưu bền vững vào localStorage
      try {
        localStorage.setItem(`wings_qa_${storyId}_${stk.id}`, text);
      } catch {}

      setQuestionSent((prev) => ({ ...prev, [stk.id]: text }));
      setQuestionInputs((prev) => ({ ...prev, [stk.id]: '' }));
      setReplySuccessMsg('Đã gửi câu trả lời đến tác giả!');
      setTimeout(() => setReplySuccessMsg(''), 3000);
    } catch (err) {
      setReplyErrorMsg('Không thể gửi câu trả lời: ' + err.message);
      setTimeout(() => setReplyErrorMsg(''), 3000);
    } finally {
      setIsSendingQuestion((prev) => ({ ...prev, [stk.id]: false }));
      setIsPaused(false);
    }
  };

  // Tương tác Kéo thả thanh cảm xúc (Slider)
  const handleSliderChange = (stickerId, value) => {
    setSliderValues((prev) => ({ ...prev, [stickerId]: Number(value) }));
  };

  // Xử lý gửi tin nhắn trả lời tin (Reply to Story)
  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    if (!replyMessage.trim() || isSendingReply) return;

    if (!currentUser?.id) {
      setReplyErrorMsg('Vui lòng đăng nhập để trả lời tin');
      setTimeout(() => setReplyErrorMsg(''), 3000);
      return;
    }

    setIsSendingReply(true);
    setReplyErrorMsg('');

    try {
      const authorId = tray.author?.id || currentStory?.author_id;
      if (!authorId) throw new Error('Không tìm thấy thông tin tác giả tin');

      // Gửi phản hồi kèm metadata Mini Story chuẩn Instagram (không gửi mediaUrl thô làm vỡ bong bóng chat)
      const replyRef = buildStoryRefPayload('reply');
      const formattedContent = `[STORY_REF:${JSON.stringify(replyRef)}]\n${replyMessage.trim()}`;

      await messageService.sendMessage(
        authorId,
        formattedContent,
        null,
        'text'
      );

      setReplyMessage('');
      setIsInputFocused(false);
      setReplySuccessMsg(`Đã gửi tin nhắn đến ${tray.author?.name || 'tác giả'}`);
      setTimeout(() => setReplySuccessMsg(''), 3000);
    } catch (err) {
      setReplyErrorMsg(err.message || 'Không thể gửi tin nhắn trả lời');
      setTimeout(() => setReplyErrorMsg(''), 3000);
    } finally {
      setIsSendingReply(false);
      setIsInputFocused(false);
      setIsPaused(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tin này không?')) return;
    try {
      await deleteStoryApi(currentStory.id);
      if (onStoryDeleted) onStoryDeleted(currentStory.id);
      if (stories.length <= 1) {
        onClose();
      } else {
        handleNextStory();
      }
    } catch (err) {
      alert('Lỗi khi xóa tin: ' + err.message);
    }
  };

  const handleOpenViewers = async () => {
    setIsPaused(true);
    setShowViewers(true);
    setIsLoadingViewers(true);
    try {
      const res = await fetchStoryViewersApi(currentStory.id, currentUser?.id);
      const list = res?.data || (Array.isArray(res) ? res : []);
      setViewersList(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Lỗi lấy viewers:', err.message);
    } finally {
      setIsLoadingViewers(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 select-none animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Định nghĩa CSS Keyframes cho hiệu ứng hạt Reaction bay bổng */}
      <style>{`
        @keyframes storyParticleFloat {
          0% {
            transform: translate3d(0, 0, 0) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translate3d(calc(var(--drift-x) * 0.25), -60px, 0) scale(1.15);
          }
          75% {
            opacity: 0.95;
          }
          100% {
            transform: translate3d(var(--drift-x), -400px, 0) scale(1.45);
            opacity: 0;
          }
        }
      `}</style>

      {/* Nút Đóng */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition cursor-pointer"
        aria-label="Đóng tin"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Nút Điều hướng Trái / Phải */}
      <button 
        onClick={handlePrevStory}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-white/10 hover:bg-white/30 text-white backdrop-blur-md transition hidden sm:flex cursor-pointer"
        aria-label="Tin trước"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button 
        onClick={handleNextStory}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-white/10 hover:bg-white/30 text-white backdrop-blur-md transition hidden sm:flex cursor-pointer"
        aria-label="Tin kế tiếp"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Khung nội dung Tin (Tỉ lệ 9:16 dọc chuẩn Story) */}
      <div 
        className="relative w-full max-w-[420px] h-[85vh] sm:h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between select-none"
      >
        {/* 1. Các vạch tiến trình (Progress Bars) trên đầu */}
        <div className="absolute top-3 inset-x-3 z-30 flex gap-1.5">
          {stories.map((s, idx) => {
            let width = '0%';
            if (idx < currentIndex) width = '100%';
            else if (idx === currentIndex) width = `${progress}%`;

            return (
              <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
                <div 
                  className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                  style={{ width }}
                />
              </div>
            );
          })}
        </div>

        {/* 2. Header thông tin tác giả */}
        <div className="absolute top-6 inset-x-4 z-30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={tray.author?.avatar || DEFAULT_AVATAR} 
              alt={tray.author?.name}
              className="w-10 h-10 rounded-full border-2 border-white object-cover"
            />
            <div>
              <h4 className="text-white font-bold text-sm leading-tight flex items-center gap-1.5">
                <span>{tray.author?.name}</span>
                {tray.author?.isVerified && (
                  <span className="text-blue-400 text-xs">✓</span>
                )}
                {currentStory.backgroundStyle?.isAiGenerated && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/80 backdrop-blur-md text-white border border-blue-400/40">
                    Nhãn AI
                  </span>
                )}
                {isSensitiveStory && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/30 backdrop-blur-md text-amber-200 border border-amber-400/50 flex items-center gap-1 shadow-xs">
                    <ShieldAlert className="w-3 h-3 text-amber-400" />
                    {badgeText}
                  </span>
                )}
                {isHardHidden && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/30 backdrop-blur-md text-rose-200 border border-rose-400/50 flex items-center gap-1 shadow-xs">
                    <ShieldAlert className="w-3 h-3 text-rose-400" />
                    {currentStory.aiLabel === 'Violence' ? 'Bạo lực' : 'Thù ghét'} (Bị ẩn)
                  </span>
                )}
              </h4>
              <div className="flex items-center gap-1.5 flex-wrap text-white/70 text-xs">
                <span>
                  {(() => {
                    try {
                      const raw = currentStory.createdAt || currentStory.created_at || currentStory.createdAtIso;
                      return raw ? formatRelativeTime(raw) : 'Vừa xong';
                    } catch {
                      return 'Vừa xong';
                    }
                  })()}
                </span>
                {Boolean(
                  currentStory.isExpired ||
                  (currentStory.expiresAt && new Date(currentStory.expiresAt) <= new Date()) ||
                  (currentStory.expires_at && new Date(currentStory.expires_at) <= new Date())
                ) && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-white/90 border border-white/20">
                    Đã hết hạn • Kho lưu trữ
                  </span>
                )}
              </div>

              {/* Nhãn âm nhạc đang phát chuẩn Facebook/Instagram */}
              {storyMusic && storyMusic.showSticker !== false && storyMusic.displayMode !== 'hidden' && (
                <div className="flex items-center gap-1.5 text-white/95 text-[11px] font-medium bg-black/40 backdrop-blur-md px-2.5 py-0.5 rounded-full mt-1 w-fit max-w-[210px] border border-white/10 shadow-xs">
                  <Music className="w-3 h-3 text-purple-400 shrink-0" />
                  <span className="truncate">{storyMusic.title} • {storyMusic.artist}</span>
                  {!isMuted && !isEffectivePaused && (
                    <div className="flex items-end gap-0.5 h-2 shrink-0">
                      <span className="w-0.5 h-full bg-purple-400 rounded-full animate-pulse" />
                      <span className="w-0.5 h-1.5 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <span className="w-0.5 h-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cụm công cụ góc phải trên (Play/Pause, Âm thanh, Menu 3 chấm ... chuẩn Facebook Story) */}
          <div className="flex items-center gap-1.5 z-40 relative">
            {/* Nút Bật/Tắt âm thanh (khi là Video hoặc Story có Âm nhạc) */}
            {(currentStory.storyType === 'video' || storyMusic) && (
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition cursor-pointer"
                title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}

            {/* Nút Tạm dừng / Phát */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition cursor-pointer"
              title={isPaused ? 'Phát tiếp' : 'Tạm dừng'}
            >
              {isPaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4 fill-white" />}
            </button>

            {/* Nút Ba Chấm (...) Menu tùy chọn giống Facebook Story */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStoryMenu(!showStoryMenu);
                }}
                className={`p-1.5 rounded-full transition cursor-pointer ${
                  showStoryMenu 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm'
                }`}
                title="Tùy chọn khác"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {/* Popover Menu chuẩn Facebook Story */}
              {showStoryMenu && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-10 w-72 sm:w-80 p-2 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/15 text-white z-50 animate-scale-up space-y-1 select-none"
                >
                  {/* Mục 1: Chia sẻ tin đăng (Instagram Story Share) */}
                  <button
                    onClick={handleOpenStoryShare}
                    className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/10 transition text-left cursor-pointer group"
                  >
                    <div className="p-2 rounded-full bg-white/10 group-hover:bg-blue-600/30 text-white transition shrink-0 mt-0.5">
                      <Share2 className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white group-hover:text-blue-300 transition">
                        Chia sẻ tin đăng
                      </p>
                      <p className="text-[10px] text-white/60 leading-tight mt-0.5">
                        Gửi tin này cho bạn bè qua tin nhắn hoặc chia sẻ ra ngoài
                      </p>
                    </div>
                  </button>

                  {/* Mục 2: Tắt tin của tác giả */}
                  {!isAuthor && (
                    <button
                      onClick={handleMuteAuthorStories}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 transition text-left cursor-pointer group"
                    >
                      <div className="p-2 rounded-full bg-white/10 group-hover:bg-amber-600/30 text-white transition shrink-0">
                        <BellOff className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white group-hover:text-amber-300 transition">
                          Tắt tin của {tray.author?.name}
                        </p>
                        <p className="text-[10px] text-white/60 leading-tight">
                          Không hiển thị tin từ người này trên đầu bảng tin
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Mục 3: Báo cáo tin (Đồng bộ với ReportModal) */}
                  {!isAuthor && (
                    <button
                      onClick={handleReportStory}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-500/20 transition text-left cursor-pointer group"
                    >
                      <div className="p-2 rounded-full bg-rose-500/20 text-rose-400 group-hover:bg-rose-500/30 transition shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-rose-300 group-hover:text-rose-200 transition">
                          Báo cáo tin
                        </p>
                        <p className="text-[10px] text-white/60 leading-tight">
                          Tôi lo ngại về tin này (bạo lực, nhạy cảm, độc hại...)
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Mục 4: Xóa tin (Chỉ dành cho tác giả) */}
                  {isAuthor && (
                    <button
                      onClick={() => {
                        setShowStoryMenu(false);
                        handleDelete();
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-500/20 transition text-left cursor-pointer group text-rose-400"
                    >
                      <div className="p-2 rounded-full bg-rose-500/20 group-hover:bg-rose-500/30 transition shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold group-hover:text-rose-300 transition">
                          Xóa tin này
                        </p>
                        <p className="text-[10px] text-white/60 leading-tight">
                          Gỡ tin vĩnh viễn khỏi trang cá nhân
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Banner cảnh báo đang hiển thị nội dung nhạy cảm (khi người xem đã bấm 'Xem toàn bộ tin' - chuẩn như Bài viết) */}
        {isSensitiveStory && isStoryRevealed && (
          <div className="absolute top-20 inset-x-4 z-40 px-3 py-1.5 rounded-xl bg-amber-500/25 border border-amber-400/50 backdrop-blur-md flex items-center justify-between text-xs text-amber-200 shadow-md animate-fade-in">
            <div className="flex items-center gap-1.5 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Đang hiển thị nội dung nhạy cảm ({badgeText})</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRevealedStoryIds((prev) => ({ ...prev, [currentStory.id]: false }));
              }}
              className="text-amber-300 hover:text-white hover:underline font-bold text-[11px] cursor-pointer flex items-center gap-1 pl-2"
            >
              <EyeOff className="w-3 h-3" />
              <span>Ẩn lại</span>
            </button>
          </div>
        )}

        {/* Banner dành cho chính tác giả khi xem tin bị ẩn cứng */}
        {isHardHidden && isAuthor && (
          <div className="absolute top-20 inset-x-4 z-40 px-3 py-1.5 rounded-xl bg-rose-500/25 border border-rose-400/50 backdrop-blur-md flex items-center gap-1.5 text-xs text-rose-200 shadow-md animate-fade-in font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Tin của bạn đã bị ẩn: vi phạm tiêu chuẩn ({currentStory.aiLabel || currentStory.ai_label || 'Bạo lực / Thù ghét'})</span>
          </div>
        )}

        {/* 3. Vùng hiển thị Nội dung Media hoặc Text */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <div className={`w-full h-full relative flex items-center justify-center transition-all duration-300 ${isStoryCovered ? 'blur-2xl scale-110 pointer-events-none' : ''}`}>
          {/* 3.1. TRÍCH DẪN BÀI VIẾT CHUẨN INSTAGRAM STORY (Ảnh 2) */}
          {isSharedPost ? (
            <div 
              className="w-full h-full relative flex flex-col items-center justify-center p-4 overflow-hidden"
              style={
                bgStyle.background 
                  ? (typeof bgStyle.background === 'object' ? bgStyle.background : { background: bgStyle.background }) 
                  : { background: 'linear-gradient(135deg, #2b3a4a 0%, #151e28 100%)' }
              }
            >
              {/* Lớp nền mờ Ambient từ ảnh bài viết */}
              {(mediaUrl || bgStyle.originalImage) && (
                <div 
                  className="absolute inset-0 bg-cover bg-center blur-3xl opacity-45 scale-125 pointer-events-none"
                  style={{ backgroundImage: `url(${mediaUrl || bgStyle.originalImage})` }}
                />
              )}

              {/* Thẻ bài viết Instagram nổi giữa màn hình */}
              <div 
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (bgStyle.originalPostId && onViewPost) {
                    onClose();
                    onViewPost(bgStyle.originalPostId);
                  } else if (bgStyle.originalStoryId && onOpenStoryViewer) {
                    onClose();
                    onOpenStoryViewer({ storyId: bgStyle.originalStoryId });
                  }
                }}
                className="relative z-30 w-full max-w-[340px] rounded-3xl overflow-hidden shadow-2xl border border-white/25 bg-black/40 backdrop-blur-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer group/reshare pointer-events-auto"
                title="Nhấn để xem bài viết hoặc tin gốc"
              >
                {/* Header tác giả bài viết: Avatar tròn + username nhỏ phía trên góc ảnh (Ảnh 2) */}
                <div className="px-3.5 py-2.5 flex items-center justify-between bg-black/35 backdrop-blur-md border-b border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <img 
                      src={bgStyle.originalAvatar || DEFAULT_AVATAR} 
                      alt={bgStyle.originalAuthor || 'Author'}
                      className="w-6 h-6 rounded-full object-cover border border-white/60 shadow-xs shrink-0" 
                    />
                    <span className="text-xs font-bold text-white tracking-wide truncate drop-shadow-sm">
                      {bgStyle.originalUsername || bgStyle.originalAuthor || 'Người dùng'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (bgStyle.originalPostId && onViewPost) {
                        onClose();
                        onViewPost(bgStyle.originalPostId);
                      } else if (bgStyle.originalStoryId && onOpenStoryViewer) {
                        onClose();
                        onOpenStoryViewer({ storyId: bgStyle.originalStoryId });
                      }
                    }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-white/90 bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm hover:bg-white/30 transition shrink-0 cursor-pointer pointer-events-auto"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Xem bài viết</span>
                  </button>
                </div>

                {/* Nội dung bài viết: Ảnh hoặc Trích dẫn text */}
                {(mediaUrl || bgStyle.originalImage) ? (
                  <div className="w-full relative bg-black/50 overflow-hidden flex items-center justify-center max-h-[380px]">
                    <img 
                      src={mediaUrl || bgStyle.originalImage} 
                      alt="Shared post" 
                      className="w-full h-full object-cover max-h-[380px]"
                    />
                    {bgStyle.originalContent && (
                      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white text-xs line-clamp-2 drop-shadow-md">
                        <span className="font-bold mr-1">{bgStyle.originalAuthor}:</span>
                        <span>{bgStyle.originalContent}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5 text-white space-y-2 bg-gradient-to-br from-white/10 to-transparent min-h-[160px] flex flex-col justify-center">
                    <p className="text-sm sm:text-base font-medium leading-relaxed italic line-clamp-6 text-white/95">
                      "{bgStyle.originalContent || textContent}"
                    </p>
                  </div>
                )}

                {/* Dải chân thẻ bài viết */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (bgStyle.originalPostId && onViewPost) {
                      onClose();
                      onViewPost(bgStyle.originalPostId);
                    } else if (bgStyle.originalStoryId && onOpenStoryViewer) {
                      onClose();
                      onOpenStoryViewer({ storyId: bgStyle.originalStoryId });
                    }
                  }}
                  className="px-3.5 py-2 bg-black/45 backdrop-blur-md flex items-center justify-between text-white/90 border-t border-white/10 hover:bg-black/60 transition cursor-pointer pointer-events-auto"
                >
                  <span className="text-[11px] text-white/70">Nhấn để mở bài viết gốc</span>
                  <ChevronRight className="w-4 h-4 text-white/70 group-hover/reshare:translate-x-1 transition" />
                </div>
              </div>

              {/* Lời nhắn / Ghi chú thêm của người chia sẻ nếu có */}
              {textContent && !textContent.includes('[Trích dẫn từ bài viết') && (
                <div className="relative z-10 mt-3.5 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold shadow-lg border border-white/20 max-w-[85%] text-center truncate">
                  💬 {textContent}
                </div>
              )}
            </div>
          ) : (
            <>
          {/* Tin văn bản */}
          {currentStory.storyType === 'text' && (
            <div 
              className="w-full h-full relative flex items-center justify-center overflow-hidden"
              style={currentStory.backgroundStyle || { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              <div 
                className="absolute p-6 text-center max-w-[90%]"
                style={{
                  left: `${currentStory.backgroundStyle?.textPos?.x ?? 50}%`,
                  top: `${currentStory.backgroundStyle?.textPos?.y ?? 50}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <p 
                  className="text-white font-bold text-2xl md:text-3xl break-words max-w-full drop-shadow-md leading-relaxed"
                  style={{ 
                    fontFamily: currentStory.backgroundStyle?.fontFamily || 'sans-serif',
                    textAlign: currentStory.backgroundStyle?.textAlign || 'center',
                    fontSize: currentStory.backgroundStyle?.textScale ? `${Math.round(28 * currentStory.backgroundStyle.textScale)}px` : undefined,
                  }}
                >
                  {currentStory.textContent}
                </p>
              </div>
            </div>
          )}

          {/* Tin Hình ảnh */}
          {currentStory.storyType === 'image' && (
            <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
              {/* Lớp nền mờ Ambient nhân bản từ ảnh để không bị khoảng trống đen */}
              <div 
                className="absolute inset-0 bg-cover bg-center blur-2xl opacity-60 scale-125 pointer-events-none transition-all duration-300"
                style={{ backgroundImage: `url(${currentStory.mediaUrl})` }}
              />

              <img 
                src={currentStory.mediaUrl} 
                alt="Story"
                className={`relative z-10 w-full h-full transition-all duration-200 ${
                  currentStory.backgroundStyle?.fitMode === 'cover' ? 'object-cover' : 'object-contain'
                } ${isStoryCovered ? 'blur-xl' : ''}`}
                style={currentStory.backgroundStyle?.filter && currentStory.backgroundStyle.filter !== 'none' ? { filter: currentStory.backgroundStyle.filter } : undefined}
              />
              {/* Nhãn thời gian cho video */}
              {currentStory.backgroundStyle?.hasTimeSticker && currentStory.backgroundStyle?.timeText && (
                <div 
                  className="absolute z-20 px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-white font-bold text-xs tracking-wider border border-white/20 shadow-lg flex items-center gap-1.5 pointer-events-none"
                  style={{
                    left: `${currentStory.backgroundStyle?.timePos?.x ?? 50}%`,
                    top: `${currentStory.backgroundStyle?.timePos?.y ?? 16}%`,
                    transform: `translate(-50%, -50%) scale(${currentStory.backgroundStyle?.timeScale || 1})`,
                  }}
                >
                  <Clock className="w-3.5 h-3.5 text-blue-300" />
                  <span>{currentStory.backgroundStyle.timeText}</span>
                </div>
              )}

              {/* Văn bản overlay cho video */}
              {currentStory.backgroundStyle?.overlayText && (
                <div 
                  className="absolute z-20 text-center pointer-events-none drop-shadow-xl max-w-[88%]"
                  style={{
                    left: `${currentStory.backgroundStyle?.textPos?.x ?? 50}%`,
                    top: `${currentStory.backgroundStyle?.textPos?.y ?? 50}%`,
                    transform: 'translate(-50%, -50%)',
                    fontFamily: currentStory.backgroundStyle?.overlayFont || 'sans-serif',
                    color: currentStory.backgroundStyle?.overlayColor || '#ffffff',
                  }}
                >
                  <p 
                    className="font-bold text-xl sm:text-2xl break-words leading-snug drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]"
                    style={{
                      fontSize: currentStory.backgroundStyle?.textScale ? `${Math.round(24 * currentStory.backgroundStyle.textScale)}px` : undefined,
                    }}
                  >
                    {currentStory.backgroundStyle.overlayText}
                  </p>
                </div>
              )}

              {currentStory.textContent && !currentStory.backgroundStyle?.overlayText && (
                <div className="absolute bottom-24 inset-x-4 z-20 p-3 rounded-xl bg-black/60 backdrop-blur-md text-white text-center text-sm shadow-lg">
                  {currentStory.textContent}
                </div>
              )}
            </div>
          )}

          {/* Tin Video */}
          {currentStory.storyType === 'video' && (
            <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
              {/* Lớp nền mờ Ambient cho video khi ở chế độ vừa vặn */}
              {currentStory.backgroundStyle?.fitMode === 'contain' && (
                <div 
                  className="absolute inset-0 bg-cover bg-center blur-2xl opacity-50 scale-125 pointer-events-none"
                  style={{ backgroundImage: `url(${currentStory.mediaUrl})` }}
                />
              )}
              <video 
                ref={videoRef}
                src={currentStory.mediaUrl}
                autoPlay
                playsInline
                loop
                muted={isMuted || currentStory.backgroundStyle?.isMuted || false}
                className={`relative z-10 w-full h-full transition-all duration-200 ${
                  currentStory.backgroundStyle?.fitMode === 'cover' ? 'object-cover' : 'object-contain'
                }`}
                style={currentStory.backgroundStyle?.filter && currentStory.backgroundStyle.filter !== 'none' ? { filter: currentStory.backgroundStyle.filter } : undefined}
              />
              {/* Nhãn thời gian cho video */}
              {currentStory.backgroundStyle?.hasTimeSticker && currentStory.backgroundStyle?.timeText && (
                <div 
                  className="absolute z-20 px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-white font-bold text-xs tracking-wider border border-white/20 shadow-lg flex items-center gap-1.5 pointer-events-none"
                  style={{
                    left: `${currentStory.backgroundStyle?.timePos?.x ?? 50}%`,
                    top: `${currentStory.backgroundStyle?.timePos?.y ?? 16}%`,
                    transform: `translate(-50%, -50%) scale(${currentStory.backgroundStyle?.timeScale || 1})`,
                  }}
                >
                  <Clock className="w-3.5 h-3.5 text-blue-300" />
                  <span>{currentStory.backgroundStyle.timeText}</span>
                </div>
              )}

              {/* Văn bản overlay cho video */}
              {currentStory.backgroundStyle?.overlayText && (
                <div 
                  className="absolute z-20 text-center pointer-events-none drop-shadow-xl max-w-[88%]"
                  style={{
                    left: `${currentStory.backgroundStyle?.textPos?.x ?? 50}%`,
                    top: `${currentStory.backgroundStyle?.textPos?.y ?? 50}%`,
                    transform: 'translate(-50%, -50%)',
                    fontFamily: currentStory.backgroundStyle?.overlayFont || 'sans-serif',
                    color: currentStory.backgroundStyle?.overlayColor || '#ffffff',
                  }}
                >
                  <p 
                    className="font-bold text-xl sm:text-2xl break-words leading-snug drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]"
                    style={{
                      fontSize: currentStory.backgroundStyle?.textScale ? `${Math.round(24 * currentStory.backgroundStyle.textScale)}px` : undefined,
                    }}
                  >
                    {currentStory.backgroundStyle.overlayText}
                  </p>
                </div>
              )}

              {currentStory.textContent && !currentStory.backgroundStyle?.overlayText && (
                <div className="absolute bottom-24 inset-x-4 z-20 p-3 rounded-xl bg-black/60 backdrop-blur-md text-white text-center text-sm shadow-lg">
                  {currentStory.textContent}
                </div>
              )}
            </div>
          )}
            </>
          )}

          {/* LỚP STICKERS & NHÃN DÁN NGHỆ THUẬT (POINTER-EVENTS-NONE CHO KHUNG NGOÀI, POINTER-EVENTS-AUTO CHO WIDGET) */}
          {((bgStyle?.stickers) || (currentStory.backgroundStyle?.stickers)) && (
            <div className="absolute inset-0 pointer-events-none z-25 overflow-hidden">
              {(bgStyle?.stickers || currentStory.backgroundStyle?.stickers).map((stk) => (
                <div
                  key={stk.id || `${stk.type}-${stk.x}-${stk.y}`}
                  style={{
                    left: `${stk.x}%`,
                    top: `${stk.y}%`,
                    transform: `translate(-50%, -50%) scale(${stk.scale || 1})`,
                  }}
                  className={`absolute select-none transition-transform ${stk.type === 'widget' ? 'pointer-events-auto z-30' : 'pointer-events-none'}`}
                >
                  {/* 1. Emoji native */}
                  {stk.type === 'emoji' && (
                    <span className="text-5xl select-none filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)] leading-none inline-block">
                      {stk.content}
                    </span>
                  )}

                  {/* 2. Tiện ích tương tác (Interactive Widgets) */}
                  {stk.type === 'widget' && (
                    <>
                      {/* Vị trí (Location) - Click mở Google Maps */}
                      {stk.widgetType === 'location' && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            const query = stk.text || 'Việt Nam';
                            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-white/95 dark:bg-black/85 backdrop-blur-md shadow-2xl text-slate-900 dark:text-white font-extrabold text-xs tracking-wide border border-black/10 dark:border-white/20 select-none cursor-pointer hover:scale-105 active:scale-95 transition-all group/loc"
                          title="Nhấn để xem địa điểm trên Google Maps"
                        >
                          <MapPin className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0 group-hover/loc:animate-bounce" />
                          <span className="truncate max-w-[180px]">{stk.text}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover/loc:text-rose-500 transition-colors shrink-0" />
                        </div>
                      )}

                      {/* Giờ số (Time) với 4 Styles */}
                      {stk.widgetType === 'time' && (() => {
                        const timeVal = stk.timeText || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const style = stk.timeStyle || 'digital';

                        if (style === 'badge') {
                          return (
                            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/25 text-white font-black text-xs tracking-wider shadow-xl">
                              <Clock className="w-3.5 h-3.5 text-pink-400" />
                              <span>{timeVal}</span>
                            </div>
                          );
                        }
                        if (style === 'neon') {
                          return (
                            <div className="px-3.5 py-1 rounded-2xl bg-black/70 backdrop-blur-sm border border-pink-500/80 text-pink-400 font-black text-2xl tracking-widest shadow-[0_0_20px_rgba(236,72,153,0.7)]">
                              {timeVal}
                            </div>
                          );
                        }
                        if (style === 'date_time') {
                          const dateStr = new Date().toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
                          return (
                            <div className="px-3 py-1.5 rounded-2xl bg-black/65 backdrop-blur-md border border-white/20 text-white text-center shadow-xl">
                              <p className="text-[10px] font-bold text-white/75 uppercase tracking-wider">{dateStr}</p>
                              <p className="text-xl font-black tracking-widest leading-none mt-0.5">{timeVal}</p>
                            </div>
                          );
                        }
                        return (
                          <div className="px-3 py-1 font-black text-3xl sm:text-4xl text-white tracking-widest drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] select-none">
                            {timeVal}
                          </div>
                        );
                      })()}

                      {/* Nhắc tên (Mention) - Click xem Profile bạn bè */}
                      {stk.widgetType === 'mention' && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (stk.friendId) {
                              window.open(`/profile/${stk.friendId}`, '_blank');
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-extrabold text-xs shadow-xl border border-white/30 tracking-wide cursor-pointer hover:scale-105 active:scale-95 transition-all select-none"
                          title="Nhấn để xem trang cá nhân"
                        >
                          {stk.avatarUrl && (
                            <img 
                              src={stk.avatarUrl} 
                              alt="" 
                              className="w-4 h-4 rounded-full object-cover border border-white/60"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <AtSign className="w-3.5 h-3.5 text-white shrink-0" />
                          <span className="truncate max-w-[140px]">{stk.text?.replace(/^@/, '') || 'banbe'}</span>
                        </div>
                      )}

                      {/* Thăm dò ý kiến (Poll) - Chuẩn nghiệp vụ Instagram/Facebook */}
                      {stk.widgetType === 'poll' && (() => {
                        const storyId = currentStory?.id;
                        let localSaved = null;
                        try {
                          localSaved = JSON.parse(localStorage.getItem(`wings_poll_${storyId}_${stk.id}`) || 'null');
                        } catch {}

                        const pollData = pollVotes[stk.id] || localSaved || stk.pollData || { countA: 0, countB: 0, votes: {} };
                        const myVote = pollData.votes?.[currentUser?.id] || localSaved?.voted || pollVotes[stk.id]?.voted || null;
                        const isAuthor = Boolean(
                          currentUser?.id && 
                          ((currentStory?.author_id && String(currentUser.id) === String(currentStory.author_id)) ||
                           (tray?.author?.id && String(currentUser.id) === String(tray.author.id)))
                        );
                        const hasVoted = Boolean(myVote) || isAuthor;

                        const countA = Number(pollData.countA) || 0;
                        const countB = Number(pollData.countB) || 0;
                        const totalVotes = countA + countB;
                        const pctA = totalVotes > 0 ? Math.round((countA / totalVotes) * 100) : (hasVoted ? 50 : 0);
                        const pctB = totalVotes > 0 ? (100 - pctA) : (hasVoted ? 50 : 0);

                        const optA = stk.optionA || 'Có 👍';
                        const optB = stk.optionB || 'Không 👎';

                        return (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="w-64 p-3.5 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl text-slate-900 dark:text-white shadow-2xl border border-black/10 dark:border-white/20 select-none text-center animate-scale-up"
                          >
                            <p className="font-extrabold text-xs mb-2.5 leading-snug px-1 text-slate-900 dark:text-white">
                              {stk.question || 'Bạn thấy thế nào?'}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {/* Option A */}
                              <button
                                type="button"
                                disabled={Boolean(myVote)}
                                onClick={() => handleVotePoll(stk, 'A')}
                                className={`relative overflow-hidden py-2 px-2.5 rounded-2xl font-bold text-xs transition cursor-pointer border ${
                                  hasVoted
                                    ? myVote === 'A'
                                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shadow-xs'
                                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                                    : 'border-emerald-400/40 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {hasVoted && (
                                  <div 
                                    className="absolute inset-y-0 left-0 bg-emerald-500/30 transition-all duration-700 ease-out"
                                    style={{ width: `${pctA}%` }}
                                  />
                                )}
                                <div className="relative z-10 flex flex-col items-center gap-0.5">
                                  <span className="truncate max-w-full">{optA}</span>
                                  {hasVoted && (
                                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                                      {pctA}% {myVote === 'A' && '✓'}
                                    </span>
                                  )}
                                </div>
                              </button>

                              {/* Option B */}
                              <button
                                type="button"
                                disabled={Boolean(myVote)}
                                onClick={() => handleVotePoll(stk, 'B')}
                                className={`relative overflow-hidden py-2 px-2.5 rounded-2xl font-bold text-xs transition cursor-pointer border ${
                                  hasVoted
                                    ? myVote === 'B'
                                      ? 'border-rose-500 bg-rose-500/20 text-rose-700 dark:text-rose-300 shadow-xs'
                                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                                    : 'border-rose-400/40 bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                {hasVoted && (
                                  <div 
                                    className="absolute inset-y-0 left-0 bg-rose-500/30 transition-all duration-700 ease-out"
                                    style={{ width: `${pctB}%` }}
                                  />
                                )}
                                <div className="relative z-10 flex flex-col items-center gap-0.5">
                                  <span className="truncate max-w-full">{optB}</span>
                                  {hasVoted && (
                                    <span className="text-[11px] font-black text-rose-600 dark:text-rose-400">
                                      {pctB}% {myVote === 'B' && '✓'}
                                    </span>
                                  )}
                                </div>
                              </button>
                            </div>
                            {hasVoted && (
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                                {totalVotes > 0 ? `${totalVotes} lượt bình chọn` : 'Chưa có lượt bình chọn'}
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Hộp câu hỏi (Question) - Người xem gửi câu trả lời về chat tác giả */}
                      {stk.widgetType === 'question' && (() => {
                        const storyId = currentStory?.id;
                        let savedAnswer = null;
                        try {
                          savedAnswer = localStorage.getItem(`wings_qa_${storyId}_${stk.id}`);
                        } catch {}
                        const hasAnswered = Boolean(savedAnswer || questionSent[stk.id]);

                        return (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="w-64 p-3.5 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-100 dark:border-slate-800 select-none text-center animate-scale-up"
                          >
                            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 mb-2">
                              <MessageCircle className="w-4 h-4" />
                              <span className="truncate max-w-[200px]">{stk.prompt || 'Hỏi tôi bất cứ điều gì'}</span>
                            </div>
                            {hasAnswered ? (
                              <div className="space-y-1.5">
                                <div className="py-2 px-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Đã gửi câu trả lời!</span>
                                </div>
                                <p className="text-[10px] text-slate-400 truncate italic">
                                  "{savedAnswer || questionSent[stk.id]}"
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={questionInputs[stk.id] || ''}
                                  onChange={(e) => setQuestionInputs((prev) => ({ ...prev, [stk.id]: e.target.value }))}
                                  onFocus={() => setIsPaused(true)}
                                  onBlur={() => setIsPaused(false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSendQuestion(stk);
                                    }
                                  }}
                                  placeholder="Nhập câu trả lời..."
                                  className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-0 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <button
                                  type="button"
                                  disabled={!questionInputs[stk.id]?.trim() || isSendingQuestion[stk.id]}
                                  onClick={() => handleSendQuestion(stk)}
                                  className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-40 cursor-pointer shrink-0"
                                  title="Gửi"
                                >
                                  {isSendingQuestion[stk.id] ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Thanh trượt cảm xúc (Slider) - Chuẩn kéo thả & lưu bền vững Instagram */}
                      {stk.widgetType === 'slider' && (() => {
                        const storyId = currentStory?.id;
                        let localSaved = null;
                        try {
                          localSaved = localStorage.getItem(`wings_slider_${storyId}_${stk.id}`);
                        } catch {}

                        const serverScore = stk.sliderData?.votes?.[currentUser?.id];
                        const myScore = localSaved !== null 
                          ? Number(localSaved) 
                          : (serverScore !== undefined ? Number(serverScore) : (sliderValues[stk.id] ?? null));

                        const hasSlid = myScore !== null && myScore !== undefined;
                        const currentVal = sliderValues[stk.id] ?? (hasSlid ? myScore : 20);

                        return (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="w-60 p-3.5 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl border border-black/10 dark:border-white/20 select-none text-center"
                          >
                            <div className="relative flex items-center justify-center mb-1">
                              <span 
                                className="text-3xl transition-transform filter drop-shadow-md cursor-grab active:cursor-grabbing"
                                style={{ transform: `scale(${0.9 + (currentVal / 100) * 0.7})` }}
                              >
                                {stk.emoji || '🔥'}
                              </span>
                              {hasSlid && (
                                <span className="absolute right-2 top-0 text-[10px] font-extrabold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 px-1.5 py-0.5 rounded-md">
                                  {currentVal}%
                                </span>
                              )}
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={currentVal}
                              onFocus={() => setIsPaused(true)}
                              onBlur={() => setIsPaused(false)}
                              onChange={(e) => handleSliderChange(stk.id, e.target.value)}
                              onPointerUp={(e) => handleSliderCommit(stk, e.target.value)}
                              onTouchEnd={(e) => handleSliderCommit(stk, e.target.value)}
                              onMouseUp={(e) => handleSliderCommit(stk, e.target.value)}
                              className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-pink-600"
                            />
                            {hasSlid && (
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                                Điểm bạn đã kéo: <span className="font-bold text-slate-700 dark:text-slate-300">{currentVal}%</span>
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Đếm ngược (Countdown) - Đếm ngược thời gian thực sống động từng giây */}
                      {stk.widgetType === 'countdown' && (
                        <StoryCountdownLive 
                          stk={stk} 
                          expiresAt={currentStory?.expiresAt || currentStory?.expires_at} 
                          createdAt={currentStory?.createdAt || currentStory?.created_at} 
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* HIỂN THỊ ÂM NHẠC TRÊN KHUNG STORY THEO STYLE (POINTER-EVENTS-NONE) */}
          {storyMusic && storyMusic.showSticker !== false && storyMusic.displayMode !== 'hidden' && (
            <div className="absolute inset-0 pointer-events-none z-25 overflow-hidden">
              {/* Style 1: Thẻ Bìa Album Card (Spotify/Instagram style) */}
              {storyMusic.displayMode === 'card' && (
                <div
                  style={{
                    left: `${storyMusic.musicPos?.x ?? 50}%`,
                    top: `${storyMusic.musicPos?.y ?? 82}%`,
                    transform: `translate(-50%, -50%) scale(${storyMusic.scale || storyMusic.musicScale || 1})`,
                  }}
                  className="absolute pointer-events-none select-none"
                >
                  <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-black/75 backdrop-blur-xl border border-white/25 shadow-2xl text-white w-64">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md bg-purple-700">
                      <img src={storyMusic.coverUrl} alt={storyMusic.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Music className="w-4 h-4 text-white drop-shadow" />
                      </div>
                    </div>
                    <div className="min-w-0 pr-1 flex-1">
                      <p className="text-xs font-bold text-white truncate drop-shadow-sm">
                        {storyMusic.title}
                      </p>
                      <p className="text-[11px] text-white/80 truncate">
                        {storyMusic.artist}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-[9px] text-purple-300 font-medium">
                        <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-100" 
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span>0:{storyMusic.duration || 15}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Style 2: Huy hiệu Đĩa quay kinh điển (Badge pill - Áp dụng cả khi displayMode là lyrics để giao diện gọn gàng) */}
              {(storyMusic.displayMode === 'badge' || storyMusic.displayMode === 'lyrics' || (!storyMusic.displayMode && storyMusic.musicPos)) && (
                <div
                  style={{
                    left: `${storyMusic.musicPos?.x ?? 50}%`,
                    top: `${storyMusic.musicPos?.y ?? 84}%`,
                    transform: `translate(-50%, -50%) scale(${storyMusic.scale || storyMusic.musicScale || 1})`,
                  }}
                  className="absolute pointer-events-none select-none"
                >
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/25 shadow-2xl text-white">
                    <div className="relative w-6 h-6 rounded-full overflow-hidden bg-purple-600 shrink-0 border border-white/40 shadow-xs flex items-center justify-center">
                      <img src={storyMusic.coverUrl} alt={storyMusic.title} className="w-full h-full object-cover animate-spin" style={{ animationDuration: '4s' }} />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Music className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                    <div className="min-w-0 pr-1">
                      <p className="text-[11px] font-bold truncate max-w-[130px] leading-tight drop-shadow-xs">
                        {storyMusic.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-[9px] text-white/80 leading-tight">
                        <span className="truncate max-w-[90px]">{storyMusic.artist}</span>
                        {!isMuted && !isEffectivePaused && (
                          <div className="flex items-end gap-0.5 h-2">
                            <span className="w-0.5 h-full bg-purple-400 rounded-full animate-pulse" />
                            <span className="w-0.5 h-1.5 bg-purple-300 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                            <span className="w-0.5 h-1 bg-purple-200 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lớp hạt Reaction bay bổng đa chiều (Floating Particles 60fps) */}
          <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            {floatingParticles.map((p) => (
              <div
                key={p.id}
                className="absolute bottom-20 select-none will-change-transform"
                style={{
                  left: `${p.left}%`,
                  fontSize: `${28 * p.scale}px`,
                  '--drift-x': `${p.driftX}px`,
                  animation: `storyParticleFloat ${p.duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${p.delay}ms forwards`,
                }}
              >
                <span className="drop-shadow-xl inline-block" style={{ transform: `rotate(${p.rotate}deg)` }}>
                  {p.emoji}
                </span>
              </div>
            ))}
          </div>
          </div>

          {/* LỚP PHỦ CẢNH BÁO NỘI DUNG NHẠY CẢM (CHUẨN BÀI VIẾT) */}
          {isSensitiveStory && !isStoryRevealed && (
            <div 
              className="absolute inset-0 z-35 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full max-w-xs bg-amber-50/95 dark:bg-slate-900/95 border border-amber-300 dark:border-amber-600/60 rounded-3xl p-6 text-center shadow-2xl animate-scale-up">
                <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="font-black text-base text-amber-950 dark:text-white mb-2">
                  Cảnh báo: Nội dung nhạy cảm
                </h3>
                <p className="text-xs text-amber-900/90 dark:text-slate-300 leading-relaxed mb-5">
                  {isToxic && isNsfw
                    ? 'Tin này có thể chứa cả ngôn từ độc hại (Toxic) và hình ảnh nhạy cảm (NSFW).'
                    : isToxic
                    ? 'Tin này có thể chứa ngôn từ độc hại hoặc thô tục (Toxic).'
                    : 'Tin này có thể chứa hình ảnh nhạy cảm (NSFW).'}
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRevealedStoryIds((prev) => ({ ...prev, [currentStory.id]: true }))}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Xem toàn bộ tin</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStory}
                    className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                  >
                    Bỏ qua sang tin tiếp
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LỚP PHỦ KHÓA TIN NẾU BỊ ẨN CỨNG (BẠO LỰC / THÙ GHÉT) */}
          {isHardHidden && !isAuthor && (
            <div 
              className="absolute inset-0 z-35 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full max-w-xs bg-slate-900/95 border border-rose-500/50 rounded-3xl p-6 text-center shadow-2xl animate-scale-up">
                <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/60 flex items-center justify-center text-rose-400">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="font-black text-base text-rose-100 mb-2">
                  Tin đã bị ẩn
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-5">
                  Nội dung tin này đã bị ẩn do vi phạm chính sách cộng đồng về {currentStory.aiLabel === 'Violence' ? 'Bạo lực' : 'Ngôn từ thù ghét'}.
                </p>
                <button
                  type="button"
                  onClick={handleNextStory}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Xem tin kế tiếp
                </button>
              </div>
            </div>
          )}
        </div>

        {/* VÙNG NHẤN RÌA 2 BÊN ĐỂ CHUYỂN TIN & GIỮ CHUỘT ĐỂ TẠM DỪNG (CHỈ Ở RÌA 2 BÊN, KHÔNG CHE KHUẤT NỘI DUNG Ở GIỮA) */}
        {!isStoryCovered && (
          <div className="absolute top-20 bottom-28 inset-x-0 z-20 flex justify-between select-none pointer-events-none">
            {/* Rìa mép trái (15%): Bấm chuyển về tin trước, giữ chuột để tạm dừng */}
            <div 
              className="w-[15%] max-w-[64px] h-full cursor-pointer select-none pointer-events-auto"
              onPointerDown={handleHoldStart}
              onPointerUp={(e) => handleTapOrRelease('prev', e)}
              onPointerLeave={handleHoldEnd}
              onPointerCancel={handleHoldEnd}
              title="Nhấn rìa trái để xem tin trước • Giữ chuột để tạm dừng"
            />

            {/* Vùng giữa hoàn toàn thông thoáng (pointer-events-none) để người xem tự do nhấn xem bài viết / story được chia sẻ */}
            <div className="flex-1 h-full pointer-events-none" />

            {/* Rìa mép phải (15%): Bấm chuyển sang tin kế tiếp, giữ chuột để tạm dừng */}
            <div 
              className="w-[15%] max-w-[64px] h-full cursor-pointer select-none pointer-events-auto"
              onPointerDown={handleHoldStart}
              onPointerUp={(e) => handleTapOrRelease('next', e)}
              onPointerLeave={handleHoldEnd}
              onPointerCancel={handleHoldEnd}
              title="Nhấn rìa phải để xem tin kế tiếp • Giữ chuột để tạm dừng"
            />
          </div>
        )}

        {/* Biểu tượng Tạm dừng khi đang giữ chuột */}
        {isHolding && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 p-3.5 rounded-full bg-black/60 backdrop-blur-md text-white pointer-events-none animate-scale-up shadow-2xl border border-white/20">
            <Pause className="w-7 h-7" />
          </div>
        )}

        {/* 4. Footer tương tác: Xem lượt xem hoặc Trả lời tin & Thả reaction */}
        {!isStoryCovered && (
        <div className="absolute bottom-4 inset-x-4 z-30 space-y-2">
          {/* Thông báo gửi tin nhắn phản hồi thành công hoặc lỗi */}
          {replySuccessMsg && (
            <div className="py-1.5 px-3 rounded-xl bg-emerald-500/95 text-white text-xs font-semibold backdrop-blur-md text-center shadow-lg animate-fade-in">
              ✓ {replySuccessMsg}
            </div>
          )}
          {replyErrorMsg && (
            <div className="py-1.5 px-3 rounded-xl bg-rose-500/95 text-white text-xs font-semibold backdrop-blur-md text-center shadow-lg animate-fade-in">
              {replyErrorMsg}
            </div>
          )}

          {isAuthor ? (
            /* Dành cho Tác giả: Nút xem số lượng người đã xem */
            <button 
              onClick={handleOpenViewers}
              className="w-full py-2.5 px-4 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-between text-xs font-semibold transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span>{currentStory.viewsCount || 0} người đã xem</span>
              </span>
              <span className="text-white/70">Xem chi tiết &gt;</span>
            </button>
          ) : (
            /* Dành cho Người xem: Thanh thả Reaction & Ô gửi tin nhắn trả lời Story */
            <div className="space-y-2">
              {/* Dãy 6 biểu tượng cảm xúc nhanh */}
              <div className="flex items-center justify-between px-3 py-1.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10">
                {REACTION_ICONS.map((r) => (
                  <button
                    key={r.type}
                    onClick={() => handleReact(r.type)}
                    className={`text-2xl hover:scale-130 active:scale-95 transition-transform cursor-pointer p-1 ${
                      myReaction === r.type ? 'scale-125 filter drop-shadow-md' : 'opacity-85 hover:opacity-100'
                    }`}
                    title={r.label}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>

              {/* Ô nhập tin nhắn trả lời (Reply to Story) */}
              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <input 
                  type="text"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder={`Gửi tin nhắn cho ${tray.author?.name || 'tác giả'}...`}
                  className="flex-1 px-4 py-2.5 rounded-full bg-white/20 hover:bg-white/25 focus:bg-white/35 backdrop-blur-md text-white placeholder-white/70 text-xs border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 transition"
                />
                <button
                  type="submit"
                  disabled={!replyMessage.trim() || isSendingReply}
                  className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition shadow-md flex items-center justify-center shrink-0 cursor-pointer"
                  title="Gửi tin nhắn trả lời tin"
                >
                  {isSendingReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
        )}

        {/* Modal Xem danh sách người đã xem (Chỉ tác giả) */}
        {showViewers && (
          <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col p-4 sm:p-6 text-white animate-fade-in">
            <div className="flex flex-col gap-2.5 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Eye className="w-5 h-5 text-slate-300" />
                  <span>Người xem tin ({viewersList.length})</span>
                </h3>
                <button 
                  onClick={() => { setShowViewers(false); setIsPaused(false); }}
                  className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tóm tắt tất cả các loại cảm xúc trên tin (Facebook Story style) */}
              {totalReactionsBreakdown.length > 0 && (
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <span className="text-slate-400">Cảm xúc:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {totalReactionsBreakdown.map((r) => (
                      <span 
                        key={r.type} 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-xs select-none hover:bg-white/15 transition"
                        title={`${r.label}: ${r.total} lượt`}
                      >
                        <span className="text-sm leading-none">{r.emoji}</span>
                        <span className="font-semibold text-slate-200">{r.total}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {isLoadingViewers ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              ) : viewersList.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">Chưa có ai xem tin này</p>
              ) : (
                viewersList.map((v) => {
                  const isTarget = targetViewerId && (
                    String(v.viewer_id) === String(targetViewerId) || 
                    String(v.user_id) === String(targetViewerId)
                  );

                  return (
                    <div 
                      key={v.view_id} 
                      ref={(el) => {
                        if (isTarget && el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className={`flex items-center justify-between p-3 rounded-2xl transition duration-150 ${
                        isTarget 
                          ? 'bg-slate-800/90 border border-slate-700 shadow-sm' 
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img 
                          src={v.avatar_url || DEFAULT_AVATAR} 
                          alt={v.full_name} 
                          className="w-10 h-10 rounded-full object-cover ring-1 ring-white/15 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm leading-tight text-white truncate">
                              {v.full_name}
                            </p>
                            {isTarget && (
                              <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                Đã tương tác
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {(() => {
                              try {
                                const raw = v.viewed_at || v.viewedAt;
                                return raw ? formatRelativeTime(raw) : 'Vừa xong';
                              } catch {
                                return 'Vừa xong';
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                      {(() => {
                        const reactionsSummary = getViewerReactionsSummary(v);
                        if (reactionsSummary.length === 0) return null;

                        return (
                          <div className="flex items-center gap-1.5 shrink-0 pl-2">
                            {reactionsSummary.map((item) => (
                              <div
                                key={item.type}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 transition select-none"
                                title={`${item.label}${item.count > 1 ? `: ${item.count} lượt` : ''}`}
                              >
                                <span className="text-base sm:text-lg leading-none select-none">
                                  {item.emoji}
                                </span>
                                {item.count > 1 && (
                                  <span className="text-xs font-bold text-slate-200">
                                    {item.count}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Modal Chia sẻ tin đăng (Instagram Story Share) */}
        {showShareStoryModal && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col p-5 text-white animate-fade-in justify-between"
          >
            {/* Header */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Chia sẻ tin đăng</h3>
                    <p className="text-[11px] text-white/60">Gửi tin của {tray.author?.name} tới bạn bè</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowShareStoryModal(false); setIsPaused(false); }}
                  className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Ô tìm kiếm bạn bè */}
              <div className="mt-3 relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-white/40" />
                <input
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Tìm kiếm bạn bè..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              {/* Ô ghi chú đính kèm */}
              <div className="mt-2">
                <input
                  type="text"
                  value={storyShareMsg}
                  onChange={(e) => setStoryShareMsg(e.target.value)}
                  placeholder="Viết tin nhắn kèm theo (tùy chọn)..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>

            {/* Danh sách bạn bè */}
            <div className="flex-1 my-3 overflow-y-auto divide-y divide-white/5 pr-1">
              {isLoadingFriends ? (
                <div className="py-12 flex flex-col items-center justify-center text-white/50 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                  <span className="text-xs">Đang tải bạn bè...</span>
                </div>
              ) : friendsList.filter(f => {
                  if (!friendSearch.trim()) return true;
                  const q = friendSearch.toLowerCase();
                  return (f.name && f.name.toLowerCase().includes(q)) || (f.username && f.username.toLowerCase().includes(q));
                }).length === 0 ? (
                <div className="py-10 text-center text-white/50 text-xs">
                  {friendSearch ? 'Không tìm thấy bạn bè phù hợp' : 'Chưa có bạn bè nào'}
                </div>
              ) : (
                friendsList
                  .filter(f => {
                    if (!friendSearch.trim()) return true;
                    const q = friendSearch.toLowerCase();
                    return (f.name && f.name.toLowerCase().includes(q)) || (f.username && f.username.toLowerCase().includes(q));
                  })
                  .map((friend) => {
                    const status = storySendingStatus[friend.id];
                    return (
                      <div key={friend.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={friend.avatar || friend.avatar_url || DEFAULT_AVATAR}
                            alt={friend.name}
                            className="w-8 h-8 rounded-full object-cover border border-white/20"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{friend.name || friend.username}</p>
                            <p className="text-[10px] text-white/50 truncate">@{friend.username || 'user'}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={status === 'sending' || status === 'sent'}
                          onClick={() => handleSendStoryToFriend(friend)}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 shrink-0 ${
                            status === 'sent'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                          }`}
                        >
                          {status === 'sending' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : status === 'sent' ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Đã gửi</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" />
                              <span>Gửi</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Footer hành động bổ sung */}
            <div className="pt-3 border-t border-white/10 flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareStoryExternal}
                className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Chia sẻ ra ngoài</span>
              </button>

              <button
                type="button"
                onClick={handleCopyStoryLink}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép link</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}

import { useState, useEffect, useRef } from 'react';
import { 
  Camera, Edit2, MoreHorizontal, MapPin, Home as HomeIcon, 
  Heart, GraduationCap, Briefcase, Calendar, Image as ImageIcon, 
  Video, Flag, SlidersHorizontal, Settings2, List, Grid3X3, 
  Share2, CheckCircle2, Globe, Lock, Settings,
  MessageCircle, Send, ThumbsUp, Loader2, X, Search, Sparkles, 
  Eye, Users, Plus, Check, UploadCloud,
  UserPlus, UserCheck, Clock, UserX, ArrowLeft, ShieldAlert,
  ShieldCheck, ExternalLink
} from 'lucide-react';
import { profileService } from '../services/profileService';
import { friendService } from '../services/friendService';
import { messageService } from '../services/messageService';
import { updatePostReaction, sharePost, fetchUserTrustHistory } from '../api/client';
import EditProfileModal from './EditProfileModal';
import SharePostModal from './SharePostModal';
import CreatePostCard from './CreatePostCard';
import PostCard from './PostCard';
import OriginalPostModal from './OriginalPostModal';
import VerifiedBadge from './VerifiedBadge';
import { formatRelativeTime } from '../utils/timeAgo';
import { shouldHideContentForViewer } from '../utils/imageModerationReviewLogic';
import { getModerationNoticeText } from '../utils/moderationNoticeLogic';
import { getProfilePosts } from '../utils/profilePostLogic';

import { DEFAULT_AVATAR, DEFAULT_COVER } from '../constants/defaults';
export { DEFAULT_AVATAR, DEFAULT_COVER };

const REACTIONS = [
  { id: 'like', label: 'Thích', emoji: '👍', color: 'text-blue-600' },
  { id: 'love', label: 'Yêu thích', emoji: '❤️', color: 'text-rose-600' },
  { id: 'haha', label: 'Haha', emoji: '😄', color: 'text-amber-500' },
  { id: 'wow', label: 'Ngạc nhiên', emoji: '😮', color: 'text-amber-500' },
  { id: 'sad', label: 'Buồn', emoji: '😢', color: 'text-amber-600' },
  { id: 'angry', label: 'Phẫn nộ', emoji: '😡', color: 'text-orange-600' },
];

export default function ProfileView({ 
  currentUser, 
  viewedUser,
  posts = [], 
  onAddPost, 
  onToggleLike, 
  onAddComment,
  onUpdateUser,
  onOpenSettings,
  onOpenChat,
  onOpenUserProfile,
  onRequireAuth,
  onOpenReportModal,
  onOpenAppealModal,
  onEditPost,
  onDeletePost,
  onSharePost
}) {
  const targetUserId = viewedUser?.id || currentUser?.id;
  const isOwnProfile = !viewedUser || (currentUser && String(viewedUser.id) === String(currentUser.id));

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'about' | 'friends' | 'photos' | 'reels'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [aboutSubTab, setAboutSubTab] = useState('overview'); // 'overview' | 'work_edu' | 'places' | 'contact' | 'family'
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('');

  // ── State dữ liệu từ Database API ───────────────────────────
  const [profileData, setProfileData] = useState(null);
  const [profileFriends, setProfileFriends] = useState([]);
  const [profilePosts, setProfilePosts] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  // ── Modal chỉnh sửa trang cá nhân ──────────────────────────
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // ── Modal xem ảnh phóng to (Lightbox) ──────────────────────
  const [lightboxImage, setLightboxImage] = useState(null);
  const [viewingOriginalPost, setViewingOriginalPost] = useState(null);

  // ── Quan hệ bạn bè khi xem profile người khác ──────────────
  const [friendshipStatus, setFriendshipStatus] = useState('none'); // 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'self'
  const [friendshipId, setFriendshipId] = useState(null);
  const [isFriendActionLoading, setIsFriendActionLoading] = useState(false);
  const [friendActionToast, setFriendActionToast] = useState('');

  // ── Quick Upload từ máy tính lên Cloudinary cho Header ────
  // -- Trust Score data (only for own profile) --
  const [trustData, setTrustData] = useState(null);     // { trustScore, trustTier }
  const [trustHistory, setTrustHistory] = useState([]);
  const [showTrustHistory, setShowTrustHistory] = useState(false);
  const quickAvatarFileRef = useRef(null);
  const quickCoverFileRef = useRef(null);
  const [isQuickUploading, setIsQuickUploading] = useState(false);
  const [quickUploadToast, setQuickUploadToast] = useState('');

  const handleQuickAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !isOwnProfile) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WEBP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Dung lượng ảnh tối đa là 10MB');
      return;
    }

    setIsQuickUploading(true);
    setQuickUploadToast('Đang tải ảnh đại diện lên Cloudinary...');

    try {
      const cloudinaryUrl = await profileService.uploadImage(file);
      setQuickUploadToast('Đang cập nhật cơ sở dữ liệu...');

      const res = await profileService.updateProfile(currentUser.id, {
        avatar_url: cloudinaryUrl
      });

      if (res.success) {
        setProfileData(prev => ({ ...prev, avatar_url: cloudinaryUrl, avatar: cloudinaryUrl }));
        if (onUpdateUser) {
          onUpdateUser({ avatar: cloudinaryUrl, avatar_url: cloudinaryUrl });
        }
        setQuickUploadToast('✓ Đã cập nhật ảnh đại diện lên Cloudinary thành công!');
        setTimeout(() => setQuickUploadToast(''), 3000);
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi tải ảnh lên Cloudinary');
      setQuickUploadToast('');
    } finally {
      setIsQuickUploading(false);
      if (quickAvatarFileRef.current) quickAvatarFileRef.current.value = '';
    }
  };

  const handleQuickCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !isOwnProfile) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WEBP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Dung lượng ảnh tối đa là 10MB');
      return;
    }

    setIsQuickUploading(true);
    setQuickUploadToast('Đang tải ảnh bìa lên Cloudinary...');

    try {
      const cloudinaryUrl = await profileService.uploadImage(file);
      setQuickUploadToast('Đang cập nhật cơ sở dữ liệu...');

      const res = await profileService.updateProfile(currentUser.id, {
        cover_url: cloudinaryUrl
      });

      if (res.success) {
        setProfileData(prev => ({ ...prev, cover_url: cloudinaryUrl, cover: cloudinaryUrl }));
        if (onUpdateUser) {
          onUpdateUser({ cover: cloudinaryUrl, cover_url: cloudinaryUrl });
        }
        setQuickUploadToast('✓ Đã cập nhật ảnh bìa lên Cloudinary thành công!');
        setTimeout(() => setQuickUploadToast(''), 3000);
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi tải ảnh bìa lên Cloudinary');
      setQuickUploadToast('');
    } finally {
      setIsQuickUploading(false);
      if (quickCoverFileRef.current) quickCoverFileRef.current.value = '';
    }
  };

  // Fallback thông tin người dùng
  const activeUser = profileData || viewedUser || currentUser || {};
  const [bioInput, setBioInput] = useState('');

  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [profileReactions, setProfileReactions] = useState({});
  const [hoverReactionPostId, setHoverReactionPostId] = useState(null);
  const hoverReactionTimeoutRef = useRef(null);

  const handleOpenProfileReaction = (postId) => {
    if (hoverReactionTimeoutRef.current) {
      clearTimeout(hoverReactionTimeoutRef.current);
      hoverReactionTimeoutRef.current = null;
    }
    setHoverReactionPostId(postId);
  };

  const handleCloseProfileReaction = (delay = 350) => {
    if (hoverReactionTimeoutRef.current) {
      clearTimeout(hoverReactionTimeoutRef.current);
    }
    hoverReactionTimeoutRef.current = setTimeout(() => {
      setHoverReactionPostId(null);
      hoverReactionTimeoutRef.current = null;
    }, delay);
  };

  useEffect(() => {
    return () => {
      if (hoverReactionTimeoutRef.current) {
        clearTimeout(hoverReactionTimeoutRef.current);
      }
    };
  }, []);

  const [activePostMenuId, setActivePostMenuId] = useState(null);
  const [sharingPost, setSharingPost] = useState(null);


  // ── 1. Fetch Profile từ DB ──────────────────────────────────
  useEffect(() => {
    setProfileData(null);
    setProfileFriends([]);
    setProfilePosts(null);

    if (!targetUserId) {
      setIsLoadingProfile(false);
      return;
    }
    let isMounted = true;
    setIsLoadingProfile(true);

    profileService.getProfile(targetUserId)
      .then(res => {
        if (isMounted && res.success) {
          setProfileData(res.data);
          setBioInput(res.data.bio || '');
        }
      })
      .catch(err => {
        if (import.meta.env.DEV) console.warn('Không tải được profile từ API:', err);
        setBioInput(viewedUser?.bio || currentUser?.bio || '');
      })
      .finally(() => { if (isMounted) setIsLoadingProfile(false); });

    return () => { isMounted = false; };
  }, [targetUserId]);

  // ── 2. Fetch Friends từ DB ──────────────────────────────────
  useEffect(() => {
    if (!targetUserId) return;
    let isMounted = true;

    profileService.getFriends(targetUserId, 50)
      .then(res => {
        if (isMounted && res.success) setProfileFriends(res.data);
      })
      .catch(err => {
        if (import.meta.env.DEV) console.warn('Không tải được bạn bè từ API:', err);
      });

    return () => { isMounted = false; };
  }, [targetUserId]);

  // ── 3. Fetch Posts của User từ DB ───────────────────────────
  // -- 5. Fetch Trust Score (own profile only) --
  useEffect(() => {
    if (!targetUserId || !isOwnProfile || !currentUser) return;
    let isMounted = true;
    fetchUserTrustHistory(targetUserId)
      .then(res => {
        if (!isMounted) return;
        if (res.success) setTrustHistory(res.data || []);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [targetUserId, isOwnProfile, currentUser?.id]);
  useEffect(() => {
    if (!targetUserId) {
      setIsLoadingPosts(false);
      return;
    }
    let isMounted = true;
    setIsLoadingPosts(true);

    profileService.getUserPosts(targetUserId, currentUser?.id)
      .then(res => {
        if (isMounted && res.success) setProfilePosts(res.data);
      })
      .catch(err => {
        if (import.meta.env.DEV) console.warn('Không tải được bài viết từ API:', err);
        if (isMounted) setProfilePosts(null);
      })
      .finally(() => { if (isMounted) setIsLoadingPosts(false); });

    return () => { isMounted = false; };
  }, [targetUserId, currentUser?.id]);

  // ── 4. Fetch Trạng thái Quan hệ Bạn bè ─────────────────────────
  useEffect(() => {
    if (!targetUserId || isOwnProfile || !currentUser) {
      setFriendshipStatus(isOwnProfile ? 'self' : 'none');
      return;
    }
    let isMounted = true;
    friendService.getFriendshipStatus(targetUserId).then(res => {
      if (!isMounted) return;
      if (res && res.status) {
        setFriendshipStatus(res.status);
        if (res.friendship_id) setFriendshipId(res.friendship_id);
      }
    }).catch(console.warn);

    return () => { isMounted = false; };
  }, [targetUserId, isOwnProfile, currentUser?.id]);

  // Hành động Kết bạn / Hủy lời mời / Chấp nhận / Hủy kết bạn
  const handleSendFriendRequest = async () => {
    if (!currentUser) {
      onRequireAuth ? onRequireAuth("Vui lòng đăng nhập để kết bạn") : alert("Vui lòng đăng nhập");
      return;
    }
    setIsFriendActionLoading(true);
    try {
      const res = await friendService.sendFriendRequest(targetUserId);
      if (res?.data?.status === 'accepted') {
        // Đối phương đã gửi lời mời trước đó => TỰ ĐỘNG THÊM BẠN BÈ VÀO Ô CHÁT
        setFriendshipStatus('friends');
        await messageService.getOrCreateConversation(targetUserId);
        setFriendActionToast('✓ Hai bạn đã trở thành bạn bè! Đã tự động thêm vào ô chát.');
      } else {
        setFriendshipStatus('pending_sent');
        setFriendActionToast('✓ Đã gửi lời mời kết bạn thành công!');
      }
      setTimeout(() => setFriendActionToast(''), 4000);
    } catch (err) {
      alert(err.message || 'Lỗi khi gửi lời mời kết bạn');
    } finally {
      setIsFriendActionLoading(false);
    }
  };

  const handleCancelFriendRequest = async () => {
    setIsFriendActionLoading(true);
    try {
      await friendService.cancelSentRequest(targetUserId);
      setFriendshipStatus('none');
      setFriendActionToast('Đã thu hồi lời mời kết bạn');
      setTimeout(() => setFriendActionToast(''), 3000);
    } catch (err) {
      alert(err.message || 'Lỗi khi thu hồi lời mời');
    } finally {
      setIsFriendActionLoading(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!friendshipId) return;
    setIsFriendActionLoading(true);
    try {
      await friendService.acceptFriendRequest(friendshipId);
      setFriendshipStatus('friends');
      // TỰ ĐỘNG THÊM BẠN BÈ VÀO Ô CHÁT (Kích hoạt hội thoại 'accepted')
      await messageService.getOrCreateConversation(targetUserId);
      setFriendActionToast('✓ Đã đồng ý kết bạn! Cuộc trò chuyện đã được tự động thêm vào ô chát.');
      setTimeout(() => setFriendActionToast(''), 4000);
    } catch (err) {
      alert(err.message || 'Lỗi khi đồng ý kết bạn');
    } finally {
      setIsFriendActionLoading(false);
    }
  };

  const handleUnfriend = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy kết bạn với ${activeUser.name || 'người này'}?`)) return;
    setIsFriendActionLoading(true);
    try {
      await friendService.unfriend(targetUserId);
      setFriendshipStatus('none');
      setFriendActionToast('Đã hủy kết bạn');
      setTimeout(() => setFriendActionToast(''), 3000);
    } catch (err) {
      alert(err.message || 'Lỗi khi hủy kết bạn');
    } finally {
      setIsFriendActionLoading(false);
    }
  };

  // Danh sách bài viết hiển thị
  const userPosts = getProfilePosts({ isOwnProfile, posts, profilePosts, targetUserId });

  // Trích xuất toàn bộ ảnh thực tế từ các bài viết trong Database
  const realUserPhotos = [
    ...(userPosts || []).filter(p => p.image || p.image_url).map(p => p.image || p.image_url),
    activeUser.avatar || activeUser.avatar_url,
    activeUser.cover || activeUser.cover_url
  ].filter(Boolean);

  // Bộ sưu tập ảnh mẫu nếu tài khoản mới chưa đăng ảnh nào
  const samplePhotoGrid = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=80"
  ];

  const displayPhotos = realUserPhotos.length > 0 ? realUserPhotos : samplePhotoGrid;

  // Lọc bạn bè theo ô tìm kiếm
  const filteredFriends = profileFriends.filter(f => {
    if (!friendsSearchQuery.trim()) return true;
    const q = friendsSearchQuery.toLowerCase();
    return (f.name && f.name.toLowerCase().includes(q)) ||
           (f.username && f.username.toLowerCase().includes(q));
  });

  const getPostCurrentReaction = (post) => {
    if (!post) return null;
    if (Object.prototype.hasOwnProperty.call(profileReactions, post.id)) {
      return profileReactions[post.id];
    }
    return post.myReaction || (post.isLiked ? 'like' : null);
  };

  const handleSelectProfileReaction = async (postId, reactionId = 'like') => {
    if (!currentUser?.id) {
      if (onRequireAuth) onRequireAuth("Vui lòng đăng nhập để tương tác bài viết");
      return;
    }

    const targetPost = userPosts.find(p => String(p.id) === String(postId));
    const current = getPostCurrentReaction(targetPost || { id: postId });
    
    // Nếu bấm lại đúng cảm xúc đang có -> thu hồi (null), ngược lại -> chuyển sang cảm xúc mới
    const nextReaction = current === reactionId ? null : reactionId;

    setProfileReactions(prev => ({
      ...prev,
      [postId]: nextReaction
    }));
    if (hoverReactionTimeoutRef.current) {
      clearTimeout(hoverReactionTimeoutRef.current);
      hoverReactionTimeoutRef.current = null;
    }
    setHoverReactionPostId(null);


    // Cập nhật API database nếu post có id số
    if (!Number.isNaN(Number(postId))) {
      try {
        await updatePostReaction({
          userId: currentUser.id,
          postId,
          type: nextReaction,
          action: nextReaction ? 'set' : 'remove',
        });
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Lỗi cập nhật cảm xúc bài viết:', err);
      }
    }

    // Chỉ đồng bộ toggle like nếu chuyển đổi giữa (chưa thả <-> đã thả)
    if ((!current && nextReaction) || (current && !nextReaction)) {
      onToggleLike && onToggleLike(postId);
    }
  };

  // Đăng bài viết mới trên trang cá nhân
  const handleCreateProfilePost = (e) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

    const newPost = {
      id: `post-${Date.now()}`,
      author: {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        avatar: currentUser.avatar,
        isVerified: currentUser.isVerified
      },
      createdAt: "Vừa xong",
      content: newPostText.trim(),
      image: newPostImage.trim() || null,
      tags: ["profile"],
      likesCount: 0,
      isLiked: false,
      sharesCount: 0,
      isSaved: false,
      aiStatus: { label: "Normal", confidence: 0.99 },
      comments: []
    };

    onAddPost && onAddPost(newPost);

    // Refresh bài viết từ Database
    if (currentUser?.id) {
      profileService.getUserPosts(currentUser.id, currentUser.id)
        .then(res => { if (res.success) setProfilePosts(res.data); })
        .catch(() => {});
    }
    setNewPostText('');
    setNewPostImage('');
    setShowImageInput(false);
  };

  // Lưu thông tin từ Modal chỉnh sửa Profile trực tiếp vào PostgreSQL
  const handleSaveProfileModal = async (updatedFields) => {
    if (!currentUser || !isOwnProfile) return;
    setIsSavingProfile(true);
    setSaveSuccessMsg('');

    try {
      const res = await profileService.updateProfile(currentUser.id, {
        bio: updatedFields.bio,
        location: updatedFields.location,
        hometown: updatedFields.hometown,
        education: updatedFields.education,
        highSchool: updatedFields.highSchool,
        relationship: updatedFields.relationship,
        avatar_url: updatedFields.avatar_url,
        cover_url: updatedFields.cover_url
      });

      if (res.success) {
        // Cập nhật profile state
        setProfileData(prev => ({
          ...prev,
          ...res.data
        }));
        setBioInput(updatedFields.bio || '');

        // Đồng bộ lên Navbar và App state
        if (onUpdateUser) {
          onUpdateUser({
            name: activeUser.name,
            avatar: updatedFields.avatar_url || activeUser.avatar,
            avatar_url: updatedFields.avatar_url || activeUser.avatar,
            cover: updatedFields.cover_url || activeUser.cover,
            cover_url: updatedFields.cover_url || activeUser.cover,
            bio: updatedFields.bio,
            location: updatedFields.location,
            hometown: updatedFields.hometown,
            education: updatedFields.education,
            highSchool: updatedFields.highSchool,
            relationship: updatedFields.relationship
          });
        }

        setSaveSuccessMsg('Đã lưu thông tin cá nhân vào cơ sở dữ liệu thành công!');
        setTimeout(() => {
          setSaveSuccessMsg('');
          setIsEditProfileOpen(false);
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi lưu thông tin vào cơ sở dữ liệu');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Gửi bình luận bài viết
  const handleCommentSubmit = (postId, e) => {
    e.preventDefault();
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    const newId = `cmt-${postId}-${Date.now()}`;
    onAddComment && onAddComment(postId, {
      id: newId,
      author: {
        name: currentUser.name,
        avatar: currentUser.avatar
      },
      content: text.trim(),
      time: "Vừa xong",
      likes: 0
    });

    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };

  // Chia sẻ bài viết trong trang cá nhân
  const handleConfirmShare = async (content) => {
    if (!sharingPost) return;
    const result = await sharePost({
      userId: currentUser?.id,
      user: currentUser,
      postId: sharingPost.id,
      content,
    });

    // Tăng số lượt chia sẻ trên UI của bài được share
    setProfilePosts(prev => {
      if (!prev) return prev;
      return prev.map(p => {
        if (p.id === sharingPost.id) {
          return { ...p, sharesCount: (p.sharesCount || 0) + 1 };
        }
        return p;
      });
    });

    // Nếu đang ở trang cá nhân của chính mình, thêm bài chia sẻ mới vào đầu danh sách
    if (isOwnProfile && result?.data) {
      setProfilePosts(prev => prev ? [result.data, ...prev] : [result.data]);
    }

    // Cập nhật lên Feed trang chủ ngoài App
    onAddPost && onAddPost(result?.data);
  };

  const handleProfilePostUpdate = (postId, changes) => {
    setProfilePosts((previous) => {
      const source = previous || userPosts;
      return source.flatMap((post) => {
        if (String(post.id) !== String(postId)) return [post];
        if (changes?.imageModeration) {
          return changes.imageModeration.status === 'rejected_final'
            ? []
            : [{ ...post, imageModeration: changes.imageModeration }];
        }
        const { id: commentId, ...commentChanges } = changes.commentModeration;
        return [{
          ...post,
          comments: (post.comments || []).map((comment) => String(comment.id) === String(commentId)
            ? { ...comment, ...commentChanges }
            : comment),
        }];
      });
    });
    onEditPost?.(postId, changes);
  };

  return (
    <div className="bg-slate-100 min-h-screen pb-16">

      {/* Toast thông báo tải ảnh Cloudinary nhanh */}
      {quickUploadToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs sm:text-sm font-bold animate-fade-in border border-slate-700">
          {isQuickUploading ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{quickUploadToast}</span>
        </div>
      )}

      {/* Input ẩn để chọn ảnh đại diện & ảnh bìa trực tiếp từ máy tính */}
      <input 
        type="file" 
        ref={quickAvatarFileRef} 
        accept="image/*" 
        onChange={handleQuickAvatarUpload} 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={quickCoverFileRef} 
        accept="image/*" 
        onChange={handleQuickCoverUpload} 
        className="hidden" 
      />
      
      {/* Loading skeleton toàn trang khi đang tải profile */}
      {isLoadingProfile && (
        <div className="bg-white border-b border-slate-200/80 shadow-2xs">
          <div className="w-full max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-64 sm:h-80 md:h-[420px] w-full rounded-b-2xl bg-slate-200 animate-pulse" />
            <div className="flex items-end gap-5 pb-6 pt-0 px-4 mt-[-4rem]">
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-slate-300 animate-pulse ring-4 ring-white" />
              <div className="space-y-3 mb-4">
                <div className="h-8 w-48 bg-slate-300 rounded-xl animate-pulse" />
                <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thanh điều hướng Quay lại Bảng tin / Trang trước */}
      <div className="bg-white/85 backdrop-blur-xs border-b border-slate-200/70 py-2.5 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[1440px] 2xl:max-w-[1600px] mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.hash = '#home';
              }
            }}
            className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-blue-600 bg-white hover:bg-slate-50 border border-slate-200/90 px-3.5 py-1.5 rounded-xl transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600" />
            <span>{isOwnProfile ? 'Quay lại Bảng tin Trang chủ' : 'Quay lại trang trước'}</span>
          </button>
          {!isOwnProfile && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 truncate">
              <Eye className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="truncate">Đang xem hồ sơ của <strong className="text-slate-900 font-extrabold">{activeUser.name || activeUser.full_name}</strong> (Chế độ xem công khai)</span>
            </div>
          )}
        </div>
      </div>

      {/* ================= PHẦN TRÊN: HEADER TRANG CÁ NHÂN (CHUẨN FACEBOOK) ================= */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs">
        <div className="w-full max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Ảnh bìa (Cover photo) */}
          <div className="relative h-64 sm:h-80 md:h-[420px] w-full rounded-b-2xl sm:rounded-b-3xl overflow-hidden bg-slate-200 shadow-inner group">
            <img 
              src={activeUser.cover || activeUser.coverImage || activeUser.cover_url || DEFAULT_COVER} 
              alt="Cover" 
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setLightboxImage(activeUser.cover || activeUser.coverImage || activeUser.cover_url || DEFAULT_COVER)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
            {isOwnProfile && (
              <button 
                onClick={() => quickCoverFileRef.current?.click()}
                disabled={isQuickUploading}
                className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/95 hover:bg-white text-slate-800 text-xs sm:text-sm font-semibold rounded-xl shadow-md transition duration-150 backdrop-blur-xs cursor-pointer z-10 disabled:opacity-50"
                title="Chọn ảnh bìa từ máy tính để tải lên Cloudinary"
              >
                {isQuickUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Đang tải lên Cloudinary...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span>Chỉnh sửa ảnh bìa</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Hàng thông tin Avatar + Tên + Nút hành động */}
          <div className="flex flex-col md:flex-row md:items-end justify-between pb-6 pt-0 gap-4 px-2 sm:px-4">
            
            {/* Cụm Avatar và Họ tên */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left z-10">
              
              {/* Avatar nổi lên trên ảnh bìa */}
              <div className="relative group shrink-0 -mt-20 sm:-mt-28">
                <img 
                  src={activeUser.avatar || activeUser.avatar_url || DEFAULT_AVATAR} 
                  alt={activeUser.name || activeUser.full_name} 
                  className="w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover ring-4 ring-white shadow-xl bg-white cursor-pointer"
                  onClick={() => setLightboxImage(activeUser.avatar || activeUser.avatar_url || DEFAULT_AVATAR)}
                />
                {isOwnProfile && (
                  <button 
                    onClick={() => quickAvatarFileRef.current?.click()}
                    disabled={isQuickUploading}
                    className="absolute bottom-2 right-2 p-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-full shadow-md border-2 border-white transition cursor-pointer disabled:opacity-50"
                    title="Chọn ảnh đại diện từ máy tính để tải lên Cloudinary"
                  >
                    {isQuickUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    ) : (
                      <Camera className="w-5 h-5 text-blue-600" />
                    )}
                  </button>
                )}
              </div>

              {/* Tên & Bạn bè & Nơi ở */}
              <div className="space-y-1.5 mb-2 mt-2 sm:mt-6">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {activeUser.name || activeUser.full_name}
                  </h1>
                  {(activeUser.isVerified || activeUser.is_verified) && (
                    <VerifiedBadge size="md" />
                  )}
                </div>

                <p 
                  onClick={() => setActiveTab('friends')}
                  className="text-sm font-semibold text-slate-500 hover:text-blue-600 cursor-pointer transition inline-block"
                >
                  {activeUser.friendsCount ?? profileFriends.length} người bạn
                </p>
                {/* Trust Score Badge - chỉ hiện với chính chủ */}
                {isOwnProfile && currentUser && (() => {
                  const score = profileData?.trustScore ?? activeUser?.trustScore ?? 100;
                  const tier = profileData?.trustTier ?? activeUser?.trustTier ?? 'good';
                  const badgeStyle = {
                    good:       { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500', label: 'Xuất sắc' },
                    fair:       { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    bar: 'bg-blue-500',    label: 'Tốt' },
                    warning:    { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   bar: 'bg-amber-500',   label: 'Cảnh báo' },
                    restricted: { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    bar: 'bg-rose-500',    label: 'Hạn chế' },
                  }[tier] || { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500', label: 'Xuất sắc' };
                  return (
                    <div className={`inline-flex flex-col gap-1 px-3 py-2 rounded-xl border ${badgeStyle.bg} ${badgeStyle.border} text-xs mt-1`}>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={`w-3.5 h-3.5 ${badgeStyle.text}`} />
                        <span className={`font-bold ${badgeStyle.text}`}>Điểm uy tín: {score}/100</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeStyle.bg} ${badgeStyle.text} border ${badgeStyle.border}`}>{badgeStyle.label}</span>
                        {trustHistory.length > 0 && (
                          <button
                            onClick={() => setShowTrustHistory(prev => !prev)}
                            className={`ml-1 text-[10px] underline underline-offset-2 cursor-pointer ${badgeStyle.text} hover:opacity-70 transition`}
                          >
                            {showTrustHistory ? 'Ẩn lịch sử' : 'Xem lịch sử'}
                          </button>
                        )}
                      </div>
                      <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${badgeStyle.bar}`} style={{ width: `${score}%` }} />
                      </div>
                      {showTrustHistory && trustHistory.length > 0 && (
                        <div className="mt-1 space-y-0.5 max-h-28 overflow-y-auto">
                          {trustHistory.slice(0, 8).map((log, i) => (
                            <div key={i} className={`flex items-center justify-between text-[10px] ${badgeStyle.text}`}>
                              <span className="truncate max-w-[160px]" title={log.reason}>{log.reason || log.action_type}</span>
                              <span className="font-bold shrink-0 ml-1">{log.delta > 0 ? '+' : ''}{log.delta} đ</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}


                {/* Tóm tắt địa điểm & trường học */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-slate-600 pt-0.5">
                  {activeUser.location && (
                    <span className="flex items-center gap-1 font-medium bg-slate-100 px-2.5 py-1 rounded-lg">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {activeUser.location}
                    </span>
                  )}
                  {(activeUser.highSchool || activeUser.high_school) && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1 font-medium bg-slate-100 px-2.5 py-1 rounded-lg">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                        {activeUser.highSchool || activeUser.high_school}
                      </span>
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* Các nút hành động bên phải */}
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-2.5 pb-2">
              {friendActionToast && (
                <div className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl animate-fadeIn">
                  {friendActionToast}
                </div>
              )}

              {isOwnProfile ? (
                <button 
                  onClick={() => setIsEditProfileOpen(true)}
                  className="flex items-center gap-1.5 px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition duration-150 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Chỉnh sửa trang cá nhân</span>
                </button>
              ) : (
                <>
                  {/* Nút Trạng thái Kết bạn */}
                  {friendshipStatus === 'friends' && (
                    <button 
                      onClick={handleUnfriend}
                      disabled={isFriendActionLoading}
                      title="Bấm để hủy kết bạn"
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-rose-50 hover:text-rose-600 border border-emerald-200 hover:border-rose-200 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Bạn bè</span>
                    </button>
                  )}

                  {friendshipStatus === 'pending_sent' && (
                    <button 
                      onClick={handleCancelFriendRequest}
                      disabled={isFriendActionLoading}
                      title="Bấm để thu hồi lời mời kết bạn"
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer"
                    >
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>Đã gửi lời mời</span>
                    </button>
                  )}

                  {friendshipStatus === 'pending_received' && (
                    <button 
                      onClick={handleAcceptFriendRequest}
                      disabled={isFriendActionLoading}
                      className="flex items-center gap-1.5 px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer"
                    >
                      {isFriendActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                      <span>Chấp nhận kết bạn</span>
                    </button>
                  )}

                  {(friendshipStatus === 'none' || !friendshipStatus) && (
                    <button 
                      onClick={handleSendFriendRequest}
                      disabled={isFriendActionLoading}
                      className="flex items-center gap-1.5 px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer"
                    >
                      {isFriendActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      <span>Thêm bạn bè</span>
                    </button>
                  )}

                  {/* Nút Nhắn tin */}
                  <button 
                    onClick={() => {
                      if (!currentUser) {
                        onRequireAuth ? onRequireAuth("Vui lòng đăng nhập để sử dụng tính năng nhắn tin") : alert("Vui lòng đăng nhập để nhắn tin");
                      } else {
                        onOpenChat && onOpenChat({
                          id: activeUser.id || targetUserId,
                          name: activeUser.name || activeUser.full_name,
                          username: activeUser.username,
                          avatar: activeUser.avatar || activeUser.avatar_url
                        });
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 text-xs sm:text-sm font-bold rounded-xl transition duration-150 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Nhắn tin</span>
                  </button>
                </>
              )}

              {onOpenSettings && (
                <button 
                  onClick={onOpenSettings}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-xl transition duration-150 cursor-pointer border border-slate-200"
                >
                  <Settings className="w-4 h-4 text-blue-600" />
                  <span>Cài đặt & An toàn</span>
                </button>
              )}

              <button 
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  alert("Đã sao chép liên kết trang cá nhân!");
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-xl transition duration-150 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Chia sẻ trang</span>
              </button>

              <button className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition cursor-pointer">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

          </div>

          {/* Đường gạch ngang phân cách */}
          <div className="h-px bg-slate-200 w-full" />

          {/* Thanh Tab điều hướng cá nhân */}
          <div className="flex items-center justify-between overflow-x-auto text-xs sm:text-sm font-bold text-slate-600">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-3.5 px-4 border-b-4 transition cursor-pointer ${
                  activeTab === 'all' 
                    ? 'border-blue-600 text-blue-600 font-extrabold' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                Tất cả
              </button>

              <button
                onClick={() => setActiveTab('about')}
                className={`py-3.5 px-4 border-b-4 transition cursor-pointer ${
                  activeTab === 'about' 
                    ? 'border-blue-600 text-blue-600 font-extrabold' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                Giới thiệu
              </button>

              <button
                onClick={() => setActiveTab('friends')}
                className={`py-3.5 px-4 border-b-4 transition cursor-pointer ${
                  activeTab === 'friends' 
                    ? 'border-blue-600 text-blue-600 font-extrabold' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                Bạn bè ({profileFriends.length})
              </button>

              <button
                onClick={() => setActiveTab('photos')}
                className={`py-3.5 px-4 border-b-4 transition cursor-pointer ${
                  activeTab === 'photos' 
                    ? 'border-blue-600 text-blue-600 font-extrabold' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                Ảnh ({displayPhotos.length})
              </button>

              <button
                onClick={() => setActiveTab('reels')}
                className={`py-3.5 px-4 border-b-4 transition cursor-pointer ${
                  activeTab === 'reels' 
                    ? 'border-blue-600 text-blue-600 font-extrabold' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                Reels
              </button>
            </div>
          </div>

        </div>
      </div>


      {/* ================= PHẦN NỘI DUNG CHÍNH (THEO TAB ĐƯỢC CHỌN) ================= */}
      <div className="w-full max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
        {/* ── TAB 1: TẤT CẢ (CHUẨN 2 CỘT FACEBOOK) ────────────────── */}
        {activeTab === 'all' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
            
            {/* CỘT TRÁI (THÔNG TIN CÁ NHÂN & ẢNH & BẠN BÈ TỪ DB) */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
              
              {/* Box 1: Thông tin cá nhân */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900">Thông tin cá nhân</h2>
                  {isOwnProfile && (
                    <button 
                      onClick={() => setIsEditProfileOpen(true)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                      title="Chỉnh sửa chi tiết"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Bio từ DB */}
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {activeUser.bio || <span className="text-slate-400 italic">Chưa có giới thiệu bản thân</span>}
                </p>

                {/* Danh sách thông tin chi tiết */}
                <div className="space-y-3 pt-2 text-xs sm:text-sm text-slate-700">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-slate-500 shrink-0" />
                    <span>Sống ở <strong>{activeUser.location || 'Chưa cập nhật'}</strong></span>
                  </div>

                  <div className="flex items-center gap-3">
                    <HomeIcon className="w-5 h-5 text-slate-500 shrink-0" />
                    <span>Từ <strong>{activeUser.hometown || 'Chưa cập nhật'}</strong></span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Heart className="w-5 h-5 text-rose-500 shrink-0" />
                    <span>
                      Tình trạng: <strong>{activeUser.relationship || activeUser.relationship_status || 'Chưa cập nhật'}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-slate-500 shrink-0" />
                    <span>Làm việc tại <strong>TechVN</strong></span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-500 shrink-0" />
                    <span>Tham gia từ {activeUser.joinedDate || 'Tháng 10, 2026'}</span>
                  </div>
                </div>

                {/* Nút hành động */}
                {isOwnProfile && (
                  <div className="pt-2 space-y-2">
                    <button 
                      onClick={() => setIsEditProfileOpen(true)}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Chỉnh sửa chi tiết</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Box 2: Giáo dục */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900">Giáo dục</h2>
                  {isOwnProfile && (
                    <button 
                      onClick={() => setIsEditProfileOpen(true)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                    <GraduationCap className="w-6 h-6 text-slate-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{activeUser.highSchool || activeUser.high_school || 'Chưa cập nhật'}</h4>
                    <p className="text-xs text-slate-400">Trường cấp 3</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-200">
                    <GraduationCap className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{activeUser.education || 'Chưa cập nhật'}</h4>
                    <p className="text-xs text-slate-400">Đại học / Chuyên ngành</p>
                  </div>
                </div>
              </div>

              {/* Box 3: Ảnh (Lấy từ bài viết thực tế trong DB) */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">Ảnh</h2>
                    <p className="text-xs text-slate-400">{displayPhotos.length} ảnh</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('photos')}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Xem tất cả ảnh
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 rounded-xl overflow-hidden">
                  {displayPhotos.slice(0, 9).map((img, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setLightboxImage(img)}
                      className="aspect-square bg-slate-100 overflow-hidden cursor-pointer group relative"
                    >
                      <img 
                        src={img} 
                        alt={`Photo ${idx}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <Eye className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 4: Bạn bè (Lấy từ bảng friendships trong DB) */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">Bạn bè</h2>
                    <p className="text-xs text-slate-400 font-medium">{activeUser.friendsCount ?? profileFriends.length} người bạn</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('friends')}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Xem tất cả bạn bè
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {profileFriends.length > 0 ? profileFriends.slice(0, 6).map((friend) => (
                    <div 
                      key={friend.id} 
                      onClick={() => onOpenUserProfile && onOpenUserProfile(friend)}
                      className="cursor-pointer group text-left"
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 shadow-2xs mb-1">
                        <img 
                          src={friend.avatar || friend.avatar_url} 
                          alt={friend.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                      </div>
                      <p className="text-[11px] font-bold text-slate-800 truncate group-hover:text-blue-600">
                        {friend.name}
                      </p>
                    </div>
                  )) : (
                    <div className="col-span-3 py-4 text-center text-xs text-slate-400">Chưa có bạn bè nào</div>
                  )}
                </div>
              </div>

            </div>


            {/* CỘT PHẢI (BẠN ĐANG NGHĨ GÌ? & BÀI VIẾT TỪ DB) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
              


              {/* Ô đăng bài viết trực tiếp trên trang cá nhân của chính mình */}
              {isOwnProfile && (
                <div className="mb-4">
                  <CreatePostCard
                    currentUser={currentUser}
                    onAddPost={(newPost, cooldown) => {
                      if (newPost) {
                        setProfilePosts(prev => prev ? [newPost, ...prev] : [newPost]);
                        onAddPost && onAddPost(newPost, cooldown);
                      }
                    }}
                    onRequireAuth={onRequireAuth}
                    onRequireLogin={onRequireAuth}
                  />
                </div>
              )}

              {/* Box 2: Header "Bài viết" & Chuyển đổi Danh sách / Lưới */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-slate-900">Bài viết ({userPosts.length})</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => alert("Mở bộ lọc bài viết")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Bộ lọc</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center border-t border-slate-100 pt-2 text-xs font-bold text-slate-600">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 border-b-2 transition cursor-pointer ${
                      viewMode === 'list' 
                        ? 'border-blue-600 text-blue-600 font-extrabold' 
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    <span>Chế độ xem danh sách</span>
                  </button>

                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 border-b-2 transition cursor-pointer ${
                      viewMode === 'grid' 
                        ? 'border-blue-600 text-blue-600 font-extrabold' 
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                    <span>Chế độ xem lưới</span>
                  </button>
                </div>
              </div>

              {/* Box 3: DANH SÁCH BÀI VIẾT THỰC TẾ TỪ DATABASE */}
              {isLoadingPosts ? (
                <div className="space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
                        <div className="space-y-2">
                          <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                          <div className="h-2 w-20 bg-slate-100 rounded animate-pulse" />
                        </div>
                      </div>
                      <div className="h-3 w-full bg-slate-200 rounded animate-pulse" />
                      <div className="h-48 w-full bg-slate-200 rounded-xl animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : viewMode === 'list' ? (
                <div className="space-y-4">
                  {userPosts.length > 0 ? (
                    userPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        currentUser={currentUser}
                        onToggleLike={onToggleLike}
                        onAddComment={onAddComment}
                        onOpenReportModal={onOpenReportModal}
                        onOpenAppealModal={onOpenAppealModal}
                        onRequireAuth={onRequireAuth}
                        onRequireLogin={onRequireAuth}
                        onOpenProfile={onOpenUserProfile}
                        onEditPost={onEditPost}
                        onUpdatePost={handleProfilePostUpdate}
                        onDeletePost={onDeletePost}
                        onSharePost={onSharePost}
                        allPosts={posts}
                      />
                    ))
                  ) : (
                    <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-400">
                      <p className="text-sm font-semibold">Chưa có bài viết nào.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Chế độ xem lưới */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {userPosts.map(post => (
                    <div 
                      key={post.id} 
                      onClick={() => (post.image || post.image_url) && setLightboxImage(post.image || post.image_url)}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs cursor-pointer group"
                    >
                      {post.image || post.image_url ? (
                        <div className="aspect-square overflow-hidden bg-slate-100 relative">
                          {shouldHideContentForViewer({
                            isAuthor: Boolean(currentUser?.id && String(currentUser.id) === String(post.author_id || post.author?.id)),
                            status: post.imageModeration?.status || post.image_moderation_status,
                            isSensitive: ['sensitive', 'rejected_hold', 'rejected_admin', 'pending_review', 'appeal_pending'].includes(post.imageModeration?.status || post.image_moderation_status),
                          }) && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900/60 text-center text-white">
                              <span className="text-xs font-semibold">Nội dung nhạy cảm</span>
                              <span className="rounded bg-white/20 px-3 py-1 text-[10px] font-semibold">Xem</span>
                            </div>
                          )}
                          <img 
                            src={post.image || post.image_url} 
                            alt="Thumb" 
                            className={`w-full h-full object-cover group-hover:scale-105 transition duration-200 ${shouldHideContentForViewer({
                              isAuthor: Boolean(currentUser?.id && String(currentUser.id) === String(post.author_id || post.author?.id)),
                              status: post.imageModeration?.status || post.image_moderation_status,
                              isSensitive: ['sensitive', 'rejected_hold', 'rejected_admin', 'pending_review', 'appeal_pending'].includes(post.imageModeration?.status || post.image_moderation_status),
                            }) ? 'blur-xl scale-105' : ''}`}
                          />
                        </div>
                      ) : (
                        <div className="p-4 h-36 flex items-center justify-center text-xs text-slate-600 bg-slate-50 italic text-center">
                          "{post.content.slice(0, 70)}..."
                        </div>
                      )}
                      {String(currentUser?.id) === String(post.author_id || post.author?.id)
                        && (post.imageModeration?.status || post.image_moderation_status) === 'sensitive' && (
                        <div className="px-2 py-1.5 border-t border-amber-200 bg-amber-50 text-[10px] leading-snug text-amber-900">
                          {post.imageModeration?.noticeText || getModerationNoticeText('post', 'sensitive')}
                        </div>
                      )}
                      <div className="p-2 text-[11px] font-semibold text-slate-600 truncate border-t border-slate-100">
                        {post.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>

          </div>
        )}

        {/* ── TAB 2: GIỚI THIỆU (ABOUT VIEW CHUẨN FACEBOOK) ────────── */}
        {activeTab === 'about' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
              
              {/* Menu danh mục Giới thiệu bên trái */}
              <div className="md:col-span-4 border-r border-slate-100 p-4 space-y-1 bg-slate-50/50">
                <h3 className="text-lg font-black text-slate-900 px-3 py-2">Giới thiệu</h3>
                
                {[
                  { id: 'overview', label: 'Tổng quan' },
                  { id: 'work_edu', label: 'Công việc và học vấn' },
                  { id: 'places', label: 'Nơi từng sống' },
                  { id: 'contact', label: 'Thông tin liên hệ và cơ bản' },
                  { id: 'family', label: 'Gia đình và các mối quan hệ' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setAboutSubTab(item.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-between ${
                      aboutSubTab === item.id
                        ? 'bg-blue-50 text-blue-600 font-extrabold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Chi tiết nội dung Giới thiệu bên phải */}
              <div className="md:col-span-8 p-6 space-y-6">
                
                {/* 1. Tổng quan */}
                {aboutSubTab === 'overview' && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="text-base font-black text-slate-900">Tổng quan thông tin</h4>
                      {isOwnProfile && (
                        <button 
                          onClick={() => setIsEditProfileOpen(true)}
                          className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Briefcase className="w-5 h-5 text-slate-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Làm việc tại <strong>TechVN</strong></p>
                          <p className="text-xs text-slate-400">Kỹ sư phần mềm & Kiểm duyệt nội dung AI</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <GraduationCap className="w-5 h-5 text-slate-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {activeUser.education ? <>Từng học tại <strong>{activeUser.education}</strong></> : 'Chưa cập nhật trường đại học'}
                          </p>
                          <p className="text-xs text-slate-400">Đại học / Chuyên ngành</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <GraduationCap className="w-5 h-5 text-slate-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {activeUser.highSchool || activeUser.high_school ? <>Từng học tại <strong>{activeUser.highSchool || activeUser.high_school}</strong></> : 'Chưa cập nhật trường cấp 3'}
                          </p>
                          <p className="text-xs text-slate-400">Trường THPT</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-slate-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {activeUser.location ? <>Sống tại <strong>{activeUser.location}</strong></> : 'Chưa cập nhật nơi ở'}
                          </p>
                          <p className="text-xs text-slate-400">Nơi ở hiện tại</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <HomeIcon className="w-5 h-5 text-slate-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {activeUser.hometown ? <>Đến từ <strong>{activeUser.hometown}</strong></> : 'Chưa cập nhật quê quán'}
                          </p>
                          <p className="text-xs text-slate-400">Quê quán</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Heart className="w-5 h-5 text-rose-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            Tình trạng mối quan hệ: <strong>{activeUser.relationship || activeUser.relationship_status || 'Chưa cập nhật'}</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Công việc và học vấn */}
                {aboutSubTab === 'work_edu' && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="text-base font-black text-slate-900">Công việc và học vấn</h4>
                      {isOwnProfile && (
                        <button 
                          onClick={() => setIsEditProfileOpen(true)}
                          className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                        <span className="text-xs font-bold text-blue-600">Nơi làm việc</span>
                        <h5 className="text-sm font-extrabold text-slate-900">TechVN Corporation</h5>
                        <p className="text-xs text-slate-500">Kỹ sư hệ thống & Phát triển mô hình mạng xã hội</p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                        <span className="text-xs font-bold text-blue-600">Đại học</span>
                        <h5 className="text-sm font-extrabold text-slate-900">{activeUser.education || 'Chưa cập nhật'}</h5>
                        <p className="text-xs text-slate-500">Chuyên ngành Công nghệ thông tin</p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                        <span className="text-xs font-bold text-blue-600">Trường THPT</span>
                        <h5 className="text-sm font-extrabold text-slate-900">{activeUser.highSchool || activeUser.high_school || 'Chưa cập nhật'}</h5>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Nơi từng sống */}
                {aboutSubTab === 'places' && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="text-base font-black text-slate-900">Nơi từng sống</h4>
                      {isOwnProfile && (
                        <button 
                          onClick={() => setIsEditProfileOpen(true)}
                          className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <MapPin className="w-6 h-6 text-blue-600 mt-1" />
                        <div>
                          <h5 className="text-sm font-extrabold text-slate-900">{activeUser.location || 'Chưa cập nhật'}</h5>
                          <p className="text-xs text-slate-400">Thành phố hiện tại</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <HomeIcon className="w-6 h-6 text-indigo-600 mt-1" />
                        <div>
                          <h5 className="text-sm font-extrabold text-slate-900">{activeUser.hometown || 'Chưa cập nhật'}</h5>
                          <p className="text-xs text-slate-400">Quê quán</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Thông tin liên hệ và cơ bản */}
                {aboutSubTab === 'contact' && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="text-base font-black text-slate-900">Thông tin liên hệ & Cơ bản</h4>
                    </div>

                    <div className="space-y-3.5 text-xs sm:text-sm text-slate-700">
                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="font-semibold text-slate-500">Tên người dùng</span>
                        <span className="font-bold text-slate-900">@{activeUser.username}</span>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="font-semibold text-slate-500">Email</span>
                        <span className="font-bold text-slate-900">{activeUser.email || `${activeUser.username}@example.com`}</span>
                      </div>

                      {activeUser.phone && (
                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                          <span className="font-semibold text-slate-500">Số điện thoại</span>
                          <span className="font-bold text-slate-900 font-mono">{activeUser.phone}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="font-semibold text-slate-500">Ngày tham gia hệ thống</span>
                        <span className="font-bold text-slate-900">{activeUser.joinedDate || 'Tháng 10, 2026'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Gia đình và các mối quan hệ */}
                {aboutSubTab === 'family' && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="text-base font-black text-slate-900">Mối quan hệ</h4>
                      {isOwnProfile && (
                        <button 
                          onClick={() => setIsEditProfileOpen(true)}
                          className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa</span>
                        </button>
                      )}
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
                        <Heart className="w-6 h-6" />
                      </div>
                      <div>
                        <h5 className="text-sm font-extrabold text-slate-900">{activeUser.relationship || activeUser.relationship_status || 'Độc thân'}</h5>
                        <p className="text-xs text-slate-400">Tình trạng mối quan hệ</p>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: BẠN BÈ (FRIENDS VIEW TỪ DATABASE) ─────────────── */}
        {activeTab === 'friends' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Bạn bè</h3>
                <p className="text-xs text-slate-500 font-medium">{profileFriends.length} người bạn trong cơ sở dữ liệu</p>
              </div>

              {/* Ô tìm kiếm bạn bè */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={friendsSearchQuery}
                  onChange={(e) => setFriendsSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm bạn bè..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-100 focus:bg-white border border-transparent focus:border-blue-400 rounded-xl outline-none transition"
                />
              </div>
            </div>

            {/* Lưới danh sách bạn bè */}
            {filteredFriends.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFriends.map((friend) => (
                  <div 
                    key={friend.id} 
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 transition group"
                  >
                    <div 
                      onClick={() => onOpenUserProfile && onOpenUserProfile(friend)}
                      className="flex items-center gap-3 cursor-pointer min-w-0"
                    >
                      <img 
                        src={friend.avatar || friend.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"} 
                        alt={friend.name} 
                        className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white shrink-0 shadow-2xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate group-hover:text-blue-600">
                            {friend.name}
                          </h4>
                          {(friend.isVerified || friend.is_verified) && (
                            <VerifiedBadge size="xs" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">@{friend.username}</p>
                        {friend.bio && (
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{friend.bio}</p>
                        )}
                      </div>
                    </div>

                    {/* Nút hành động với bạn bè */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onOpenChat && onOpenChat(friend)}
                        title="Nhắn tin"
                        className="p-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl transition cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onOpenUserProfile && onOpenUserProfile(friend)}
                        title="Xem trang cá nhân"
                        className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm font-semibold">
                  {friendsSearchQuery ? "Không tìm thấy người bạn nào phù hợp" : "Chưa có bạn bè nào trong danh sách"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: ẢNH (PHOTOS VIEW TỪ BÀI VIẾT DATABASE) ────────── */}
        {activeTab === 'photos' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Ảnh của bạn</h3>
                <p className="text-xs text-slate-500 font-medium">Toàn bộ ảnh được tải lên từ các bài viết trong cơ sở dữ liệu</p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
                {displayPhotos.length} ảnh
              </span>
            </div>

            {/* Lưới ảnh */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {displayPhotos.map((img, idx) => (
                <div 
                  key={idx}
                  onClick={() => setLightboxImage(img)}
                  className="aspect-square rounded-2xl overflow-hidden bg-slate-100 cursor-pointer group relative shadow-2xs"
                >
                  <img 
                    src={img} 
                    alt={`Photo gallery ${idx}`} 
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center text-white">
                    <Eye className="w-6 h-6 drop-shadow-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 5: REELS (THƯỚC PHIM NGẮN) ───────────────────────── */}
        {activeTab === 'reels' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Video className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-slate-900">Chưa có thước phim Reels nào</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Các video và thước phim ngắn bạn chia sẻ sẽ xuất hiện ở đây để bạn bè cùng theo dõi.
            </p>
          </div>
        )}

      </div>

      {/* ================= MODAL CHỈNH SỬA TRANG CÁ NHÂN ================= */}
      <EditProfileModal
        isOpen={isEditProfileOpen && isOwnProfile}
        onClose={() => setIsEditProfileOpen(false)}
        initialData={activeUser}
        onSave={handleSaveProfileModal}
        isSaving={isSavingProfile}
        successMsg={saveSuccessMsg}
      />

      {/* ================= MODAL XEM ẢNH PHÓNG TO (LIGHTBOX) ================= */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={lightboxImage} 
            alt="Full Preview"
            onClick={(e) => e.stopPropagation()} 
            className="max-h-[88vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}

      {/* ================= MODAL CHIA SẺ BÀI VIẾT ================= */}
      {sharingPost && (
        <SharePostModal
          post={sharingPost}
          currentUser={currentUser}
          onConfirm={handleConfirmShare}
          onClose={() => setSharingPost(null)}
        />
      )}

      {/* ================= MODAL XEM BÀI VIẾT GỐC ================= */}
      {viewingOriginalPost && (
        <OriginalPostModal
          post={viewingOriginalPost}
          isOpen={Boolean(viewingOriginalPost)}
          onClose={() => setViewingOriginalPost(null)}
          currentUser={currentUser}
          onOpenProfile={onOpenUserProfile}
          onOpenLightbox={setLightboxImage}
          onRequireAuth={onRequireAuth}
          allPosts={[...(profilePosts || []), ...(posts || [])]}
        />
      )}

    </div>
  );
}

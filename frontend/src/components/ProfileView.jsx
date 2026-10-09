import { useState } from 'react';
import { 
  Camera, Edit2, MoreHorizontal, MapPin, Home as HomeIcon, 
  Heart, GraduationCap, Briefcase, Calendar, Image as ImageIcon, 
  Video, Flag, SlidersHorizontal, Settings2, List, Grid3X3, 
  Share2, CheckCircle2, Globe, Lock,
  MessageCircle, Send, ThumbsUp
} from 'lucide-react';
import { suggestedFriends } from '../data/mockData';

const REACTIONS = [
  { id: 'like', label: 'Thích', emoji: '👍', color: 'text-blue-600' },
  { id: 'love', label: 'Yêu thích', emoji: '❤️', color: 'text-rose-600' },
  { id: 'wow', label: 'Ngạc nhiên', emoji: '😮', color: 'text-amber-500' },
  { id: 'sad', label: 'Buồn', emoji: '😢', color: 'text-amber-600' },
  { id: 'angry', label: 'Phẫn nộ', emoji: '😡', color: 'text-orange-600' },
];

export default function ProfileView({ 
  currentUser, 
  posts, 
  onAddPost, 
  onToggleLike, 
  onAddComment,
  onUpdateUser
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'about' | 'friends' | 'photos' | 'reels'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState(currentUser.bio || '');
  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [profileReactions, setProfileReactions] = useState({});
  const [hoverReactionPostId, setHoverReactionPostId] = useState(null);

  const handleSelectProfileReaction = (postId, reactionId) => {
    setProfileReactions(prev => ({
      ...prev,
      [postId]: prev[postId] === reactionId ? null : reactionId
    }));
    setHoverReactionPostId(null);
    onToggleLike(postId);
  };

  // Lấy các bài viết của chính người dùng này
  const userPosts = posts.filter(post => post.author.id === currentUser.id);

  // Bộ sưu tập 9 ảnh mẫu cho mục "Ảnh"
  const photoGrid = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80"
  ];

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

    onAddPost(newPost);
    setNewPostText('');
    setNewPostImage('');
    setShowImageInput(false);
  };

  const handleSaveBio = () => {
    if (onUpdateUser) {
      onUpdateUser({ bio: bioInput });
    }
    setIsEditingBio(false);
  };

  const handleCommentSubmit = (postId, e) => {
    e.preventDefault();
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    const newId = `cmt-${postId}-${(text || '').length}`;
    onAddComment(postId, {
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

  return (
    <div className="bg-slate-100 min-h-screen pb-16">
      
      {/* ================= PHẦN TRÊN: HEADER TRANG CÁ NHÂN (CHUẨN FACEBOOK) ================= */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs">
        <div className="w-full max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Ảnh bìa (Cover photo) */}
          <div className="relative h-64 sm:h-80 md:h-[420px] w-full rounded-b-2xl sm:rounded-b-3xl overflow-hidden bg-slate-200 shadow-inner">
            <img 
              src={currentUser.coverImage} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <button 
              onClick={() => alert("Chức năng thay đổi ảnh bìa")}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl shadow-md transition duration-150 backdrop-blur-xs"
            >
              <Camera className="w-4 h-4" />
              <span>Chỉnh sửa ảnh bìa</span>
            </button>
          </div>

          {/* Hàng thông tin Avatar + Tên + Nút hành động */}
          <div className="flex flex-col md:flex-row md:items-end justify-between pb-6 pt-0 gap-4 px-2 sm:px-4">
            
            {/* Cụm Avatar và Họ tên */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left z-10">
              
              {/* Chỉ Avatar mới có negative margin để nổi lên trên ảnh bìa */}
              <div className="relative group shrink-0 -mt-20 sm:-mt-28">
                <img 
                  src={currentUser.avatar} 
                  alt={currentUser.name} 
                  className="w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover ring-4 ring-white shadow-xl bg-white"
                />
                <button 
                  onClick={() => alert("Chức năng đổi ảnh đại diện")}
                  className="absolute bottom-2 right-2 p-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-full shadow-md border-2 border-white transition"
                  title="Cập nhật ảnh đại diện"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>

              {/* Tên & Số người bạn & Nơi ở: Nằm hoàn toàn ở phần nền trắng bên dưới, tách bạch rõ ràng */}
              <div className="space-y-1.5 mb-2 mt-2 sm:mt-6">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {currentUser.name}
                  </h1>
                  {currentUser.isVerified && (
                    <CheckCircle2 className="w-5 h-5 text-blue-500 fill-blue-500 shrink-0" />
                  )}
                </div>

                <p className="text-sm font-semibold text-slate-500">
                  {currentUser.friendsCount || 309} người bạn
                </p>

                {/* Dòng tóm tắt địa điểm & trường học như trên Facebook */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-slate-600 pt-0.5">
                  <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {currentUser.location || "Vũng Tàu"}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                    {currentUser.highSchool || "Trường THPT Hòa Hội"}
                  </span>
                </div>
              </div>

            </div>

            {/* Các nút hành động bên phải */}
            <div className="flex items-center justify-center sm:justify-end gap-2.5 pb-2">
              <button 
                onClick={() => setIsEditingBio(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition duration-150"
              >
                <Edit2 className="w-4 h-4" />
                <span>Chỉnh sửa trang cá nhân</span>
              </button>

              <button 
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  alert("Đã sao chép liên kết trang cá nhân!");
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-300/80 text-slate-800 text-xs sm:text-sm font-bold rounded-xl transition duration-150"
              >
                <Share2 className="w-4 h-4" />
                <span>Chia sẻ trang</span>
              </button>

              <button className="p-2 bg-slate-200 hover:bg-slate-300/80 text-slate-800 rounded-xl transition">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

          </div>

          {/* Đường gạch ngang phân cách */}
          <div className="h-px bg-slate-200 w-full" />

          {/* Thanh Tab điều hướng cá nhân (Tất cả, Giới thiệu, Bạn bè, Ảnh,...) */}
          <div className="flex items-center justify-between overflow-x-auto text-xs sm:text-sm font-bold text-slate-600">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-3.5 px-4 border-b-4 transition ${
                  activeTab === 'all' 
                    ? 'border-blue-600 text-blue-600 font-extrabold' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                Tất cả
              </button>

              <button
                onClick={() => setActiveTab('about')}
                className={`py-3.5 px-4 border-b-4 transition ${
                  activeTab === 'about' 
                    ? 'border-blue-600 text-blue-600 font-extrabold' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                Giới thiệu
              </button>

              <button
                onClick={() => setActiveTab('friends')}
                className={`py-3.5 px-4 border-b-4 transition ${
                  activeTab === 'friends' 
                    ? 'border-blue-600 text-blue-600 font-extrabold' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                Bạn bè
              </button>

              <button
                onClick={() => setActiveTab('photos')}
                className={`py-3.5 px-4 border-b-4 transition ${
                  activeTab === 'photos' 
                    ? 'border-blue-600 text-blue-600 font-extrabold' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                Ảnh
              </button>

              <button
                onClick={() => setActiveTab('reels')}
                className={`py-3.5 px-4 border-b-4 transition ${
                  activeTab === 'reels' 
                    ? 'border-blue-600 text-blue-600 font-extrabold' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                Reels
              </button>

              <button className="py-3.5 px-4 border-b-4 border-transparent hover:bg-slate-50 flex items-center gap-1">
                <span>Xem thêm</span>
                <span className="text-[10px]">▼</span>
              </button>
            </div>

            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>


      {/* ================= PHẦN DƯỚI: NỘI DUNG 2 CỘT (CHUẨN FACEBOOK) ================= */}
      <div className="w-full max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          
          {/* ================= CỘT TRÁI (THÔNG TIN CÁ NHÂN & ẢNH & BẠN BÈ) ================= */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            
            {/* Box 1: Thông tin cá nhân */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900">Thông tin cá nhân</h2>
                <button 
                  onClick={() => setIsEditingBio(!isEditingBio)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                  title="Chỉnh sửa tiểu sử"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Bio */}
              {isEditingBio ? (
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <textarea
                    rows={3}
                    value={bioInput}
                    onChange={(e) => setBioInput(e.target.value)}
                    className="w-full text-xs p-2 bg-white border rounded-lg outline-none focus:border-blue-500"
                    placeholder="Mô tả bản thân..."
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setIsEditingBio(false)}
                      className="px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-200 rounded-lg"
                    >
                      Hủy
                    </button>
                    <button 
                      onClick={handleSaveBio}
                      className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-lg"
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-slate-700 text-center sm:text-left leading-relaxed">
                  {currentUser.bio}
                </p>
              )}

              {/* Danh sách thông tin chi tiết (Giống ảnh chụp Facebook) */}
              <div className="space-y-3 pt-2 text-xs sm:text-sm text-slate-700">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-slate-500 shrink-0" />
                  <span>Sống ở <strong>{currentUser.location || "Vũng Tàu"}</strong></span>
                </div>

                <div className="flex items-center gap-3">
                  <HomeIcon className="w-5 h-5 text-slate-500 shrink-0" />
                  <span>Từ <strong>{currentUser.hometown || "Vũng Tàu"}</strong></span>
                </div>

                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-slate-500 shrink-0" />
                  <span className="flex items-center gap-1.5">
                    <strong>{currentUser.relationship || "Độc thân"}</strong>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-slate-500 shrink-0" />
                  <span>Làm việc tại <strong>TechVN</strong></span>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-500 shrink-0" />
                  <span>Tham gia từ {currentUser.joinedDate}</span>
                </div>
              </div>

              {/* Các nút hành động phụ */}
              <div className="pt-2 space-y-2">
                <button 
                  onClick={() => alert("Chức năng chỉnh sửa chi tiết")}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                >
                  Chỉnh sửa chi tiết
                </button>
                <button 
                  onClick={() => alert("Thêm sở thích cá nhân")}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                >
                  Thêm sở thích
                </button>
                <button 
                  onClick={() => alert("Thêm nội dung đáng chú ý")}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                >
                  Thêm nội dung đáng chú ý
                </button>
              </div>

            </div>


            {/* Box 2: Giáo dục (Theo đúng ảnh chụp Facebook của bạn) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900">Giáo dục</h2>
                <button className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-start gap-3 pt-1">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                  <GraduationCap className="w-6 h-6 text-slate-700" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{currentUser.highSchool || "Trường THPT Hòa Hội"}</h4>
                  <p className="text-xs text-slate-400">Trường cấp 3</p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-1">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                  <GraduationCap className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{currentUser.education || "Đại học Bách Khoa"}</h4>
                  <p className="text-xs text-slate-400">Đại học / Chuyên ngành CNTT</p>
                </div>
              </div>

              <button 
                onClick={() => alert("Xem chi tiết học vấn")}
                className="text-xs font-bold text-blue-600 hover:underline pt-1 block"
              >
                Xem thêm học vấn
              </button>
            </div>


            {/* Box 3: Ảnh (Lưới 9 ảnh thu nhỏ) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900">Ảnh</h2>
                <button 
                  onClick={() => setActiveTab('photos')}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Xem tất cả ảnh
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 rounded-xl overflow-hidden">
                {photoGrid.map((img, idx) => (
                  <div key={idx} className="aspect-square bg-slate-100 overflow-hidden cursor-pointer group">
                    <img 
                      src={img} 
                      alt={`Thumb ${idx}`} 
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                    />
                  </div>
                ))}
              </div>
            </div>


            {/* Box 4: Bạn bè (Lưới bạn bè thu nhỏ) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Bạn bè</h2>
                  <p className="text-xs text-slate-400 font-medium">{currentUser.friendsCount || 309} người bạn</p>
                </div>
                <button 
                  onClick={() => setActiveTab('friends')}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Xem tất cả bạn bè
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {suggestedFriends.slice(0, 6).map((friend) => (
                  <div key={friend.id} className="cursor-pointer group text-left">
                    <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 shadow-2xs mb-1">
                      <img 
                        src={friend.avatar} 
                        alt={friend.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      />
                    </div>
                    <p className="text-[11px] font-bold text-slate-800 truncate group-hover:text-blue-600">
                      {friend.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>


          {/* ================= CỘT PHẢI (BẠN ĐANG NGHĨ GÌ? & BÀI VIẾT ĐÃ TỪNG ĐĂNG) ================= */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            
            {/* Box 1: "Bạn đang nghĩ gì?" (Khung tạo bài viết cá nhân chuẩn Facebook) */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center gap-3">
                <img 
                  src={currentUser.avatar} 
                  alt={currentUser.name} 
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                />
                <input
                  type="text"
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder="Bạn đang nghĩ gì?"
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200/70 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-500 rounded-full border border-transparent focus:border-blue-400 outline-none transition"
                />
              </div>

              {/* Ô chèn link ảnh */}
              {showImageInput && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <input
                    type="text"
                    value={newPostImage}
                    onChange={(e) => setNewPostImage(e.target.value)}
                    placeholder="Dán link ảnh (URL) cần đính kèm..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none"
                  />
                  {newPostImage && (
                    <img src={newPostImage} alt="Preview" className="h-40 w-full object-cover rounded-lg border" />
                  )}
                </div>
              )}

              <div className="h-px bg-slate-100 w-full" />

              {/* 3 Nút tương tác: Video trực tiếp, Ảnh/video, Cột mốc */}
              <div className="flex items-center justify-around text-xs font-bold text-slate-600">
                <button 
                  onClick={() => alert("Tính năng phát trực tiếp!")}
                  className="flex items-center justify-center gap-2 py-2 px-3 hover:bg-slate-50 rounded-xl flex-1 transition"
                >
                  <Video className="w-5 h-5 text-rose-500" />
                  <span className="hidden sm:inline">Video trực tiếp</span>
                </button>

                <button 
                  onClick={() => setShowImageInput(!showImageInput)}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl flex-1 transition ${
                    showImageInput ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <ImageIcon className="w-5 h-5 text-emerald-500" />
                  <span>Ảnh/video</span>
                </button>

                <button 
                  onClick={() => alert("Thêm cột mốc sự kiện!")}
                  className="flex items-center justify-center gap-2 py-2 px-3 hover:bg-slate-50 rounded-xl flex-1 transition"
                >
                  <Flag className="w-5 h-5 text-blue-500" />
                  <span className="hidden sm:inline">Cột mốc</span>
                </button>

                {newPostText.trim() && (
                  <button
                    onClick={handleCreateProfilePost}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition"
                  >
                    Đăng
                  </button>
                )}
              </div>
            </div>


            {/* Box 2: Header "Bài viết" & Chuyển đổi Chế độ xem danh sách / lưới */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900">Bài viết</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => alert("Mở bộ lọc bài viết")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Bộ lọc</span>
                  </button>

                  <button 
                    onClick={() => alert("Quản lý bài viết")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>Quản lý bài viết</span>
                  </button>
                </div>
              </div>

              {/* 2 Chế độ hiển thị: Danh sách vs Lưới (Y hệt thanh trong ảnh Facebook) */}
              <div className="flex items-center border-t border-slate-100 pt-2 text-xs font-bold text-slate-600">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 border-b-2 transition ${
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
                  className={`flex-1 flex items-center justify-center gap-2 py-2 border-b-2 transition ${
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


            {/* Box 3: DANH SÁCH BÀI VIẾT ĐÃ TỪNG ĐĂNG CỦA CHÍNH NGƯỜI DÙNG */}
            {viewMode === 'list' ? (
              <div className="space-y-4">
                {userPosts.length > 0 ? (
                  userPosts.map((post) => (
                    <div 
                      key={post.id} 
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden"
                    >
                      {/* Header bài viết */}
                      <div className="p-4 flex items-center justify-between pb-3">
                        <div className="flex items-center gap-3">
                          <img 
                            src={post.author.avatar} 
                            alt={post.author.name} 
                            className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-extrabold text-slate-900">
                                {post.author.name}
                              </h4>
                              {post.author.isVerified && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <span>{post.createdAt}</span>
                              <span>•</span>
                              <Globe className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          </div>
                        </div>

                        <button className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Nội dung bài viết */}
                      <div className="px-4 pb-3">
                        <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line break-words">
                          {post.content}
                        </p>
                      </div>

                      {/* Ảnh bài viết */}
                      {post.image && (
                        <div className="w-full overflow-hidden bg-slate-900/5 border-y border-slate-100 flex items-center justify-center">
                          <img 
                            src={post.image} 
                            alt="Post Media" 
                            className="w-full h-auto max-h-[520px] object-cover block"
                          />
                        </div>
                      )}

                      {/* Thống kê tương tác */}
                      <div className="px-4 py-2 flex items-center justify-between text-xs text-slate-400 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]">👍</span>
                          <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] -ml-2">❤️</span>
                          <span>{post.likesCount} người khác</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{post.comments?.length || 0} bình luận</span>
                          <span>{post.sharesCount || 0} lượt chia sẻ</span>
                        </div>
                      </div>

                      {/* Các nút like, bình luận, chia sẻ */}
                      <div className="px-2 py-1 flex items-center justify-between text-xs font-bold text-slate-600 relative">
                        
                        {/* Nút Cảm xúc với Popover 5 loại cảm xúc */}
                        <div 
                          className="flex-1 relative"
                          onMouseEnter={() => setHoverReactionPostId(post.id)}
                          onMouseLeave={() => setHoverReactionPostId(null)}
                        >
                          {hoverReactionPostId === post.id && (
                            <div className="absolute -top-12 left-2 z-30 bg-white rounded-full px-2.5 py-1.5 shadow-xl border border-slate-200 flex items-center gap-2 animate-fade-in">
                              {REACTIONS.map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => handleSelectProfileReaction(post.id, r.id)}
                                  title={r.label}
                                  className="text-2xl hover:scale-135 transition-transform duration-150 p-1 cursor-pointer"
                                >
                                  {r.emoji}
                                </button>
                              ))}
                            </div>
                          )}

                          {(() => {
                            const curRId = profileReactions[post.id] || (post.isLiked ? 'like' : null);
                            const activeR = REACTIONS.find(r => r.id === curRId);
                            return (
                              <button
                                onClick={() => handleSelectProfileReaction(post.id, curRId ? curRId : 'like')}
                                className={`w-full py-2 flex items-center justify-center gap-2 rounded-xl transition cursor-pointer ${
                                  activeR ? `${activeR.color} font-extrabold` : 'hover:bg-slate-50 text-slate-600'
                                }`}
                              >
                                {activeR ? (
                                  <>
                                    <span className="text-base leading-none">{activeR.emoji}</span>
                                    <span>{activeR.label}</span>
                                  </>
                                ) : (
                                  <>
                                    <ThumbsUp className="w-4 h-4 text-slate-500" />
                                    <span>Thích</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}
                        </div>

                        <button
                          onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                          className="flex-1 py-2 flex items-center justify-center gap-2 rounded-xl hover:bg-slate-50 transition"
                        >
                          <MessageCircle className="w-4 h-4 text-slate-500" />
                          <span>Bình luận</span>
                        </button>

                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(window.location.href);
                            alert("Đã sao chép liên kết bài viết!");
                          }}
                          className="flex-1 py-2 flex items-center justify-center gap-2 rounded-xl hover:bg-slate-50 transition"
                        >
                          <Share2 className="w-4 h-4 text-slate-500" />
                          <span>Chia sẻ</span>
                        </button>
                      </div>

                      {/* Khung bình luận */}
                      {activeCommentPostId === post.id && (
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 space-y-2.5">
                          <form onSubmit={(e) => handleCommentSubmit(post.id, e)} className="flex gap-2">
                            <img 
                              src={currentUser.avatar} 
                              alt="Me" 
                              className="w-7 h-7 rounded-full object-cover shrink-0" 
                            />
                            <div className="flex-1 relative">
                              <input
                                type="text"
                                value={commentInputs[post.id] || ''}
                                onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                                placeholder="Viết bình luận công khai..."
                                className="w-full pl-3 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-full outline-none focus:border-blue-500"
                              />
                              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600">
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </form>

                          {/* Danh sách bình luận */}
                          {post.comments && post.comments.length > 0 && (
                            <div className="space-y-2 pt-1">
                              {post.comments.map((cmt) => (
                                <div key={cmt.id} className="flex gap-2 text-xs">
                                  <img src={cmt.author.avatar} alt="Cmt" className="w-6 h-6 rounded-full object-cover" />
                                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                                    <span className="font-bold text-slate-800">{cmt.author.name}</span>
                                    <p className="text-slate-600">{cmt.content}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-400">
                    <p className="text-sm font-semibold">Bạn chưa có bài viết nào.</p>
                  </div>
                )}
              </div>
            ) : (
              /* Chế độ xem lưới (Grid view) */
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {userPosts.map(post => (
                  <div key={post.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    {post.image ? (
                      <img src={post.image} alt="Thumb" className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="p-4 h-36 flex items-center justify-center text-xs text-slate-600 bg-slate-50 italic text-center">
                        "{post.content.slice(0, 70)}..."
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
      </div>

    </div>
  );
}

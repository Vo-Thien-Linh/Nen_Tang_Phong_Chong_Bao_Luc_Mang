export const currentUser = {
  id: "a0000000-0000-0000-0000-000000000001",
  name: "Võ Thiện Linh",
  username: "linh.vothien.16",
  role: "ADMIN", // 'ADMIN' | 'USER'
  isAdmin: true,
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
  coverImage: "https://images.unsplash.com/photo-1707343843437-caacff5cfa74?w=1200&auto=format&fit=crop&q=80",
  bio: "Cuộc sống là những chuyến đi và trải nghiệm 🌊 Đam mê công nghệ & khám phá cuộc sống.",
  job: "Kỹ sư phần mềm @ TechVN",
  location: "Vũng Tàu",
  hometown: "Vũng Tàu",
  education: "Đại học Bách Khoa",
  highSchool: "Trường THPT Hòa Hội",
  relationship: "Độc thân",
  friendsCount: 309,
  joinedDate: "Tháng 09, 2023",
  followersCount: 1420,
  followingCount: 580,
  postsCount: 4,
  isVerified: true
};

export const initialStories = [
  {
    id: "story-1",
    userId: "user-1",
    name: "Lê Thu Trang",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80",
    isViewed: false
  },
  {
    id: "story-2",
    userId: "user-2",
    name: "Trần Hoàng Nam",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80",
    isViewed: false
  },
  {
    id: "story-3",
    userId: "user-3",
    name: "Phạm Hải Yến",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80",
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&auto=format&fit=crop&q=80",
    isViewed: true
  },
  {
    id: "story-4",
    userId: "user-4",
    name: "Đặng Quang Huy",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80",
    isViewed: true
  }
];

export const initialPosts = [
  {
    id: "post-1",
    author: {
      id: "user-1",
      name: "Lê Thu Trang",
      username: "thutrang_le",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
      isVerified: true
    },
    createdAt: "2 giờ trước",
    content: "Cuối tuần cùng team chinh phục một dự án mới. Giao diện trực quan và trải nghiệm mượt mà luôn là ưu tiên hàng đầu! Mọi người thấy phối màu xanh navy này thế nào? ☕💻",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80",
    tags: ["tech", "frontend", "workvibes"],
    likesCount: 148,
    isLiked: false,
    sharesCount: 12,
    isSaved: false,
    aiStatus: {
      label: "Normal",
      confidence: 0.99
    },
    comments: [
      {
        id: "cmt-1",
        author: {
          name: "Trần Hoàng Nam",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80"
        },
        content: "Giao diện nhìn hiện đại và gọn gàng lắm chị ơi! 👍",
        time: "1 giờ trước",
        likes: 4
      },
      {
        id: "cmt-2",
        author: {
          name: "Võ Thiện Linh",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
        },
        content: "Chúc mừng team nhé, phần animation mượt mà nữa là điểm 10 luôn!",
        time: "30 phút trước",
        likes: 2
      }
    ]
  },
  {
    id: "post-avatar-1",
    author: {
      id: "a0000000-0000-0000-0000-000000000001",
      name: "Võ Thiện Linh",
      username: "linh.vothien.16",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
      isVerified: true
    },
    createdAt: "26 Tháng 6 lúc 14:20",
    content: "Võ Thiện Linh đã cập nhật ảnh đại diện của anh ấy.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
    tags: ["avatar", "newlook"],
    likesCount: 184,
    isLiked: true,
    sharesCount: 5,
    isSaved: false,
    aiStatus: {
      label: "Normal",
      confidence: 0.99
    },
    comments: [
      {
        id: "cmt-av-1",
        author: {
          name: "Lê Thu Trang",
          avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80"
        },
        content: "Ảnh đại diện phong cách và góc chụp đẹp quá anh ơi! ✨",
        time: "26 Tháng 6",
        likes: 12
      }
    ]
  },
  {
    id: "post-2",
    author: {
      id: "a0000000-0000-0000-0000-000000000001",
      name: "Võ Thiện Linh",
      username: "linh.vothien.16",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
      isVerified: true
    },
    createdAt: "5 giờ trước",
    content: "Vừa hoàn thiện xong module mạng xã hội với hệ thống kiểm duyệt bài viết thông minh bằng AI. Cảm ơn mọi người đã đồng hành và đóng góp ý kiến! ✨🎯",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
    tags: ["project", "socialmedia", "ai"],
    likesCount: 312,
    isLiked: true,
    sharesCount: 35,
    isSaved: true,
    aiStatus: {
      label: "Normal",
      confidence: 0.98
    },
    comments: [
      {
        id: "cmt-3",
        author: {
          name: "Phạm Hải Yến",
          avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80"
        },
        content: "Xuất sắc luôn anh ơi, có mở mã nguồn thử nghiệm không ạ?",
        time: "3 giờ trước",
        likes: 8
      }
    ]
  },
  {
    id: "post-3",
    author: {
      id: "user-2",
      name: "Trần Hoàng Nam",
      username: "nam_traveler",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
      isVerified: false
    },
    createdAt: "1 ngày trước",
    content: "Hoàng hôn ở Đà Lạt chiều nay bình yên lạ thường. Thỉnh thoảng dành cho mình một khoảng lặng sau chuỗi ngày bận rộn với code là điều thật sự cần thiết. 🌲🌅",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
    tags: ["travel", "dalat", "sunset"],
    likesCount: 520,
    isLiked: false,
    sharesCount: 48,
    isSaved: false,
    aiStatus: {
      label: "Normal",
      confidence: 0.99
    },
    comments: [
      {
        id: "cmt-4",
        author: {
          name: "Đặng Quang Huy",
          avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80"
        },
        content: "Ảnh đẹp mê mẩn! Chuyến đi săn mây thành công quá chú em.",
        time: "20 giờ trước",
        likes: 3
      }
    ]
  },
  {
    id: "post-flagged-appeal",
    author: {
      id: "a0000000-0000-0000-0000-000000000001",
      name: "Võ Thiện Linh",
      username: "linh.vothien.16",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
      isVerified: true
    },
    createdAt: "35 phút trước",
    content: "Hôm nay team em \"tiêu diệt\" gọn ghẽ đống bug cứng đầu trong sprint này! Cảm giác như vừa chiến thắng một trận đánh lớn vậy haha. 💻🚀",
    tags: ["debug", "coding", "sprint"],
    likesCount: 56,
    isLiked: false,
    sharesCount: 3,
    isSaved: false,
    aiStatus: {
      label: "Violence",
      confidence: 0.912,
      action: "warn_user",
      reason: "Hệ thống AI nhận diện từ ngữ có yếu tố bạo lực: 'tiêu diệt', 'trận đánh'"
    },
    appeal: {
      id: "app-1",
      status: "pending", // 'pending' | 'approved' | 'rejected'
      userReason: "Tôi dùng từ 'tiêu diệt bug' và 'trận đánh lớn' như một cách ví von lập trình viên fix lỗi phần mềm, hoàn toàn không có ý định bạo lực hay thù địch. Kính mong admin xem xét lại.",
      createdAt: "25 phút trước"
    },
    comments: []
  }
];

export const initialNotifications = [
  {
    id: "notif-1",
    type: "like",
    user: {
      name: "Lê Thu Trang",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80"
    },
    content: "đã thích bài viết của bạn: \"Vừa hoàn thiện xong module mạng xã hội...\"",
    time: "15 phút trước",
    isRead: false,
    targetPostId: "post-2"
  },
  {
    id: "notif-2",
    type: "comment",
    user: {
      name: "Phạm Hải Yến",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80"
    },
    content: "đã bình luận vào bài viết của bạn: \"Xuất sắc luôn anh ơi...\"",
    time: "1 giờ trước",
    isRead: false,
    targetPostId: "post-2",
    targetCommentId: "cmt-3"
  },
  {
    id: "notif-3",
    type: "follow",
    user: {
      name: "Vũ Đình Phong",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80"
    },
    content: "đã bắt đầu theo dõi bạn.",
    time: "3 giờ trước",
    isRead: true,
    targetPostId: null
  },
  {
    id: "notif-4",
    type: "system",
    user: {
      name: "AI Shield Moderator",
      avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80"
    },
    content: "Báo cáo an toàn: Hệ thống vừa tự động chặn 1 bình luận vi phạm chính sách nội dung độc hại.",
    time: "5 giờ trước",
    isRead: true,
    targetPostId: null
  },
  {
    id: "notif-5",
    type: "like",
    user: {
      name: "Đặng Quang Huy",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80"
    },
    content: "đã thả tim vào ảnh đại diện mới của bạn.",
    time: "Hôm qua",
    isRead: true,
    targetPostId: null
  }
];

export const suggestedFriends = [
  {
    id: "sug-1",
    name: "Bùi Mai Anh",
    username: "maianh_designer",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
    bio: "UI/UX Designer | Yêu nghệ thuật & công nghệ",
    mutualFriends: [
      { id: "u4", name: "Lê Hoàng Nam", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150" },
      { id: "u5", name: "Phạm Quỳnh Anh", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150" },
      { id: "u7", name: "Vũ Quốc Bảo", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150" },
      { id: "u3", name: "Trần Thị Mai", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150" }
    ],
    isFollowing: false,
    requestSent: false
  },
  {
    id: "sug-2",
    name: "Hoàng Tuấn Kiệt",
    username: "kiet_ai_lab",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80",
    bio: "AI Research Assistant | PhoBERT & NLP",
    mutualFriends: [
      { id: "u4", name: "Lê Hoàng Nam", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150" },
      { id: "u7", name: "Vũ Quốc Bảo", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150" },
      { id: "u2", name: "Nguyễn Văn An", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150" }
    ],
    isFollowing: false,
    requestSent: false
  },
  {
    id: "sug-3",
    name: "Đỗ Phương Thảo",
    username: "thao_dp",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80",
    bio: "Content Creator | Marketing & Truyền thông",
    mutualFriends: [
      { id: "u5", name: "Phạm Quỳnh Anh", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150" },
      { id: "u3", name: "Trần Thị Mai", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150" }
    ],
    isFollowing: false,
    requestSent: false
  },
  {
    id: "sug-4",
    name: "Hoàng Minh Đức",
    username: "duc_hm",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    bio: "Backend Dev | Python & Django",
    mutualFriends: [
      { id: "u4", name: "Lê Hoàng Nam", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150" }
    ],
    isFollowing: false,
    requestSent: false
  },
  {
    id: "sug-5",
    name: "Đặng Thảo Vy",
    username: "thaovy_d",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    bio: "Graphic Designer | Nhiếp ảnh tự do",
    mutualFriends: [
      { id: "u5", name: "Phạm Quỳnh Anh", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150" }
    ],
    isFollowing: false,
    requestSent: false
  },
  {
    id: "sug-6",
    name: "Nguyễn Thanh Tùng",
    username: "tung_it_dev",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150",
    bio: "Lập trình viên Mobile | Flutter & Swift",
    mutualFriends: [],
    isFollowing: false,
    requestSent: false
  }
];

export const trendingTopics = [
  { tag: "#AIModeration", posts: "14.2K bài viết", category: "Công nghệ" },
  { tag: "#React19", posts: "8.5K bài viết", category: "Lập trình" },
  { tag: "#ViteJS", posts: "5.1K bài viết", category: "Web Dev" },
  { tag: "#SinhVienKhoaHoc", posts: "3.9K bài viết", category: "Đời sống" },
  { tag: "#BTLProject", posts: "2.4K bài viết", category: "Giáo dục" }
];

export const onlineUsers = [
  { id: "online-1", name: "Lê Thu Trang", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80" },
  { id: "online-2", name: "Trần Hoàng Nam", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80" },
  { id: "online-3", name: "Phạm Hải Yến", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80" },
  { id: "online-4", name: "Đặng Quang Huy", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80" }
];

// Danh mục lý do báo cáo vi phạm
export const REPORT_REASONS = [
  { id: 'toxic', label: 'Nội dung độc hại / Xúc phạm', description: 'Chửi bới, lăng mạ, hạ nhục người khác hoặc ngôn từ thiếu văn hóa' },
  { id: 'hate_speech', label: 'Ngôn từ thù ghét', description: 'Kích động thù địch, phân biệt chủng tộc, tôn giáo, giới tính' },
  { id: 'violence', label: 'Bạo lực / Đe dọa', description: 'Đe dọa gây thương tích, bạo lực thể xác hoặc cổ súy hành vi nguy hiểm' },
  { id: 'harassment', label: 'Quấy rối / Đeo bám', description: 'Gửi tin nhắn hoặc bình luận làm phiền có chủ đích' },
  { id: 'spam', label: 'Spam / Lừa đảo', description: 'Quảng cáo sai sự thật, lừa đảo tài chính hoặc phát tán mã độc' },
  { id: 'misinformation', label: 'Tin giả / Sai sự thật', description: 'Bóp méo thông tin gây hoang mang dư luận' },
  { id: 'other', label: 'Lý do khác', description: 'Hành vi vi phạm quy chuẩn cộng đồng khác' }
];

// Dữ liệu mẫu Báo cáo người dùng gửi lên
export const initialReports = [
  {
    id: "rep-1",
    reporter: { 
      id: "user-1", 
      name: "Lê Thu Trang", 
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80" 
    },
    targetType: "post",
    targetId: "post-3",
    targetAuthor: { 
      name: "Trần Hoàng Nam", 
      username: "nam_traveler",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80"
    },
    contentExcerpt: "Hoàng hôn ở Đà Lạt chiều nay bình yên lạ thường. Thỉnh thoảng dành cho mình một khoảng lặng...",
    reason: "spam",
    reasonLabel: "Spam / Lừa đảo",
    details: "Nghi ngờ bài viết chứa liên kết rút gọn quảng cáo spam chưa được kiểm duyệt trong phần bình luận.",
    status: "pending", // 'pending' | 'resolved_violation' | 'dismissed'
    adminNotes: "",
    createdAt: "40 phút trước",
    aiStatus: { label: "Normal", confidence: 0.99 }
  },
  {
    id: "rep-2",
    reporter: { 
      id: "user-2", 
      name: "Trần Hoàng Nam", 
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80" 
    },
    targetType: "comment",
    targetId: "cmt-1",
    targetAuthor: { 
      name: "Đặng Quang Huy", 
      username: "huy_dang",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80"
    },
    contentExcerpt: "Giao diện nhìn chán thế, làm ăn cẩu thả như thế này mà cũng mang đi nộp à?",
    reason: "toxic",
    reasonLabel: "Nội dung độc hại / Xúc phạm",
    details: "Bình luận có ngôn từ công kích, miệt thị cá nhân công sức của người khác.",
    status: "pending",
    adminNotes: "",
    createdAt: "2 giờ trước",
    aiStatus: { label: "Toxic", confidence: 0.93 }
  },
  {
    id: "rep-3",
    reporter: { 
      id: "a0000000-0000-0000-0000-000000000001", 
      name: "Võ Thiện Linh", 
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80" 
    },
    targetType: "message",
    targetId: "rm1",
    targetAuthor: { 
      name: "Trần Minh Tuấn", 
      username: "tuan_tran_ai",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
    },
    contentExcerpt: "Đưa ngay mã nguồn AI kiểm duyệt đây không tao báo cáo sập tài khoản mày bây giờ!",
    reason: "harassment",
    reasonLabel: "Quấy rối / Đeo bám",
    details: "Người lạ gửi tin nhắn đe dọa, đòi chia sẻ tài nguyên cá nhân trái phép trong hòm thư chờ.",
    status: "resolved_violation",
    adminNotes: "Đã xác minh nội dung có hành vi quấy rối và đe dọa, áp dụng tạm khóa tin nhắn 24h đối với tài khoản vi phạm.",
    createdAt: "1 ngày trước",
    aiStatus: { label: "Violence", confidence: 0.95 }
  }
];

// Dữ liệu mẫu Khiếu nại (Appeals) do người dùng gửi khi bị AI gắn nhãn sai
export const initialAppeals = [
  {
    id: "app-1",
    user: { 
      id: "a0000000-0000-0000-0000-000000000001", 
      name: "Võ Thiện Linh", 
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80" 
    },
    contentType: "post",
    contentId: "post-flagged-appeal",
    originalText: 'Hôm nay team em "tiêu diệt" gọn ghẽ đống bug cứng đầu trong sprint này! Cảm giác như vừa chiến thắng một trận đánh lớn vậy haha. 💻🚀',
    aiPredictedLabel: "Violence",
    aiConfidence: 0.912,
    aiActionTaken: "warn_user",
    appealReason: 'Tôi dùng cụm từ "tiêu diệt bug" và "trận đánh lớn" như một cách ví von lập trình viên fix lỗi phần mềm, hoàn toàn mang tính vui vẻ và không hề có ý định bạo lực hay thù địch. Kính mong ban quản trị kiểm tra và gỡ cảnh báo giúp tôi.',
    status: "pending", // 'pending' | 'approved' | 'rejected'
    adminNotes: "",
    createdAt: "25 phút trước"
  },
  {
    id: "app-2",
    user: { 
      id: "user-2", 
      name: "Trần Hoàng Nam", 
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80" 
    },
    contentType: "comment",
    contentId: "cmt-sample-2",
    originalText: "Thằng bạn thân chí cốt của tôi điên thật rồi, dám bỏ việc lương 30 củ để khởi nghiệp AI!",
    aiPredictedLabel: "Toxic",
    aiConfidence: 0.884,
    aiActionTaken: "cooldown_30s",
    appealReason: 'Đây là câu khen ngợi sự can đảm của bạn thân, từ "điên" ở đây mang nghĩa thán phục trong văn nói của giới trẻ, không phải lời lăng mạ hay xúc phạm.',
    status: "approved",
    adminNotes: "Đã xác minh ngữ cảnh: Lời khen thân mật giữa bạn bè. Kết luận AI False Positive. Đã khôi phục bình luận và gỡ trạng thái cooldown.",
    createdAt: "3 giờ trước"
  }
];

// Dữ liệu mẫu các trường hợp Admin hiệu chỉnh nhãn AI sai (Active Learning / Retraining Loop)
export const initialAiOverrides = [
  {
    id: "ovr-1",
    adminName: "Võ Thiện Linh (Admin)",
    contentType: "comment",
    contentId: "cmt-sample-2",
    rawText: "Thằng bạn thân chí cốt của tôi điên thật rồi, dám bỏ việc lương 30 củ để khởi nghiệp AI!",
    originalAiLabel: "Toxic",
    originalConfidence: 0.884,
    correctedLabel: "Normal",
    overrideReason: "False Positive: Ngữ cảnh tán thưởng bạn thân, mô hình hiểu sai nghĩa bóng của từ 'điên'.",
    isExportedForRetraining: false,
    createdAt: "2 giờ trước"
  },
  {
    id: "ovr-2",
    adminName: "Võ Thiện Linh (Admin)",
    contentType: "post",
    contentId: "post-old-demo",
    rawText: "Bác hàng xóm bảo nhà tao có con chó ngoan dã man, gặp ai cũng vẫy đuôi mừng tíu tít.",
    originalAiLabel: "Toxic",
    originalConfidence: 0.941,
    correctedLabel: "Normal",
    overrideReason: "False Positive: Từ 'chó' chỉ thú cưng thực tế, không dùng để chửi bới.",
    isExportedForRetraining: true,
    createdAt: "Hôm qua"
  }
];

// Danh sách người dùng hệ thống phục vụ phân hệ Quản Lý Người Dùng (Admin User Management)
export const initialUsersList = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    name: "Võ Thiện Linh",
    username: "linh.vothien.16",
    email: "linh.vothien@example.com",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    role: "ADMIN",
    status: "active", // 'active' | 'cooldown' | 'banned'
    cooldownUntil: null,
    bannedReason: null,
    postsCount: 4,
    violationsCount: 1, // dính 1 bài ví von bị AI nhầm
    reportsCount: 0,
    joinedDate: "15/09/2023",
    isVerified: true
  },
  {
    id: "user-1",
    name: "Lê Thu Trang",
    username: "thutrang_le",
    email: "thutrang@example.com",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
    role: "MODERATOR",
    status: "active",
    cooldownUntil: null,
    bannedReason: null,
    postsCount: 12,
    violationsCount: 0,
    reportsCount: 0,
    joinedDate: "20/10/2023",
    isVerified: true
  },
  {
    id: "user-2",
    name: "Trần Hoàng Nam",
    username: "nam_traveler",
    email: "nam.tran@example.com",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    role: "USER",
    status: "active",
    cooldownUntil: null,
    bannedReason: null,
    postsCount: 8,
    violationsCount: 1, // Bình luận đùa khen bạn thân bị AI gắn cờ
    reportsCount: 1,
    joinedDate: "05/11/2023",
    isVerified: false
  },
  {
    id: "user-3",
    name: "Phạm Hải Yến",
    username: "haiyen_p",
    email: "haiyen@example.com",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80",
    role: "USER",
    status: "active",
    cooldownUntil: null,
    bannedReason: null,
    postsCount: 15,
    violationsCount: 0,
    reportsCount: 0,
    joinedDate: "12/12/2023",
    isVerified: true
  },
  {
    id: "user-4",
    name: "Đặng Quang Huy",
    username: "huy_dang",
    email: "quanghuy@example.com",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    role: "USER",
    status: "cooldown",
    cooldownUntil: "Còn 15 phút (Cooldown tự động do bình luận xúc phạm)",
    bannedReason: null,
    postsCount: 5,
    violationsCount: 3,
    reportsCount: 2,
    joinedDate: "02/01/2024",
    isVerified: false
  },
  {
    id: "user-stranger-1",
    name: "Trần Minh Tuấn",
    username: "tuan_tran_ai",
    email: "tuan.tran.hack@darkmail.com",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    role: "USER",
    status: "banned",
    cooldownUntil: null,
    bannedReason: "Gửi tin nhắn quấy rối, đe dọa thành viên và đòi mã nguồn trái phép",
    postsCount: 1,
    violationsCount: 4,
    reportsCount: 5,
    joinedDate: "14/02/2024",
    isVerified: false
  },
  {
    id: "user-5",
    name: "Bùi Mai Anh",
    username: "maianh_designer",
    email: "maianh@design.com",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
    role: "USER",
    status: "active",
    cooldownUntil: null,
    bannedReason: null,
    postsCount: 9,
    violationsCount: 0,
    reportsCount: 0,
    joinedDate: "18/02/2024",
    isVerified: true
  },
  {
    id: "user-6",
    name: "Ngô Thanh Hà",
    username: "thanhha_design",
    email: "thanhha@gmail.com",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    role: "USER",
    status: "active",
    cooldownUntil: null,
    bannedReason: null,
    postsCount: 6,
    violationsCount: 0,
    reportsCount: 0,
    joinedDate: "01/03/2024",
    isVerified: false
  }
];



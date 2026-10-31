/**
 * Bộ nhớ tạm (In-Memory Stores) dùng khi không kết nối DB hoặc ở chế độ Mock / Testing
 */

export const reportsStore = [
  {
    id: 'rep-1',
    reporter: { id: 'user-1', name: 'Lê Thu Trang', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200' },
    targetType: 'post',
    targetId: 'post-3',
    targetAuthor: { name: 'Trần Hoàng Nam', username: 'nam_traveler' },
    contentExcerpt: 'Hoàng hôn ở Đà Lạt chiều nay bình yên lạ thường...',
    reason: 'spam',
    reasonLabel: 'Spam / Tin rác',
    details: 'Nghi ngờ bài viết chứa liên kết quảng cáo spam chưa được kiểm duyệt.',
    status: 'pending', // 'pending' | 'resolved_violation' | 'dismissed'
    adminNotes: '',
    createdAt: '40 phút trước',
    aiStatus: { label: 'Normal', confidence: 0.99 }
  },
  {
    id: 'rep-2',
    reporter: { id: 'user-2', name: 'Trần Hoàng Nam', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' },
    targetType: 'comment',
    targetId: 'cmt-toxic-demo',
    targetAuthor: { name: 'Người dùng ẩn danh', username: 'anonymous_user' },
    contentExcerpt: 'Nói chuyện dốt nát thế mà cũng đòi làm kỹ sư công nghệ à?',
    reason: 'toxic',
    reasonLabel: 'Công kích / Xúc phạm',
    details: 'Bình luận có từ ngữ công kích thô tục nhắm vào thành viên khác.',
    status: 'pending',
    adminNotes: '',
    createdAt: '2 giờ trước',
    aiStatus: { label: 'Toxic', confidence: 0.93 }
  },
  {
    id: 'rep-3',
    reporter: { id: 'user-current', name: 'Võ Thiện Linh', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400' },
    targetType: 'message',
    targetId: 'msg-rep-demo',
    targetAuthor: { name: 'Trần Minh Tuấn', username: 'tuan_tran_ai' },
    contentExcerpt: 'Đưa mã nguồn đây không tao hack sập hệ thống của mày bây giờ!',
    reason: 'harassment',
    reasonLabel: 'Quấy rối / Đe dọa',
    details: 'Tin nhắn quấy rối và đe dọa trong hộp thư chờ người lạ.',
    status: 'resolved_violation',
    adminNotes: 'Đã xác minh tin nhắn có yếu tố xúc phạm, cảnh cáo tài khoản và ẩn hội thoại.',
    createdAt: '1 ngày trước',
    aiStatus: { label: 'Violence', confidence: 0.95 }
  }
];

export const appealsStore = [
  {
    id: 'app-1',
    user: { id: 'user-current', name: 'Võ Thiện Linh', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400' },
    contentType: 'post',
    contentId: 'post-2',
    originalText: 'Hôm nay team em "tiêu diệt" gọn ghẽ đống bug cứng đầu trong sprint này! Cảm giác như vừa chiến thắng một trận đánh lớn vậy haha.',
    aiPredictedLabel: 'Violence',
    aiConfidence: 0.912,
    aiActionTaken: 'warn_user',
    appealReason: 'Tôi dùng từ "tiêu diệt bug" và "trận đánh lớn" như một cách ví von lập trình viên giải quyết sự cố, hoàn toàn không có ý định bạo lực hay thù địch. Kính mong admin xem xét lại.',
    status: 'pending', // 'pending' | 'approved' | 'rejected'
    adminNotes: '',
    createdAt: '25 phút trước'
  },
  {
    id: 'app-2',
    user: { id: 'user-2', name: 'Trần Hoàng Nam', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' },
    contentType: 'comment',
    contentId: 'cmt-3',
    originalText: 'Thằng bạn thân chí cốt của tôi điên thật rồi, dám bỏ việc lương cao để khởi nghiệp công nghệ!',
    aiPredictedLabel: 'Toxic',
    aiConfidence: 0.884,
    aiActionTaken: 'cooldown_30s',
    appealReason: 'Đây là cách nói đùa khen ngợi bạn thân dũng cảm khởi nghiệp, từ "điên" ở đây mang nghĩa tích cực khâm phục chứ không phải xúc phạm chửi bới.',
    status: 'approved',
    adminNotes: 'Đã kiểm tra ngữ cảnh: Lời khen thân mật giữa bạn bè. AI False Positive. Đã phục hồi bình luận và gỡ phạt.',
    createdAt: '3 giờ trước'
  }
];

export const aiOverrideLogsStore = [
  {
    id: 'ovr-1',
    adminName: 'Quản Trị Viên Hệ Thống',
    contentType: 'comment',
    contentId: 'cmt-3',
    rawText: 'Thằng bạn thân chí cốt của tôi điên thật rồi, dám bỏ việc lương cao để khởi nghiệp công nghệ!',
    originalAiLabel: 'Toxic',
    originalConfidence: 0.884,
    correctedLabel: 'Normal',
    overrideReason: 'False Positive: Từ ngữ cảm thán thân mật giữa bạn thân, AI nhận diện nhầm từ "điên".',
    isExportedForRetraining: false,
    createdAt: '2 giờ trước'
  }
];


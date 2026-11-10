/**
 * Hệ thống Đa ngôn ngữ (i18n) - WINGS / NexusSocial
 * Hỗ trợ Tiếng Việt (vi) và Tiếng Anh (en) toàn diện
 */

import { useState, useEffect } from 'react';

export const TRANSLATIONS = {
  vi: {
    // ==========================================
    // 1. THANH ĐIỀU HƯỚNG (NAVBAR)
    // ==========================================
    'nav.home': 'Trang chủ',
    'nav.live': 'Trực tiếp',
    'nav.friends': 'Bạn bè',
    'nav.messages': 'Tin nhắn',
    'nav.notifications': 'Thông báo',
    'nav.moderation': 'Kiểm duyệt',
    'nav.admin': 'Quản trị',
    'nav.profile': 'Trang cá nhân',
    'nav.settings': 'Cài đặt & Quyền riêng tư',
    'nav.login': 'Đăng nhập',
    'nav.register': 'Đăng ký',
    'nav.logout': 'Đăng xuất',
    'nav.search': 'Tìm kiếm trên Wings...',
    'nav.theme_dark': 'Chế độ tối',
    'nav.theme_light': 'Chế độ sáng',
    'nav.user_menu': 'Menu tài khoản',
    'nav.ai_lab': 'AI Lab',
    'nav.admin_panel': 'Khu vực quản trị',
    'nav.moderation_panel': 'Khu vực kiểm duyệt',
    'nav.switch_to_light': 'Chuyển sang giao diện Sáng',
    'nav.switch_to_dark': 'Chuyển sang giao diện Tối',

    // ==========================================
    // 2. BẢNG TIN TRANG CHỦ (HOME FEED)
    // ==========================================
    'home.for_you': 'Dành cho bạn',
    'home.following': 'Đang theo dõi',
    'home.refresh': 'Làm mới',
    'home.refresh_title': 'Làm mới bảng tin',
    'home.clear_filter': 'Xóa bộ lọc',
    'home.search_filter_title': 'Bộ lọc tìm kiếm:',
    'home.posts_found': 'Tìm thấy {count} bài viết phù hợp',
    'home.no_matching_posts': 'Không có bài viết nào khớp với từ khóa tìm kiếm.',
    'home.suggested_friends': 'Gợi ý kết bạn',
    'home.see_all_suggestions': 'Xem tất cả',
    'home.trending_topics': 'Chủ đề thịnh hành',
    'home.no_trending': 'Chưa có chủ đề thịnh hành',
    'home.online_contacts': 'Người liên hệ trực tuyến',
    'home.sponsored': 'Được tài trợ',

    // ==========================================
    // 3. TẠO BÀI VIẾT (CREATE POST)
    // ==========================================
    'create_post.placeholder': '{name} ơi, bạn đang nghĩ gì thế?',
    'create_post.placeholder_default': 'Bạn đang nghĩ gì thế?',
    'create_post.placeholder_guest': 'Đăng nhập để chia sẻ bài viết cùng cộng đồng...',
    'create_post.photo_video': 'Ảnh/Video',
    'create_post.feeling': 'Cảm xúc/Hoạt động',
    'create_post.audio': 'Âm thanh',
    'create_post.submit': 'Đăng bài',
    'create_post.submitting': 'Đang đăng...',
    'create_post.uploading': 'Đang tải ảnh...',
    'create_post.privacy_public': 'Công khai',
    'create_post.privacy_friends': 'Bạn bè',
    'create_post.privacy_private': 'Chỉ mình tôi',
    'create_post.banned_notice': 'Tài khoản của bạn đang bị hạn chế đăng bài và bình luận.',
    'create_post.success': 'Đăng bài thành công',

    // ==========================================
    // 4. BÀI VIẾT & TƯƠNG TÁC (POSTS & INTERACTIONS)
    // ==========================================
    'post.like': 'Thích',
    'post.liked': 'Đã thích',
    'post.comment': 'Bình luận',
    'post.share': 'Chia sẻ',
    'post.comments_count': 'bình luận',
    'post.shares_count': 'chia sẻ',
    'post.write_comment': 'Viết bình luận...',
    'post.press_enter': 'Nhấn Enter để gửi',
    'post.edit': 'Chỉnh sửa bài viết',
    'post.delete': 'Xóa bài viết',
    'post.report': 'Báo cáo bài viết này',
    'post.hide': 'Ẩn bài viết',
    'post.shared_post': 'đã chia sẻ một bài viết',
    'post.edited': 'Đã chỉnh sửa',
    'post.just_now': 'Vừa xong',
    'post.minutes_ago': '{n} phút trước',
    'post.hours_ago': '{n} giờ trước',
    'post.days_ago': '{n} ngày trước',
    'post.weeks_ago': '{n} tuần trước',
    'post.view_all_comments': 'Xem thêm bình luận',
    'post.delete_confirm': 'Bạn có chắc chắn muốn xóa bài viết này không?',
    'post.toxic_warning_title': 'Nội dung có thể chứa yếu tố nhạy cảm hoặc độc hại',
    'post.toxic_warning_desc': 'Hệ thống AI đã phát hiện nội dung có thể vi phạm tiêu chuẩn cộng đồng.',
    'post.show_content': 'Hiển thị nội dung',
    'post.hide_content': 'Ẩn nội dung',

    // ==========================================
    // 5. TIN 24H (STORIES)
    // ==========================================
    'story.create_story': 'Tạo tin',
    'story.your_story': 'Tin của bạn',
    'story.viewers': 'Người xem tin',
    'story.no_viewers': 'Chưa có người xem',
    'story.reactions': 'Cảm xúc',
    'story.reply_placeholder': 'Trả lời tin...',

    // ==========================================
    // 6. BẠN BÈ (FRIENDS)
    // ==========================================
    'friends.title': 'Bạn Bè',
    'friends.requests': 'Lời mời kết bạn',
    'friends.all_friends': 'Tất cả bạn bè',
    'friends.suggestions': 'Gợi ý kết bạn',
    'friends.search_placeholder': 'Tìm kiếm bạn bè...',
    'friends.accept': 'Xác nhận',
    'friends.accepted': 'Đã là bạn bè',
    'friends.delete_request': 'Xóa lời mời',
    'friends.add_friend': 'Thêm bạn bè',
    'friends.cancel_request': 'Hủy lời mời',
    'friends.unfriend': 'Hủy kết bạn',
    'friends.message': 'Nhắn tin',
    'friends.mutual_friends': '{count} bạn chung',
    'friends.no_requests': 'Không có lời mời kết bạn nào',
    'friends.no_requests_desc': 'Khi có người gửi lời mời kết bạn, bạn sẽ thấy ở đây.',
    'friends.no_friends': 'Chưa có bạn bè nào',
    'friends.no_suggestions': 'Hiện không có thêm gợi ý kết bạn nào mới.',
    'friends.confirm_unfriend': 'Bạn có chắc chắn muốn hủy kết bạn với người này?',

    // ==========================================
    // 7. TIN NHẮN (MESSAGES)
    // ==========================================
    'messages.title': 'Đoạn chat',
    'messages.chats': 'Đoạn chat',
    'messages.main_inbox': 'Hộp thư chính',
    'messages.message_requests': 'Tin nhắn chờ',
    'messages.search_placeholder': 'Tìm bạn bè hoặc tin nhắn...',
    'messages.search_requests': 'Tìm trong tin nhắn chờ...',
    'messages.type_message': 'Nhập tin nhắn...',
    'messages.send': 'Gửi',
    'messages.create_group': 'Tạo nhóm',
    'messages.create_group_title': 'Tạo nhóm trò chuyện',
    'messages.group_name': 'Tên nhóm trò chuyện',
    'messages.group_name_placeholder': 'Nhập tên nhóm...',
    'messages.select_members': 'Chọn thành viên tham gia',
    'messages.search_friends_by_name': 'Tìm bạn bè theo tên...',
    'messages.create_group_btn': 'Tạo nhóm',
    'messages.creating_group': 'Đang tạo nhóm...',
    'messages.active_now': 'Đang hoạt động',
    'messages.offline': 'Không hoạt động',
    'messages.voice_call': 'Cuộc gọi thoại',
    'messages.video_call': 'Cuộc gọi video',
    'messages.recall_message': 'Thu hồi tin nhắn',
    'messages.recalled': 'Tin nhắn đã được thu hồi',
    'messages.reply': 'Trả lời',
    'messages.forward': 'Chuyển tiếp',
    'messages.realtime_connected': 'Kết nối thời gian thực',
    'messages.connecting': 'Đang kết nối máy chủ...',
    'messages.no_conversation_selected': 'Chọn một đoạn chat để bắt đầu trò chuyện',
    'messages.shared_media': 'File & Phương tiện đã chia sẻ',
    'messages.block_user': 'Chặn người dùng',

    // ==========================================
    // 8. THÔNG BÁO (NOTIFICATIONS)
    // ==========================================
    'notifications.title': 'Thông Báo',
    'notifications.subtitle': 'Cập nhật tương tác bài viết, thông báo bạn bè và cảnh báo kiểm duyệt AI',
    'notifications.mark_all_read': 'Đánh dấu tất cả đã đọc',
    'notifications.filter_all': 'Tất cả',
    'notifications.filter_unread': 'Chưa đọc',
    'notifications.filter_system': 'Hệ thống & AI',
    'notifications.empty_title': 'Chưa có thông báo nào',
    'notifications.empty_all': 'Khi có người thích, bình luận hoặc tương tác, thông báo sẽ hiển thị ở đây.',
    'notifications.empty_unread': 'Tuyệt vời! Bạn đã đọc hết tất cả thông báo hiện có.',
    'notifications.empty_system': 'Không có cảnh báo vi phạm hay thông báo hệ thống nào.',
    'notifications.delete_notification': 'Xóa thông báo',
    'notifications.refresh': 'Làm mới thông báo',

    // ==========================================
    // 9. TRANG CÁ NHÂN (PROFILE)
    // ==========================================
    'profile.tab_all': 'Tất cả',
    'profile.tab_posts': 'Bài viết',
    'profile.tab_about': 'Giới thiệu',
    'profile.tab_friends': 'Bạn bè',
    'profile.tab_photos': 'Ảnh',
    'profile.tab_videos': 'Video',
    'profile.edit_profile': 'Chỉnh sửa trang cá nhân',
    'profile.add_friend': 'Thêm bạn bè',
    'profile.cancel_request': 'Hủy lời mời',
    'profile.respond_request': 'Phản hồi lời mời',
    'profile.is_friend': 'Bạn bè',
    'profile.unfriend': 'Hủy kết bạn',
    'profile.message': 'Nhắn tin',
    'profile.block': 'Chặn',
    'profile.unblock': 'Bỏ chặn',
    'profile.share_page': 'Chia sẻ trang',
    'profile.tab_all': 'Tất cả bài viết',
    'profile.tab_about': 'Giới thiệu',
    'profile.tab_friends': 'Bạn bè',
    'profile.tab_photos': 'Hình ảnh',
    'profile.tab_reels': 'Reels',
    'profile.friends_count': 'bạn bè',
    'profile.followers': 'người theo dõi',
    'profile.following': 'đang theo dõi',
    'profile.intro_title': 'Giới thiệu bản thân',
    'profile.bio_empty': 'Chưa có tiểu sử.',
    'profile.lives_in': 'Sống tại',
    'profile.from': 'Đến từ',
    'profile.works_at': 'Làm việc tại',
    'profile.studied_at': 'Học tại',
    'profile.relationship': 'Tình trạng mối quan hệ',
    'profile.joined': 'Tham gia từ',
    'profile.photos_title': 'Hình ảnh',
    'profile.no_photos': 'Chưa có hình ảnh nào được tải lên.',
    'profile.friends_title': 'Danh sách bạn bè',
    'profile.no_friends_yet': 'Chưa có bạn bè nào.',
    'profile.posts_title': 'Bài viết gần đây',
    'profile.no_posts_yet': 'Chưa có bài viết nào.',
    'profile.change_cover': 'Chỉnh sửa ảnh bìa',
    'profile.change_avatar': 'Cập nhật ảnh đại diện',

    // ==========================================
    // 10. CHỈNH SỬA HỒ SƠ MODAL (EDIT PROFILE MODAL)
    // ==========================================
    'edit_profile.title': 'Chỉnh sửa trang cá nhân',
    'edit_profile.avatar_cover': 'Ảnh đại diện & Ảnh bìa',
    'edit_profile.avatar': 'Ảnh đại diện (Avatar)',
    'edit_profile.cover': 'Ảnh bìa (Cover Photo)',
    'edit_profile.choose_avatar_file': 'Tải ảnh từ máy tính',
    'edit_profile.choose_cover_file': 'Chọn ảnh bìa từ máy tính',
    'edit_profile.paste_url': 'Dán link URL',
    'edit_profile.hide_url': 'Ẩn link URL',
    'edit_profile.bio': 'Tiểu sử (Bio)',
    'edit_profile.bio_placeholder': 'Mô tả bản thân một cách ngắn gọn...',
    'edit_profile.details': 'Thông tin chi tiết',
    'edit_profile.full_name': 'Tên hiển thị',
    'edit_profile.phone': 'Số điện thoại liên hệ',
    'edit_profile.workplace': 'Nơi làm việc / Nghề nghiệp',
    'edit_profile.workplace_placeholder': 'Ví dụ: Kỹ sư phần mềm tại Nexus Corp',
    'edit_profile.education': 'Học vấn / Trường học',
    'edit_profile.education_placeholder': 'Ví dụ: Đại học Bách Khoa',
    'edit_profile.city': 'Tỉnh / Thành phố hiện tại',
    'edit_profile.city_placeholder': 'Ví dụ: Hà Nội, Việt Nam',
    'edit_profile.hometown': 'Quê quán',
    'edit_profile.hometown_placeholder': 'Ví dụ: Đà Nẵng, Việt Nam',
    'edit_profile.relationship': 'Tình trạng mối quan hệ',
    'edit_profile.relationship_single': 'Độc thân',
    'edit_profile.relationship_in_relationship': 'Đang hẹn hò',
    'edit_profile.relationship_engaged': 'Đã đính hôn',
    'edit_profile.relationship_married': 'Đã kết hôn',
    'edit_profile.relationship_complicated': 'Có mối quan hệ phức tạp',
    'edit_profile.cancel': 'Hủy',
    'edit_profile.save': 'Lưu thay đổi',
    'edit_profile.saving': 'Đang lưu...',

    // ==========================================
    // 11. CÀI ĐẶT & QUYỀN RIÊNG TƯ (SETTINGS VIEW)
    // ==========================================
    'settings.title': 'Cài Đặt & Quyền Riêng Tư',
    'settings.subtitle': 'Quản lý an toàn tài khoản, quyền riêng tư, thông báo và trải nghiệm cá nhân.',
    'settings.categories': 'Danh mục cài đặt',
    'settings.tab.safety': 'An Toàn & Lá Chắn AI',
    'settings.tab.profile': 'Hồ Sơ Cá Nhân',
    'settings.tab.security': 'Mật Khẩu & Bảo Mật',
    'settings.tab.privacy': 'Quyền Riêng Tư',
    'settings.tab.blocked': 'Danh Sách Chặn',
    'settings.tab.notifications': 'Thông Báo & Âm Thanh',
    'settings.tab.appearance': 'Giao Diện & Ngôn Ngữ',

    // Tab 1: An toàn & Từ khóa
    'safety.title': 'Danh Sách Từ Khóa Cấm & An Toàn',
    'safety.subtitle': 'Thiết lập danh sách các từ ngữ cấm để tự động ngăn chặn công kích và bình luận độc hại hướng về bạn.',
    'safety.blacklist_title': 'Danh Sách Từ Khóa Cấm Cá Nhân (Keyword Blacklist)',
    'safety.blacklist_desc': 'Bình luận hoặc tin nhắn chứa những từ khóa này sẽ bị chặn ngay lập tức.',
    'safety.input_placeholder': 'Nhập từ hoặc cụm từ bạn muốn chặn rồi ấn Thêm...',
    'safety.add_btn': 'Thêm',
    'safety.empty_keywords': 'Chưa có từ khóa nào trong danh sách.',
    'safety.quick_suggestions': 'Gợi ý thêm nhanh:',
    'safety.preset_body_shaming': '+ Miệt thị ngoại hình',
    'safety.preset_violence': '+ Từ ngữ bạo lực',
    'safety.save_btn': 'Lưu Danh Sách Từ Khóa',
    'safety.keywords_count': '{count} từ khóa',

    // Tab 2: Hồ sơ cài đặt
    'settings_profile.title': 'Thông Tin Hồ Sơ & Tài Khoản',
    'settings_profile.subtitle': 'Cập nhật các thông tin hiển thị với bạn bè và cộng đồng NexusSocial.',
    'settings_profile.avatar_label': 'Ảnh đại diện (Avatar URL)',
    'settings_profile.cover_label': 'Ảnh bìa (Cover URL)',
    'settings_profile.name_label': 'Tên hiển thị',
    'settings_profile.phone_label': 'Số điện thoại liên hệ',
    'settings_profile.bio_label': 'Tiểu sử bản thân (Bio)',
    'settings_profile.location_label': 'Vị trí / Quê quán',
    'settings_profile.education_label': 'Học vấn / Trường học',
    'settings_profile.work_label': 'Nơi làm việc / Nghề nghiệp',
    'settings_profile.relationship_label': 'Tình trạng quan hệ',
    'settings_profile.save_btn': 'Lưu Thông Tin Hồ Sơ',

    // Tab 3: Mật khẩu & Bảo mật
    'security.title': 'Mật Khẩu & Bảo Mật Tài Khoản',
    'security.subtitle': 'Bảo vệ tài khoản bằng mật khẩu mạnh và tính năng xác thực an toàn.',
    'security.change_password': 'Đổi Mật Khẩu Đăng Nhập',
    'security.current_password': 'Mật khẩu hiện tại',
    'security.new_password': 'Mật khẩu mới',
    'security.confirm_password': 'Xác nhận mật khẩu mới',
    'security.password_hint': '(Ít nhất 8 ký tự, có chữ hoa, thường và số)',
    'security.update_btn': 'Cập Nhật Mật Khẩu',
    'security.updating': 'Đang cập nhật...',
    'security.hide_pwd': 'Ẩn mật khẩu',
    'security.show_pwd': 'Hiện mật khẩu',
    'security.2fa_title': 'Xác thực 2 yếu tố (2FA)',
    'security.2fa_desc': 'Yêu cầu mã xác thực OTP gửi qua email mỗi khi đăng nhập trên thiết bị lạ.',
    'security.2fa_enabled': 'Đã kích hoạt bảo mật 2 lớp',
    'security.2fa_disabled': 'Chưa kích hoạt',

    // Tab 4: Quyền riêng tư
    'privacy.title': 'Cài Đặt Quyền Riêng Tư',
    'privacy.subtitle': 'Kiểm soát đối tượng có thể xem nội dung và tương tác với bạn.',
    'privacy.default_post': 'Quyền riêng tư mặc định khi tạo bài viết mới',
    'privacy.public': 'Công khai',
    'privacy.public_desc': 'Mọi người trên mạng xã hội đều xem được.',
    'privacy.friends': 'Bạn bè',
    'privacy.friends_desc': 'Chỉ những người đã kết bạn mới xem được.',
    'privacy.private': 'Chỉ mình tôi',
    'privacy.private_desc': 'Nội dung riêng tư, chỉ mình bạn xem được.',
    'privacy.who_can_request': 'Ai có thể gửi cho bạn lời mời kết bạn?',
    'privacy.who_can_request_desc': 'Kiểm soát những ai có thể nhìn thấy nút kết bạn và gửi lời mời kết bạn đến tài khoản của bạn.',
    'privacy.everyone': 'Mọi người',
    'privacy.everyone_desc': 'Bất kỳ ai trên mạng xã hội cũng có thể gửi lời mời kết bạn cho bạn.',
    'privacy.friends_of_friends': 'Bạn của bạn bè',
    'privacy.friends_of_friends_desc': 'Chỉ những người có ít nhất một bạn chung với bạn mới có thể gửi lời mời.',
    'privacy.who_can_message': 'Ai có thể nhắn tin trực tiếp cho bạn?',
    'privacy.who_can_message_desc': 'Kiểm soát những người có thể nhắn tin trực tiếp tới hộp thư của bạn.',
    'privacy.show_email': 'Hiển thị Email trên hồ sơ công khai',
    'privacy.show_email_desc': 'Cho phép người khác nhìn thấy email của bạn trên trang cá nhân.',
    'privacy.show_phone': 'Hiển thị Số điện thoại trên hồ sơ công khai',
    'privacy.show_phone_desc': 'Cho phép người khác nhìn thấy số điện thoại của bạn trên trang cá nhân.',
    'privacy.save_btn': 'Lưu Quyền Riêng Tư',
    'privacy.saving': 'Đang lưu...',

    // Tab 5: Danh sách chặn
    'blocked.title': 'Danh Sách Người Dùng Bị Chặn',
    'blocked.subtitle': 'Quản lý những tài khoản bị hạn chế tương tác và xem bài viết của bạn.',
    'blocked.unblock_btn': 'Bỏ chặn',
    'blocked.empty': 'Chưa có ai trong danh sách chặn.',

    // Tab 6: Cài đặt thông báo & Âm thanh
    'notifications_settings.title': 'Cài Đặt Thông Báo & Âm Thanh',
    'notifications_settings.subtitle': 'Tùy chỉnh các sự kiện bạn muốn nhận chuông hoặc thông báo trên ứng dụng.',
    'notifications_settings.sound': 'Âm thanh thông báo',
    'notifications_settings.sound_desc': 'Phát âm thanh chuông khi có tin nhắn hoặc thông báo mới.',
    'notifications_settings.likes': 'Thông báo lượt thích & cảm xúc',
    'notifications_settings.comments': 'Thông báo bình luận bài viết',
    'notifications_settings.requests': 'Thông báo lời mời kết bạn',
    'notifications_settings.ai_warnings': 'Cảnh báo AI chống bạo lực & An toàn',
    'notifications_settings.save_btn': 'Lưu Cài Đặt Thông Báo',

    // Tab 7: Giao diện & Ngôn ngữ
    'appearance.title': 'Giao Diện & Ngôn Ngữ Hiển Thị',
    'appearance.subtitle': 'Tùy chỉnh tông màu và ngôn ngữ hiển thị trên toàn bộ nền tảng.',
    'appearance.theme_title': 'Chế độ giao diện',
    'appearance.theme_light': 'Sáng',
    'appearance.theme_dark': 'Tối',
    'appearance.theme_system': 'Theo hệ thống',
    'appearance.lang_title': 'Ngôn ngữ hiển thị',
    'appearance.lang_vi': 'Tiếng Việt',
    'appearance.lang_en': 'English',
    'appearance.lang_vi_sub': 'Mặc định',
    'appearance.lang_en_sub': 'International',

    // ==========================================
    // 12. XÁC THỰC TÀI KHOẢN (AUTH MODAL)
    // ==========================================
    'auth.login_title': 'Đăng nhập',
    'auth.register_title': 'Đăng ký tài khoản',
    'auth.email_or_username': 'Email hoặc Tên người dùng',
    'auth.password': 'Mật khẩu',
    'auth.forgot_password': 'Quên mật khẩu?',
    'auth.login_btn': 'Đăng nhập vào hệ thống',
    'auth.register_btn': 'Đăng ký & Nhận mã qua Gmail',
    'auth.full_name': 'Họ và tên',
    'auth.username': 'Tên người dùng (Username)',
    'auth.email': 'Địa chỉ Email Gmail',
    'auth.confirm_password': 'Xác nhận lại mật khẩu',
    'auth.have_account': 'Đã có tài khoản?',
    'auth.no_account': 'Chưa có tài khoản?',
    'auth.login_now': 'Đăng nhập ngay',
    'auth.register_now': 'Tạo tài khoản mới',
    'auth.sample_accounts': '💡 Tài khoản mẫu đăng nhập nhanh:',

    // ==========================================
    // 13. DÙNG CHUNG (COMMON)
    // ==========================================
    'common.save': 'Lưu thay đổi',
    'common.cancel': 'Hủy',
    'common.edit': 'Chỉnh sửa',
    'common.delete': 'Xóa',
    'common.close': 'Đóng',
    'common.confirm': 'Xác nhận',
    'common.success': 'Thành công',
    'common.error': 'Lỗi',
    'common.loading': 'Đang tải...',
    'common.search': 'Tìm kiếm',
    'common.all': 'Tất cả',
    'common.view': 'Xem',
    'common.back': 'Quay lại',
    'common.add': 'Thêm',
    'common.retry': 'Thử lại',

    // ==========================================
    // 14. ADMIN & MODERATION (BỔ SUNG)
    // ==========================================
    'admin.title': 'Khu vực quản trị hệ thống',
    'admin.subtitle': 'Quản lý tài khoản người dùng, phân cấp vai trò và giám sát vận hành nền tảng.',
    'admin.open_moderation': 'Mở khu vực kiểm duyệt',
    'admin.tab_users': 'Người dùng và phân quyền',
    'admin.tab_dashboard': 'Tổng quan hệ thống',
    'admin.role_filter': 'Vai trò:',
    'admin.all_roles': 'Tất cả vai trò',
    'admin.refresh': 'Làm mới',
    'admin.th_user': 'Người dùng',
    'admin.th_contact': 'Liên hệ',
    'admin.th_verified': 'Tích xanh',
    'admin.th_role': 'Vai trò hiện tại',
    'admin.th_status': 'Trạng thái',
    'admin.th_trust': 'Điểm uy tín',
    'admin.th_assign_role': 'Phân vai trò',
    'admin.granted': 'Đã cấp',
    'admin.grant': 'Cấp tích',
    'admin.active': 'Hoạt động',
    'admin.unlock': 'Mở khóa',
    'admin.lock_acc': 'Khóa TK',
    'admin.clear_penalty': 'Gỡ phạt oan',
    'admin.total_accounts': 'Tổng số tài khoản',
    'admin.registered_desc': 'Đã đăng ký trong hệ thống',
    'admin.admins_count': 'Quản trị viên (Admin)',
    'admin.admins_desc': 'Nắm toàn quyền hệ thống',
    'admin.moderators_count': 'Điều hành viên (Moderator)',
    'admin.moderators_desc': 'Chịu trách nhiệm kiểm duyệt',
    'admin.moderation_section': 'Báo cáo & Kiểm duyệt nội dung',
    'admin.moderation_desc': 'Khung giao diện theo dõi tiến trình kiểm duyệt.',
    'admin.open_moderation_page': 'Mở trang kiểm duyệt',
    'admin.no_stats_yet': 'Chưa có số liệu thống kê tự động',
    'admin.no_stats_desc': 'Bảng điều khiển KPI sẽ cập nhật số liệu tự động khi kích hoạt đầy đủ mô hình kiểm duyệt PhoBERT và luồng tiếp nhận báo cáo.',

    'moderation.back_to_admin': 'Về trang quản trị',
    'moderation.title': 'Khu vực kiểm duyệt',
    'moderation.subtitle': 'Xử lý báo cáo vi phạm, giải quyết khiếu nại minh oan và giám sát nội dung bị ẩn.',
    'moderation.refresh_db': 'Làm mới CSDL',
    'moderation.search_placeholder': 'Tìm theo nội dung, tác giả...',
    'moderation.tab_image_review': 'Duyệt ảnh',
    'moderation.tab_image_appeals': 'Duyệt khiếu nại',
    'moderation.tab_appeals': 'Khiếu nại',
    'moderation.tab_reports': 'Báo cáo',
    'moderation.tab_hidden': 'Nội dung bị ẩn',
    'moderation.tab_audit': 'Nhật ký gán nhãn & Xuất file',
    'moderation.appeals_list_title': 'Danh sách khiếu nại',
    'moderation.appeals_list_desc': 'Xử lý khiếu nại từ thành viên: Chấp nhận khiếu nại (đổi nhãn & gỡ phạt), Từ chối khiếu nại (giữ nguyên nhãn và hình phạt).',
    'moderation.filter_all': 'Tất cả',
    'moderation.filter_pending': 'Chờ xử lý',
    'moderation.filter_approved': 'Đã chấp nhận',
    'moderation.filter_rejected': 'Đã từ chối',
    'moderation.all_content_types': 'Tất cả loại nội dung',
    'moderation.all_labels': 'Tất cả nhãn hiện tại',
    'moderation.th_appeal_content': 'Nội dung khiếu nại',
    'moderation.th_type': 'Loại',
    'moderation.th_label': 'Nhãn hiện tại',
    'moderation.th_appellant': 'Người khiếu nại',
    'moderation.th_date': 'Ngày gửi',
    'moderation.th_status': 'Trạng thái',
    'moderation.th_actions': 'Thao tác',
    'moderation.post': 'Bài viết',
    'moderation.comment': 'Bình luận',
    'moderation.view_details': 'Xem chi tiết',
    'moderation.explanation': 'Giải trình:',

    'livestream.start_title': 'Khởi tạo buổi phát trực tiếp',
    'livestream.start_subtitle': 'Kết nối và giao lưu an toàn với cộng đồng',
    'livestream.camera_unconnected': 'Camera chưa kết nối hoặc chưa được cấp quyền',
    'livestream.cyberbullying_active': 'Bảo vệ chống bạo lực mạng kích hoạt',
    'livestream.stream_title': 'Tiêu đề phát trực tiếp',
    'livestream.stream_title_placeholder': 'VD: Cùng tâm sự và chia sẻ kiến thức tích cực...',
    'livestream.category': 'Chủ đề',
    'livestream.category_chat': 'Giao lưu / Trò chuyện',
    'livestream.category_study': 'Học tập & Chia sẻ',
    'livestream.category_safe_talk': 'Tâm sự an toàn',
    'livestream.category_entertainment': 'Giải trí lành mạnh',
    'livestream.description': 'Mô tả (tùy chọn)',
    'livestream.description_placeholder': 'Mô tả ngắn gọn...',
    'livestream.start_btn': 'Bắt đầu phát trực tiếp',
    'livestream.starting': 'Đang tạo...'
  },

  en: {
    // ==========================================
    // 1. NAVBAR / HEADER
    // ==========================================
    'nav.home': 'Home',
    'nav.live': 'Live',
    'nav.friends': 'Friends',
    'nav.messages': 'Messages',
    'nav.notifications': 'Notifications',
    'nav.moderation': 'Moderation',
    'nav.admin': 'Admin',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings & Privacy',
    'nav.login': 'Log In',
    'nav.register': 'Sign Up',
    'nav.logout': 'Log Out',
    'nav.search': 'Search on Wings...',
    'nav.theme_dark': 'Dark Mode',
    'nav.theme_light': 'Light Mode',
    'nav.user_menu': 'Account Menu',
    'nav.ai_lab': 'AI Lab',
    'nav.admin_panel': 'Admin Dashboard',
    'nav.moderation_panel': 'Moderation Queue',
    'nav.switch_to_light': 'Switch to Light Mode',
    'nav.switch_to_dark': 'Switch to Dark Mode',

    // ==========================================
    // 2. HOME FEED
    // ==========================================
    'home.for_you': 'For You',
    'home.following': 'Following',
    'home.refresh': 'Refresh',
    'home.refresh_title': 'Refresh news feed',
    'home.clear_filter': 'Clear Filter',
    'home.search_filter_title': 'Search filter:',
    'home.posts_found': 'Found {count} matching posts',
    'home.no_matching_posts': 'No posts matched your search keyword.',
    'home.suggested_friends': 'Suggested Friends',
    'home.see_all_suggestions': 'See All',
    'home.trending_topics': 'Trending Topics',
    'home.no_trending': 'No trending topics yet',
    'home.online_contacts': 'Online Contacts',
    'home.sponsored': 'Sponsored',

    // ==========================================
    // 3. CREATE POST
    // ==========================================
    'create_post.placeholder': "What's on your mind, {name}?",
    'create_post.placeholder_default': "What's on your mind?",
    'create_post.placeholder_guest': 'Log in to share posts with the community...',
    'create_post.photo_video': 'Photo/Video',
    'create_post.feeling': 'Feeling/Activity',
    'create_post.audio': 'Audio',
    'create_post.submit': 'Post',
    'create_post.submitting': 'Posting...',
    'create_post.uploading': 'Uploading image...',
    'create_post.privacy_public': 'Public',
    'create_post.privacy_friends': 'Friends',
    'create_post.privacy_private': 'Only Me',
    'create_post.banned_notice': 'Your account is currently restricted from posting and commenting.',
    'create_post.success': 'Post published successfully',

    // ==========================================
    // 4. POSTS & INTERACTIONS
    // ==========================================
    'post.like': 'Like',
    'post.liked': 'Liked',
    'post.comment': 'Comment',
    'post.share': 'Share',
    'post.comments_count': 'comments',
    'post.shares_count': 'shares',
    'post.write_comment': 'Write a comment...',
    'post.press_enter': 'Press Enter to post',
    'post.edit': 'Edit Post',
    'post.delete': 'Delete Post',
    'post.report': 'Report Post',
    'post.hide': 'Hide Post',
    'post.shared_post': 'shared a post',
    'post.edited': 'Edited',
    'post.just_now': 'Just now',
    'post.minutes_ago': '{n}m ago',
    'post.hours_ago': '{n}h ago',
    'post.days_ago': '{n}d ago',
    'post.weeks_ago': '{n}w ago',
    'post.view_all_comments': 'View more comments',
    'post.delete_confirm': 'Are you sure you want to delete this post?',
    'post.toxic_warning_title': 'Content may contain sensitive or toxic elements',
    'post.toxic_warning_desc': 'Our AI system detected content that may violate community standards.',
    'post.show_content': 'Show content',
    'post.hide_content': 'Hide content',

    // ==========================================
    // 5. STORIES
    // ==========================================
    'story.create_story': 'Create Story',
    'story.your_story': 'Your Story',
    'story.viewers': 'Story Viewers',
    'story.no_viewers': 'No viewers yet',
    'story.reactions': 'Reactions',
    'story.reply_placeholder': 'Reply to story...',

    // ==========================================
    // 6. FRIENDS
    // ==========================================
    'friends.title': 'Friends',
    'friends.requests': 'Friend Requests',
    'friends.all_friends': 'All Friends',
    'friends.suggestions': 'Suggested Friends',
    'friends.search_placeholder': 'Search friends...',
    'friends.accept': 'Confirm',
    'friends.accepted': 'Friends',
    'friends.delete_request': 'Delete Request',
    'friends.add_friend': 'Add Friend',
    'friends.cancel_request': 'Cancel Request',
    'friends.unfriend': 'Unfriend',
    'friends.message': 'Message',
    'friends.mutual_friends': '{count} mutual friends',
    'friends.no_requests': 'No friend requests',
    'friends.no_requests_desc': 'When people send you friend requests, they will show up here.',
    'friends.no_friends': 'No friends yet',
    'friends.no_suggestions': 'No new friend suggestions at this time.',
    'friends.confirm_unfriend': 'Are you sure you want to unfriend this user?',

    // ==========================================
    // 7. MESSAGES & CHAT
    // ==========================================
    'messages.title': 'Chats',
    'messages.chats': 'Chats',
    'messages.main_inbox': 'Primary',
    'messages.message_requests': 'Message Requests',
    'messages.search_placeholder': 'Search friends or messages...',
    'messages.search_requests': 'Search in requests...',
    'messages.type_message': 'Type a message...',
    'messages.send': 'Send',
    'messages.create_group': 'Create Group',
    'messages.create_group_title': 'Create Group Chat',
    'messages.group_name': 'Group Name',
    'messages.group_name_placeholder': 'Enter group name...',
    'messages.select_members': 'Select Members',
    'messages.search_friends_by_name': 'Search friends by name...',
    'messages.create_group_btn': 'Create Group',
    'messages.creating_group': 'Creating group...',
    'messages.active_now': 'Active now',
    'messages.offline': 'Offline',
    'messages.voice_call': 'Audio Call',
    'messages.video_call': 'Video Call',
    'messages.recall_message': 'Unsend message',
    'messages.recalled': 'This message was unsent',
    'messages.reply': 'Reply',
    'messages.forward': 'Forward',
    'messages.realtime_connected': 'Realtime Connected',
    'messages.connecting': 'Connecting to server...',
    'messages.no_conversation_selected': 'Select a chat to start messaging',
    'messages.shared_media': 'Shared Files & Media',
    'messages.block_user': 'Block User',

    // ==========================================
    // 8. NOTIFICATIONS
    // ==========================================
    'notifications.title': 'Notifications',
    'notifications.subtitle': 'Updates on your posts, friend activities, and AI safety alerts',
    'notifications.mark_all_read': 'Mark all as read',
    'notifications.filter_all': 'All',
    'notifications.filter_unread': 'Unread',
    'notifications.filter_system': 'System & AI',
    'notifications.empty_title': 'No notifications yet',
    'notifications.empty_all': 'When you receive likes, comments, or interactions, they will appear here.',
    'notifications.empty_unread': 'Great! You have caught up on all notifications.',
    'notifications.empty_system': 'No policy violations or system alerts.',
    'notifications.delete_notification': 'Delete notification',
    'notifications.refresh': 'Refresh notifications',

    // ==========================================
    // 9. PROFILE
    // ==========================================
    'profile.tab_all': 'All',
    'profile.tab_posts': 'Posts',
    'profile.tab_about': 'About',
    'profile.tab_friends': 'Friends',
    'profile.tab_photos': 'Photos',
    'profile.tab_videos': 'Videos',
    'profile.edit_profile': 'Edit Profile',
    'profile.add_friend': 'Add Friend',
    'profile.cancel_request': 'Cancel Request',
    'profile.respond_request': 'Respond',
    'profile.is_friend': 'Friends',
    'profile.unfriend': 'Unfriend',
    'profile.message': 'Message',
    'profile.block': 'Block',
    'profile.unblock': 'Unblock',
    'profile.share_page': 'Share Page',
    'profile.tab_all': 'All Posts',
    'profile.tab_about': 'About',
    'profile.tab_friends': 'Friends',
    'profile.tab_photos': 'Photos',
    'profile.tab_reels': 'Reels',
    'profile.friends_count': 'friends',
    'profile.followers': 'followers',
    'profile.following': 'following',
    'profile.intro_title': 'Intro',
    'profile.bio_empty': 'No bio provided.',
    'profile.lives_in': 'Lives in',
    'profile.from': 'From',
    'profile.works_at': 'Works at',
    'profile.studied_at': 'Studied at',
    'profile.relationship': 'Relationship Status',
    'profile.joined': 'Joined',
    'profile.photos_title': 'Photos',
    'profile.no_photos': 'No photos uploaded yet.',
    'profile.friends_title': 'Friends',
    'profile.no_friends_yet': 'No friends yet.',
    'profile.posts_title': 'Recent Posts',
    'profile.no_posts_yet': 'No posts yet.',
    'profile.change_cover': 'Edit Cover Photo',
    'profile.change_avatar': 'Update Profile Picture',

    // ==========================================
    // 10. EDIT PROFILE MODAL
    // ==========================================
    'edit_profile.title': 'Edit Profile',
    'edit_profile.avatar_cover': 'Profile Picture & Cover Photo',
    'edit_profile.avatar': 'Profile Picture',
    'edit_profile.cover': 'Cover Photo',
    'edit_profile.choose_avatar_file': 'Upload from Computer',
    'edit_profile.choose_cover_file': 'Choose cover photo from computer',
    'edit_profile.paste_url': 'Paste Image URL',
    'edit_profile.hide_url': 'Hide Image URL',
    'edit_profile.bio': 'Bio',
    'edit_profile.bio_placeholder': 'Describe yourself briefly...',
    'edit_profile.details': 'Details',
    'edit_profile.full_name': 'Full Name',
    'edit_profile.phone': 'Phone Number',
    'edit_profile.workplace': 'Workplace / Occupation',
    'edit_profile.workplace_placeholder': 'e.g., Software Engineer at Nexus Corp',
    'edit_profile.education': 'Education / School',
    'edit_profile.education_placeholder': 'e.g., Stanford University',
    'edit_profile.city': 'Current City',
    'edit_profile.city_placeholder': 'e.g., Hanoi, Vietnam',
    'edit_profile.hometown': 'Hometown',
    'edit_profile.hometown_placeholder': 'e.g., Da Nang, Vietnam',
    'edit_profile.relationship': 'Relationship Status',
    'edit_profile.relationship_single': 'Single',
    'edit_profile.relationship_in_relationship': 'In a relationship',
    'edit_profile.relationship_engaged': 'Engaged',
    'edit_profile.relationship_married': 'Married',
    'edit_profile.relationship_complicated': "It's complicated",
    'edit_profile.cancel': 'Cancel',
    'edit_profile.save': 'Save Changes',
    'edit_profile.saving': 'Saving...',

    // ==========================================
    // 11. SETTINGS & PRIVACY
    // ==========================================
    'settings.title': 'Settings & Privacy',
    'settings.subtitle': 'Manage your account safety, privacy, notifications, and personalized experience.',
    'settings.categories': 'Settings Menu',
    'settings.tab.safety': 'AI Safety & Shield',
    'settings.tab.profile': 'Profile Info',
    'settings.tab.security': 'Security & Password',
    'settings.tab.privacy': 'Privacy',
    'settings.tab.blocked': 'Blocked Users',
    'settings.tab.notifications': 'Notifications & Sounds',
    'settings.tab.appearance': 'Appearance & Language',

    // Tab 1: AI Safety & Blacklist
    'safety.title': 'Keyword Blacklist & Content Safety',
    'safety.subtitle': 'Set up a blacklist of prohibited words to automatically filter toxic comments and insults directed at you.',
    'safety.blacklist_title': 'Personal Keyword Blacklist',
    'safety.blacklist_desc': 'Comments or messages containing these keywords will be filtered immediately.',
    'safety.input_placeholder': 'Enter word or phrase to block, then press Add...',
    'safety.add_btn': 'Add',
    'safety.empty_keywords': 'No keywords in your blacklist yet.',
    'safety.quick_suggestions': 'Quick Suggestions:',
    'safety.preset_body_shaming': '+ Body Shaming',
    'safety.preset_violence': '+ Violent Terms',
    'safety.save_btn': 'Save Keyword List',
    'safety.keywords_count': '{count} keywords',

    // Tab 2: Profile Settings
    'settings_profile.title': 'Profile & Account Details',
    'settings_profile.subtitle': 'Update the details visible to friends and the community.',
    'settings_profile.avatar_label': 'Profile Picture (Avatar URL)',
    'settings_profile.cover_label': 'Cover Photo (Cover URL)',
    'settings_profile.name_label': 'Full Name',
    'settings_profile.phone_label': 'Phone Number',
    'settings_profile.bio_label': 'Bio',
    'settings_profile.location_label': 'Location / Hometown',
    'settings_profile.education_label': 'Education / School',
    'settings_profile.work_label': 'Workplace / Occupation',
    'settings_profile.relationship_label': 'Relationship Status',
    'settings_profile.save_btn': 'Save Profile Details',

    // Tab 3: Security
    'security.title': 'Password & Account Security',
    'security.subtitle': 'Protect your account with a strong password and multi-factor authentication.',
    'security.change_password': 'Change Login Password',
    'security.current_password': 'Current password',
    'security.new_password': 'New password',
    'security.confirm_password': 'Confirm new password',
    'security.password_hint': '(At least 8 characters, uppercase, lowercase, and numbers)',
    'security.update_btn': 'Update Password',
    'security.updating': 'Updating...',
    'security.hide_pwd': 'Hide password',
    'security.show_pwd': 'Show password',
    'security.2fa_title': 'Two-Factor Authentication (2FA)',
    'security.2fa_desc': 'Require an email OTP code whenever logging in on an unrecognized device.',
    'security.2fa_enabled': 'Two-factor authentication enabled',
    'security.2fa_disabled': 'Disabled',

    // Tab 4: Privacy
    'privacy.title': 'Privacy Settings',
    'privacy.subtitle': 'Control who can view your content and interact with you.',
    'privacy.default_post': 'Default privacy for new posts',
    'privacy.public': 'Public',
    'privacy.public_desc': 'Anyone on the social network can see this.',
    'privacy.friends': 'Friends',
    'privacy.friends_desc': 'Only your confirmed friends can see this.',
    'privacy.private': 'Only Me',
    'privacy.private_desc': 'Private content, only visible to you.',
    'privacy.who_can_request': 'Who can send you friend requests?',
    'privacy.who_can_request_desc': 'Control who can see the add friend button and send friend requests to your account.',
    'privacy.everyone': 'Everyone',
    'privacy.everyone_desc': 'Anyone on the social network can send you friend requests.',
    'privacy.friends_of_friends': 'Friends of friends',
    'privacy.friends_of_friends_desc': 'Only people who share mutual friends with you can send you friend requests.',
    'privacy.who_can_message': 'Who can send you direct messages?',
    'privacy.who_can_message_desc': 'Control who can send direct messages to your inbox.',
    'privacy.show_email': 'Show Email on public profile',
    'privacy.show_email_desc': 'Allow others to see your email address on your profile page.',
    'privacy.show_phone': 'Show Phone Number on public profile',
    'privacy.show_phone_desc': 'Allow others to see your phone number on your profile page.',
    'privacy.save_btn': 'Save Privacy Settings',
    'privacy.saving': 'Saving...',

    // Tab 5: Blocked Users
    'blocked.title': 'Blocked Users',
    'blocked.subtitle': 'Manage accounts that are restricted from interacting with you or seeing your posts.',
    'blocked.unblock_btn': 'Unblock',
    'blocked.empty': 'No blocked users.',

    // Tab 6: Notifications & Sound
    'notifications_settings.title': 'Notification & Sound Settings',
    'notifications_settings.subtitle': 'Customize which events trigger sounds or app notifications.',
    'notifications_settings.sound': 'Notification Sound',
    'notifications_settings.sound_desc': 'Play an audio chime whenever you receive a message or alert.',
    'notifications_settings.likes': 'Likes & Reactions',
    'notifications_settings.comments': 'Post Comments',
    'notifications_settings.requests': 'Friend Requests',
    'notifications_settings.ai_warnings': 'AI Safety & Anti-Harassment Alerts',
    'notifications_settings.save_btn': 'Save Notification Settings',

    // Tab 7: Appearance & Language
    'appearance.title': 'Appearance & Display Language',
    'appearance.subtitle': 'Customize color theme and language across the entire platform.',
    'appearance.theme_title': 'Interface Mode',
    'appearance.theme_light': 'Light',
    'appearance.theme_dark': 'Dark',
    'appearance.theme_system': 'System Default',
    'appearance.lang_title': 'Display Language',
    'appearance.lang_vi': 'Tiếng Việt',
    'appearance.lang_en': 'English',
    'appearance.lang_vi_sub': 'Default',
    'appearance.lang_en_sub': 'International',

    // ==========================================
    // 12. AUTH MODAL
    // ==========================================
    'auth.login_title': 'Log In',
    'auth.register_title': 'Create Account',
    'auth.email_or_username': 'Email or Username',
    'auth.password': 'Password',
    'auth.forgot_password': 'Forgot password?',
    'auth.login_btn': 'Log In to WINGS',
    'auth.register_btn': 'Sign Up & Verify via Gmail',
    'auth.full_name': 'Full Name',
    'auth.username': 'Username',
    'auth.email': 'Gmail Address',
    'auth.confirm_password': 'Confirm Password',
    'auth.have_account': 'Already have an account?',
    'auth.no_account': "Don't have an account?",
    'auth.login_now': 'Log in now',
    'auth.register_now': 'Create new account',
    'auth.sample_accounts': '💡 Quick test accounts:',

    // ==========================================
    // 13. COMMON
    // ==========================================
    'common.save': 'Save Changes',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.success': 'Success',
    'common.error': 'Error',
    'common.loading': 'Loading...',
    'common.search': 'Search',
    'common.all': 'All',
    'common.view': 'View',
    'common.back': 'Back',
    'common.add': 'Add',
    'common.retry': 'Retry',

    // ==========================================
    // 14. ADMIN & MODERATION (ADDITIONS)
    // ==========================================
    'admin.title': 'System Administration',
    'admin.subtitle': 'Manage user accounts, role hierarchy, and monitor platform operations.',
    'admin.open_moderation': 'Open Moderation Center',
    'admin.tab_users': 'Users & Roles',
    'admin.tab_dashboard': 'System Overview',
    'admin.role_filter': 'Role:',
    'admin.all_roles': 'All roles',
    'admin.refresh': 'Refresh',
    'admin.th_user': 'User',
    'admin.th_contact': 'Contact',
    'admin.th_verified': 'Verified',
    'admin.th_role': 'Current Role',
    'admin.th_status': 'Status',
    'admin.th_trust': 'Trust Score',
    'admin.th_assign_role': 'Assign Role',
    'admin.granted': 'Granted',
    'admin.grant': 'Grant badge',
    'admin.active': 'Active',
    'admin.unlock': 'Unlock',
    'admin.lock_acc': 'Lock Account',
    'admin.clear_penalty': 'Pardon',
    'admin.total_accounts': 'Total Accounts',
    'admin.registered_desc': 'Registered in system',
    'admin.admins_count': 'Administrators (Admin)',
    'admin.admins_desc': 'Full system access',
    'admin.moderators_count': 'Moderators (Moderator)',
    'admin.moderators_desc': 'Content moderation duties',
    'admin.moderation_section': 'Reports & Content Moderation',
    'admin.moderation_desc': 'Moderation workflow tracking interface.',
    'admin.open_moderation_page': 'Open Moderation Center',
    'admin.no_stats_yet': 'No automated statistics yet',
    'admin.no_stats_desc': 'KPI dashboard will update automatically when PhoBERT and report workflows are active.',

    'moderation.back_to_admin': 'Back to Admin',
    'moderation.title': 'Content Moderation Center',
    'moderation.subtitle': 'Process violation reports, resolve appeals, and monitor hidden content.',
    'moderation.refresh_db': 'Refresh DB',
    'moderation.search_placeholder': 'Search by content, author...',
    'moderation.tab_image_review': 'Image Review',
    'moderation.tab_image_appeals': 'Image Appeals',
    'moderation.tab_appeals': 'Appeals',
    'moderation.tab_reports': 'Reports',
    'moderation.tab_hidden': 'Hidden Content',
    'moderation.tab_audit': 'Audit Log & Export',
    'moderation.appeals_list_title': 'Appeal List',
    'moderation.appeals_list_desc': 'Handle member appeals: Accept appeal (change label & remove penalty) or Reject appeal (maintain label and penalty).',
    'moderation.filter_all': 'All',
    'moderation.filter_pending': 'Pending',
    'moderation.filter_approved': 'Accepted',
    'moderation.filter_rejected': 'Rejected',
    'moderation.all_content_types': 'All content types',
    'moderation.all_labels': 'All current labels',
    'moderation.th_appeal_content': 'Appeal Content',
    'moderation.th_type': 'Type',
    'moderation.th_label': 'Current Label',
    'moderation.th_appellant': 'Appellant',
    'moderation.th_date': 'Date Sent',
    'moderation.th_status': 'Status',
    'moderation.th_actions': 'Actions',
    'moderation.post': 'Post',
    'moderation.comment': 'Comment',
    'moderation.view_details': 'View Details',
    'moderation.explanation': 'Explanation:',

    'livestream.start_title': 'Start Live Stream',
    'livestream.start_subtitle': 'Connect and interact safely with your community',
    'livestream.camera_unconnected': 'Camera not connected or permission not granted',
    'livestream.cyberbullying_active': 'Cyberbullying protection active',
    'livestream.stream_title': 'Live Stream Title',
    'livestream.stream_title_placeholder': "e.g., Let's chat and share positive thoughts...",
    'livestream.category': 'Category',
    'livestream.category_chat': 'Chat / Casual',
    'livestream.category_study': 'Study & Share',
    'livestream.category_safe_talk': 'Safe Talk',
    'livestream.category_entertainment': 'Healthy Entertainment',
    'livestream.description': 'Description (optional)',
    'livestream.description_placeholder': 'Brief description...',
    'livestream.start_btn': 'Start Live Stream',
    'livestream.starting': 'Starting...'
  }
};

/**
 * Dịch nội dung thông báo hệ thống / tương tác sang Tiếng Anh
 */
export function translateNotificationText(text, isEn) {
  if (!text || !isEn) return text;

  let translated = String(text);

  // 1. Tương tác cơ bản
  translated = translated.replace(/đã thả tim vào ảnh đại diện mới của bạn/gi, 'loved your new profile picture');
  translated = translated.replace(/đã thả tim bài viết của bạn/gi, 'loved your post');
  translated = translated.replace(/đã thả tim vào bài viết của bạn/gi, 'loved your post');
  translated = translated.replace(/đã thả tim/gi, 'loved');
  translated = translated.replace(/đã thả haha vào bài viết của bạn/gi, 'reacted haha to your post');
  translated = translated.replace(/đã thả haha/gi, 'reacted haha');
  translated = translated.replace(/đã thích bài viết của bạn/gi, 'liked your post');
  translated = translated.replace(/đã thích/gi, 'liked');
  translated = translated.replace(/đã bình luận về bài viết của bạn/gi, 'commented on your post');
  translated = translated.replace(/đã bình luận vào bài viết của bạn/gi, 'commented on your post');
  translated = translated.replace(/đã bình luận/gi, 'commented');
  translated = translated.replace(/đã chia sẻ bài viết của bạn/gi, 'shared your post');
  translated = translated.replace(/đã chia sẻ/gi, 'shared');
  translated = translated.replace(/đã gửi cho bạn lời mời kết bạn/gi, 'sent you a friend request');
  translated = translated.replace(/đã chấp nhận lời mời kết bạn của bạn/gi, 'accepted your friend request');
  translated = translated.replace(/đã bắt đầu theo dõi bạn/gi, 'started following you');

  // 2. Cảnh báo kiểm duyệt & thông báo hệ thống
  translated = translated.replace(
    /Nội dung của bạn sau khi xem xét lại được phân loại là Độc hại \(Toxic\) và đã bị giới hạn hiển thị\./gi,
    'Your content was reviewed and classified as Toxic, and its visibility has been limited.'
  );
  translated = translated.replace(
    /Nội dung của bạn sau khi xem xét lại được phân loại là Thù địch \(Hate Speech\) và đã bị giới hạn hiển thị\./gi,
    'Your content was reviewed and classified as Hate Speech, and its visibility has been limited.'
  );
  translated = translated.replace(
    /Nội dung của bạn sau khi xem xét lại được phân loại là Bạo lực \(Violence\) và đã bị giới hạn hiển thị\./gi,
    'Your content was reviewed and classified as Violence, and its visibility has been limited.'
  );
  translated = translated.replace(
    /Bài viết đã bị ẩn sau khi xem xét \(Toxic\)\./gi,
    'Post hidden after review (Toxic).'
  );
  translated = translated.replace(
    /Bài viết đã bị ẩn sau khi xem xét \(Violence\)\./gi,
    'Post hidden after review (Violence).'
  );
  translated = translated.replace(
    /Bài viết đã bị ẩn sau khi xem xét \(Hate Speech\)\./gi,
    'Post hidden after review (Hate Speech).'
  );
  translated = translated.replace(
    /Bài viết của bạn đã vi phạm tiêu chuẩn cộng đồng\./gi,
    'Your post violated community standards.'
  );
  translated = translated.replace(
    /Bình luận của bạn đã vi phạm tiêu chuẩn cộng đồng\./gi,
    'Your comment violated community standards.'
  );
  translated = translated.replace(
    /Thông báo hệ thống/gi,
    'System Notification'
  );
  translated = translated.replace(
    /Báo cáo của bạn đã được tiếp nhận/gi,
    'Your report has been received'
  );
  translated = translated.replace(
    /Khiếu nại của bạn đã được chấp thuận/gi,
    'Your appeal has been approved'
  );
  translated = translated.replace(
    /Khiếu nại của bạn đã bị từ chối/gi,
    'Your appeal has been rejected'
  );

  return translated;
}

/**
 * Lấy mã ngôn ngữ hiện tại (mặc định 'vi')
 */
export function getCurrentLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('nexussocial_language');
      if (saved === 'en' || saved === 'vi') return saved;
    }
  } catch {}
  return 'vi';
}

/**
 * Đặt ngôn ngữ hiển thị và phát tín hiệu thay đổi
 */
export function setAppLanguage(lang) {
  const targetLang = (lang === 'en') ? 'en' : 'vi';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('nexussocial_language', targetLang);
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = targetLang;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexussocial_language_changed', { detail: { language: targetLang } }));
    }
  } catch (err) {
    console.warn('Lỗi khi lưu ngôn ngữ:', err);
  }
  return targetLang;
}

/**
 * Dịch từ khóa theo ngôn ngữ chỉ định với hỗ trợ tham số {key}
 */
export function t(key, params = null, lang = null) {
  const currentLang = (typeof lang === 'string') ? lang : getCurrentLanguage();
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.vi;
  let text = dict[key] || TRANSLATIONS.vi[key] || key;

  if (params && typeof params === 'object') {
    Object.keys(params).forEach(k => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
    });
  }

  return text;
}

/**
 * React Hook useTranslation để re-render tự động khi đổi ngôn ngữ
 */
export function useTranslation() {
  const [lang, setLang] = useState(() => getCurrentLanguage());

  useEffect(() => {
    const handleLangChange = (event) => {
      const newLang = event?.detail?.language || getCurrentLanguage();
      setLang(newLang);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('nexussocial_language_changed', handleLangChange);
      return () => {
        window.removeEventListener('nexussocial_language_changed', handleLangChange);
      };
    }
  }, []);

  const translate = (key, params) => t(key, params, lang);

  return {
    t: translate,
    language: lang,
    isEn: lang === 'en',
    setLanguage: (newLang) => {
      const updated = setAppLanguage(newLang);
      setLang(updated);
      return updated;
    }
  };
}

export default {
  t,
  useTranslation,
  getCurrentLanguage,
  setAppLanguage,
  TRANSLATIONS
};

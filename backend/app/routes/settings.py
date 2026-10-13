from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Optional, List

from ..database import get_db
from ..utils.security import decode_access_token
from ..services.settings_service import SettingsService
from ..schemas.settings import (
    UpdateProfileRequest,
    ChangePasswordRequest,
    SafetySettingsRequest,
    PrivacySettingsRequest,
    NotificationSettingsRequest,
    AppearanceSettingsRequest,
    UserSettingsResponse,
    BlockedUserItem
)
from ..schemas.auth import ApiResponse

router = APIRouter(prefix="/settings", tags=["Cài đặt người dùng & An toàn mạng (Settings)"])

def get_current_user_id(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> str:
    """Dependency lấy user_id từ JWT Bearer token hoặc x-user-id Header"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            return payload["sub"]
    
    # Hỗ trợ x-user-id khi chạy dev hoặc test
    if x_user_id:
        return x_user_id
        
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Yêu cầu đăng nhập để truy cập cài đặt"
    )

@router.get(
    "",
    response_model=UserSettingsResponse,
    summary="Lấy toàn bộ cài đặt người dùng",
    description="Truy xuất thông tin hồ sơ, cài đặt bảo vệ AI chống bạo lực mạng, quyền riêng tư và thông báo"
)
def get_settings(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return SettingsService.get_full_settings(current_user_id, db)

@router.put(
    "/profile",
    response_model=ApiResponse,
    summary="Cập nhật thông tin hồ sơ cá nhân",
    description="Cập nhật tên hiển thị, bio, số điện thoại, vị trí, học vấn, ảnh đại diện"
)
def update_profile(
    req: UpdateProfileRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    user = SettingsService.update_profile(current_user_id, req, db)
    return ApiResponse(
        success=True,
        message="Cập nhật thông tin hồ sơ thành công",
        data={
            "id": user.id,
            "full_name": user.full_name,
            "bio": user.bio,
            "phone": user.phone,
            "avatar_url": user.avatar_url,
            "cover_url": user.cover_url
        }
    )

@router.put(
    "/password",
    response_model=ApiResponse,
    summary="Đổi mật khẩu tài khoản",
    description="Xác thực mật khẩu cũ và cập nhật mật khẩu mới (chuẩn bảo mật 8 ký tự, hoa, thường, số)"
)
def change_password(
    req: ChangePasswordRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    SettingsService.change_password(current_user_id, req, db)
    return ApiResponse(
        success=True,
        message="Đổi mật khẩu thành công. Vui lòng ghi nhớ mật khẩu mới!"
    )

@router.put(
    "/safety",
    response_model=ApiResponse,
    summary="Cập nhật cài đặt khiên bảo vệ AI & Chống bạo lực mạng",
    description="Cấu hình tự động ẩn nội dung độc hại, độ nhạy AI, từ khóa cấm cá nhân và chế độ bảo vệ tâm lý"
)
def update_safety(
    req: SafetySettingsRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    settings = SettingsService.update_safety(current_user_id, req, db)
    return ApiResponse(
        success=True,
        message="Đã cập nhật cấu hình bảo vệ AI phòng chống bạo lực mạng thành công",
        data={
            "ai_shield_enabled": settings.ai_shield_enabled,
            "ai_sensitivity": settings.ai_sensitivity,
            "auto_hide_toxic_comments": settings.auto_hide_toxic_comments,
            "filter_keywords": settings.filter_keywords,
            "take_a_break_mode": settings.take_a_break_mode
        }
    )

@router.put(
    "/privacy",
    response_model=ApiResponse,
    summary="Cập nhật quyền riêng tư",
    description="Tùy chỉnh ai có thể xem bài viết, gửi lời mời kết bạn hoặc tin nhắn"
)
def update_privacy(
    req: PrivacySettingsRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    settings = SettingsService.update_privacy(current_user_id, req, db)
    return ApiResponse(
        success=True,
        message="Đã cập nhật quyền riêng tư thành công",
        data={
            "post_default_privacy": settings.post_default_privacy,
            "who_can_send_friend_requests": settings.who_can_send_friend_requests,
            "show_email": settings.show_email,
            "show_phone": settings.show_phone
        }
    )

@router.put(
    "/notifications",
    response_model=ApiResponse,
    summary="Cập nhật tùy chọn nhận thông báo",
    description="Bật/tắt thông báo tương tác và cảnh báo an ninh AI"
)
def update_notifications(
    req: NotificationSettingsRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    settings = SettingsService.update_notifications(current_user_id, req, db)
    return ApiResponse(
        success=True,
        message="Đã cập nhật cài đặt thông báo thành công"
    )

@router.put(
    "/appearance",
    response_model=ApiResponse,
    summary="Cài đặt giao diện & Ngôn ngữ",
    description="Chọn theme sáng/tối và ngôn ngữ hiển thị"
)
def update_appearance(
    req: AppearanceSettingsRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    settings = SettingsService.update_appearance(current_user_id, req, db)
    return ApiResponse(
        success=True,
        message="Đã cập nhật giao diện thành công",
        data={
            "theme": settings.theme,
            "language": settings.language
        }
    )

@router.post(
    "/2fa/toggle",
    response_model=ApiResponse,
    summary="Bật / Tắt xác thực hai yếu tố (2FA)",
    description="Nâng cao bảo mật đăng nhập tài khoản"
)
def toggle_2fa(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    enabled = SettingsService.toggle_2fa(current_user_id, db)
    return ApiResponse(
        success=True,
        message=f"Đã {'bật' if enabled else 'tắt'} xác thực 2 yếu tố thành công",
        data={"two_factor_enabled": enabled}
    )

@router.get(
    "/blocked-users",
    response_model=List[BlockedUserItem],
    summary="Danh sách người dùng bị chặn",
    description="Lấy danh sách các tài khoản đang bị chặn tương tác"
)
def get_blocked_users(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return SettingsService.get_blocked_users(current_user_id, db)

@router.post(
    "/block/{target_user_id}",
    response_model=ApiResponse,
    summary="Chặn người dùng",
    description="Chặn một tài khoản để ngăn họ tương tác hoặc gửi tin nhắn"
)
def block_user(
    target_user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    SettingsService.block_user(current_user_id, target_user_id, db)
    return ApiResponse(
        success=True,
        message="Đã chặn người dùng thành công"
    )

@router.delete(
    "/block/{target_user_id}",
    response_model=ApiResponse,
    summary="Bỏ chặn người dùng",
    description="Gỡ chặn tài khoản để cho phép tương tác lại bình thường"
)
def unblock_user(
    target_user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    SettingsService.unblock_user(current_user_id, target_user_id, db)
    return ApiResponse(
        success=True,
        message="Đã bỏ chặn người dùng thành công"
    )

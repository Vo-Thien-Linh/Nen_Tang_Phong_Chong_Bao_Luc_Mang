import re
from typing import Optional, List
from pydantic import BaseModel, field_validator, model_validator

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    hometown: Optional[str] = None
    education: Optional[str] = None
    high_school: Optional[str] = None
    relationship_status: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            name = v.strip()
            if not name:
                raise ValueError("Tên hiển thị không được để trống")
            if len(name) < 3 or len(name) > 30:
                raise ValueError("Tên hiển thị phải từ 3 - 30 kí tự")
            return name
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            phone = v.strip().replace(" ", "").replace(".", "")
            pattern = r"^(0|\+84)(3|5|7|8|9)[0-9]{8}$"
            if not re.match(pattern, phone):
                raise ValueError("Số điện thoại không đúng định dạng hợp lệ (10 chữ số)")
            return phone
        return v


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str

    @field_validator("old_password")
    @classmethod
    def validate_old_password(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Vui lòng nhập mật khẩu hiện tại")
        return v

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if not v:
            raise ValueError("Vui lòng nhập mật khẩu mới")
        if len(v) < 8:
            raise ValueError("Mật khẩu mới bắt buộc 8 kí tự đổ lên có kí tự hoa, thường và số")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Mật khẩu mới bắt buộc có kí tự hoa")
        if not re.search(r"[a-z]", v):
            raise ValueError("Mật khẩu mới bắt buộc có kí tự thường")
        if not re.search(r"\d", v):
            raise ValueError("Mật khẩu mới bắt buộc có kí tự số")
        return v

    @model_validator(mode="after")
    def validate_match_and_difference(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Mật khẩu xác nhận không khớp")
        if self.old_password == self.new_password:
            raise ValueError("Mật khẩu mới không được trùng với mật khẩu hiện tại")
        return self


class SafetySettingsRequest(BaseModel):
    ai_shield_enabled: Optional[bool] = None
    ai_sensitivity: Optional[str] = None  # 'high', 'standard', 'low'
    auto_hide_toxic_comments: Optional[bool] = None
    filter_keywords: Optional[str] = None
    block_strangers_messages: Optional[bool] = None
    take_a_break_mode: Optional[bool] = None

    @field_validator("ai_sensitivity")
    @classmethod
    def validate_sensitivity(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ["high", "standard", "low"]:
            raise ValueError("Độ nhạy AI phải là 'high', 'standard' hoặc 'low'")
        return v


class PrivacySettingsRequest(BaseModel):
    post_default_privacy: Optional[str] = None  # 'public', 'friends', 'private'
    who_can_send_friend_requests: Optional[str] = None  # 'everyone', 'friends_of_friends'
    who_can_message: Optional[str] = None  # 'everyone', 'friends'
    show_email: Optional[bool] = None
    show_phone: Optional[bool] = None


class NotificationSettingsRequest(BaseModel):
    notify_likes: Optional[bool] = None
    notify_comments: Optional[bool] = None
    notify_friend_requests: Optional[bool] = None
    notify_ai_warnings: Optional[bool] = None
    sound_enabled: Optional[bool] = None


class AppearanceSettingsRequest(BaseModel):
    theme: Optional[str] = None  # 'light', 'dark', 'system'
    language: Optional[str] = None  # 'vi', 'en'


class BlockedUserItem(BaseModel):
    id: str
    name: str
    username: str
    avatar: str
    blocked_at: Optional[str] = None


class UserSettingsResponse(BaseModel):
    user_id: str
    # Profile
    full_name: str
    username: str
    email: str
    phone: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    hometown: Optional[str] = None
    education: Optional[str] = None
    high_school: Optional[str] = None
    relationship_status: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    is_verified: bool = False
    role: str = "USER"

    # AI & Cyberbullying Safety
    ai_shield_enabled: bool = True
    ai_sensitivity: str = "high"
    auto_hide_toxic_comments: bool = True
    filter_keywords: str = ""
    block_strangers_messages: bool = False
    take_a_break_mode: bool = False

    # Privacy
    post_default_privacy: str = "public"
    who_can_send_friend_requests: str = "everyone"
    who_can_message: str = "everyone"
    show_email: bool = False
    show_phone: bool = False

    # Notification
    notify_likes: bool = True
    notify_comments: bool = True
    notify_friend_requests: bool = True
    notify_ai_warnings: bool = True
    sound_enabled: bool = True

    # Security
    two_factor_enabled: bool = False

    # Appearance
    theme: str = "light"
    language: str = "vi"

    # Blocked count
    blocked_count: int = 0

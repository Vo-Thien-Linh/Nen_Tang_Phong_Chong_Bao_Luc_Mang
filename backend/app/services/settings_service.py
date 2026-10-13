from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from fastapi import HTTPException, status

from ..models.user import User
from ..models.friendship import Friendship
from ..models.user_settings import UserSettings
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
from ..utils.security import hash_password, verify_password

class SettingsService:

    @staticmethod
    def get_or_create_settings(user_id: str, db: Session) -> UserSettings:
        settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        if not settings:
            settings = UserSettings(user_id=user_id)
            db.add(settings)
            db.commit()
            db.refresh(settings)
        return settings

    @classmethod
    def get_full_settings(cls, user_id: str, db: Session) -> UserSettingsResponse:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tài khoản người dùng"
            )

        settings = cls.get_or_create_settings(user_id, db)

        # Đếm số người dùng bị chặn
        blocked_count = db.query(Friendship).filter(
            and_(
                Friendship.requester_id == user_id,
                Friendship.status == "blocked"
            )
        ).count()

        return UserSettingsResponse(
            user_id=user.id,
            full_name=user.full_name,
            username=user.username,
            email=user.email,
            phone=user.phone,
            bio=user.bio,
            location=user.location,
            hometown=user.hometown,
            education=user.education,
            high_school=user.high_school,
            relationship_status=user.relationship_status,
            avatar_url=user.avatar_url,
            cover_url=user.cover_url,
            is_verified=user.is_verified or False,
            role=user.role or "USER",

            ai_shield_enabled=settings.ai_shield_enabled,
            ai_sensitivity=settings.ai_sensitivity,
            auto_hide_toxic_comments=settings.auto_hide_toxic_comments,
            filter_keywords=settings.filter_keywords or "",
            block_strangers_messages=settings.block_strangers_messages,
            take_a_break_mode=settings.take_a_break_mode,

            post_default_privacy=settings.post_default_privacy,
            who_can_send_friend_requests=settings.who_can_send_friend_requests,
            who_can_message=settings.who_can_message,
            show_email=settings.show_email,
            show_phone=settings.show_phone,

            notify_likes=settings.notify_likes,
            notify_comments=settings.notify_comments,
            notify_friend_requests=settings.notify_friend_requests,
            notify_ai_warnings=settings.notify_ai_warnings,
            sound_enabled=settings.sound_enabled,

            two_factor_enabled=settings.two_factor_enabled,
            theme=settings.theme,
            language=settings.language,
            blocked_count=blocked_count
        )

    @staticmethod
    def update_profile(user_id: str, req: UpdateProfileRequest, db: Session) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tài khoản người dùng"
            )

        # Kiểm tra trùng số điện thoại nếu thay đổi
        if req.phone and req.phone != user.phone:
            existing_phone = db.query(User).filter(
                and_(User.phone == req.phone, User.id != user_id)
            ).first()
            if existing_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Số điện thoại đã được sử dụng bởi tài khoản khác"
                )
            user.phone = req.phone

        # Cập nhật các trường thông tin
        if req.full_name is not None:
            user.full_name = req.full_name
        if req.bio is not None:
            user.bio = req.bio
        if req.location is not None:
            user.location = req.location
        if req.hometown is not None:
            user.hometown = req.hometown
        if req.education is not None:
            user.education = req.education
        if req.high_school is not None:
            user.high_school = req.high_school
        if req.relationship_status is not None:
            user.relationship_status = req.relationship_status
        if req.avatar_url is not None:
            user.avatar_url = req.avatar_url
        if req.cover_url is not None:
            user.cover_url = req.cover_url

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def change_password(user_id: str, req: ChangePasswordRequest, db: Session) -> bool:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tài khoản người dùng"
            )

        # Kiểm tra mật khẩu cũ
        if not verify_password(req.old_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu hiện tại không chính xác"
            )

        # Cập nhật mật khẩu mới đã băm
        user.password_hash = hash_password(req.new_password)
        db.commit()
        return True

    @classmethod
    def update_safety(cls, user_id: str, req: SafetySettingsRequest, db: Session) -> UserSettings:
        settings = cls.get_or_create_settings(user_id, db)

        if req.ai_shield_enabled is not None:
            settings.ai_shield_enabled = req.ai_shield_enabled
        if req.ai_sensitivity is not None:
            settings.ai_sensitivity = req.ai_sensitivity
        if req.auto_hide_toxic_comments is not None:
            settings.auto_hide_toxic_comments = req.auto_hide_toxic_comments
        if req.filter_keywords is not None:
            settings.filter_keywords = req.filter_keywords
        if req.block_strangers_messages is not None:
            settings.block_strangers_messages = req.block_strangers_messages
        if req.take_a_break_mode is not None:
            settings.take_a_break_mode = req.take_a_break_mode

        db.commit()
        db.refresh(settings)
        return settings

    @classmethod
    def update_privacy(cls, user_id: str, req: PrivacySettingsRequest, db: Session) -> UserSettings:
        settings = cls.get_or_create_settings(user_id, db)

        if req.post_default_privacy is not None:
            settings.post_default_privacy = req.post_default_privacy
        if req.who_can_send_friend_requests is not None:
            settings.who_can_send_friend_requests = req.who_can_send_friend_requests
        if req.who_can_message is not None:
            settings.who_can_message = req.who_can_message
        if req.show_email is not None:
            settings.show_email = req.show_email
        if req.show_phone is not None:
            settings.show_phone = req.show_phone

        db.commit()
        db.refresh(settings)
        return settings

    @classmethod
    def update_notifications(cls, user_id: str, req: NotificationSettingsRequest, db: Session) -> UserSettings:
        settings = cls.get_or_create_settings(user_id, db)

        if req.notify_likes is not None:
            settings.notify_likes = req.notify_likes
        if req.notify_comments is not None:
            settings.notify_comments = req.notify_comments
        if req.notify_friend_requests is not None:
            settings.notify_friend_requests = req.notify_friend_requests
        if req.notify_ai_warnings is not None:
            settings.notify_ai_warnings = req.notify_ai_warnings
        if req.sound_enabled is not None:
            settings.sound_enabled = req.sound_enabled

        db.commit()
        db.refresh(settings)
        return settings

    @classmethod
    def update_appearance(cls, user_id: str, req: AppearanceSettingsRequest, db: Session) -> UserSettings:
        settings = cls.get_or_create_settings(user_id, db)

        if req.theme is not None:
            settings.theme = req.theme
        if req.language is not None:
            settings.language = req.language

        db.commit()
        db.refresh(settings)
        return settings

    @classmethod
    def toggle_2fa(cls, user_id: str, db: Session) -> bool:
        settings = cls.get_or_create_settings(user_id, db)
        settings.two_factor_enabled = not settings.two_factor_enabled
        db.commit()
        db.refresh(settings)
        return settings.two_factor_enabled

    @staticmethod
    def get_blocked_users(user_id: str, db: Session) -> List[BlockedUserItem]:
        friendships = db.query(Friendship).filter(
            and_(
                Friendship.requester_id == user_id,
                Friendship.status == "blocked"
            )
        ).all()

        blocked_items = []
        for f in friendships:
            blocked_user = db.query(User).filter(User.id == f.addressee_id).first()
            if blocked_user:
                blocked_items.append(
                    BlockedUserItem(
                        id=blocked_user.id,
                        name=blocked_user.full_name,
                        username=blocked_user.username,
                        avatar=blocked_user.avatar_url or "",
                        blocked_at=f.created_at.strftime("%d/%m/%Y") if f.created_at else "Gần đây"
                    )
                )
        return blocked_items

    @staticmethod
    def block_user(user_id: str, target_id: str, db: Session) -> bool:
        if user_id == target_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể chặn chính mình"
            )

        target = db.query(User).filter(User.id == target_id).first()
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người dùng cần chặn"
            )

        # Xóa hoặc cập nhật mọi mối quan hệ bạn bè cũ giữa 2 người
        existing = db.query(Friendship).filter(
            or_(
                and_(Friendship.requester_id == user_id, Friendship.addressee_id == target_id),
                and_(Friendship.requester_id == target_id, Friendship.addressee_id == user_id)
            )
        ).first()

        if existing:
            existing.requester_id = user_id
            existing.addressee_id = target_id
            existing.status = "blocked"
        else:
            new_block = Friendship(
                requester_id=user_id,
                addressee_id=target_id,
                status="blocked"
            )
            db.add(new_block)

        db.commit()
        return True

    @staticmethod
    def unblock_user(user_id: str, target_id: str, db: Session) -> bool:
        block_entry = db.query(Friendship).filter(
            and_(
                Friendship.requester_id == user_id,
                Friendship.addressee_id == target_id,
                Friendship.status == "blocked"
            )
        ).first()

        if not block_entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Người dùng này không nằm trong danh sách chặn"
            )

        db.delete(block_entry)
        db.commit()
        return True

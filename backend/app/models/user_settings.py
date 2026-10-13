import uuid
from datetime import datetime
from sqlalchemy import Column, BigInteger, String, Boolean, DateTime, Text, ForeignKey, func, Uuid
from ..database import Base

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    user_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # 1. Phòng chống bạo lực mạng & An toàn AI
    ai_shield_enabled = Column(Boolean, default=True, nullable=False)
    ai_sensitivity = Column(String(20), default="high", nullable=False)  # 'high', 'standard', 'low'
    auto_hide_toxic_comments = Column(Boolean, default=True, nullable=False)
    filter_keywords = Column(Text, default="chó, ngu, rác rưởi, đồ khốn, mất dạy, óc chó, cút, giết, chém, đập", nullable=False)
    block_strangers_messages = Column(Boolean, default=False, nullable=False)
    take_a_break_mode = Column(Boolean, default=False, nullable=False)  # Chế độ tạm ngưng tương tác bảo vệ tâm lý

    # 2. Quyền riêng tư
    post_default_privacy = Column(String(20), default="public", nullable=False)  # 'public', 'friends', 'private'
    who_can_send_friend_requests = Column(String(20), default="everyone", nullable=False)  # 'everyone', 'friends_of_friends'
    who_can_message = Column(String(20), default="everyone", nullable=False)  # 'everyone', 'friends'
    show_email = Column(Boolean, default=False, nullable=False)
    show_phone = Column(Boolean, default=False, nullable=False)

    # 3. Thông báo
    notify_likes = Column(Boolean, default=True, nullable=False)
    notify_comments = Column(Boolean, default=True, nullable=False)
    notify_friend_requests = Column(Boolean, default=True, nullable=False)
    notify_ai_warnings = Column(Boolean, default=True, nullable=False)
    sound_enabled = Column(Boolean, default=True, nullable=False)

    # 4. Bảo mật nâng cao
    two_factor_enabled = Column(Boolean, default=False, nullable=False)

    # 5. Giao diện & Hiển thị
    theme = Column(String(20), default="light", nullable=False)  # 'light', 'dark', 'system'
    language = Column(String(10), default="vi", nullable=False)  # 'vi', 'en'

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

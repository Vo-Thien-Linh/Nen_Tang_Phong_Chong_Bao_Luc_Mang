from sqlalchemy import Column, Integer, BigInteger, String, Boolean, Text, DateTime, ForeignKey, func, Uuid
from ..database import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True, index=True)
    user1_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    user2_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    status = Column(String(20), default="accepted", nullable=False, index=True)  # 'accepted', 'pending', 'blocked'
    type = Column(String(20), default="direct", nullable=False, index=True)  # 'direct', 'group'
    name = Column(String(100), nullable=True)  # Tên nhóm đối với group chat
    avatar_url = Column(Text, nullable=True)  # Ảnh đại diện nhóm
    initiated_by = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_by = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    last_message_at = Column(DateTime(timezone=True), default=func.now())
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())


class ConversationMember(Base):
    __tablename__ = "conversation_members"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True, index=True)
    conversation_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), default="member", nullable=False)  # 'admin', 'member'
    joined_at = Column(DateTime(timezone=True), default=func.now())


class Message(Base):
    __tablename__ = "messages"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True, index=True)
    conversation_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    receiver_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    media_url = Column(Text, nullable=True)
    media_type = Column(String(20), default="text", nullable=True)  # 'text', 'image', 'file'
    status = Column(String(20), default="sent", nullable=False)  # 'sent', 'delivered', 'read', 'recalled'
    is_read = Column(Boolean, default=False, nullable=False)
    is_recalled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())

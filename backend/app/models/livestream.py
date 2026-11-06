from sqlalchemy import Column, Integer, BigInteger, String, Text, Boolean, Float, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base

class LiveSession(Base):
    __tablename__ = "live_sessions"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True, autoincrement=True)
    streamer_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    category = Column(String(50), default="Giao lưu")
    status = Column(String(30), default="LIVE", index=True) # LIVE, ENDED, TERMINATED_FOR_VIOLATION
    viewer_count = Column(Integer, default=0)
    violation_count = Column(Integer, default=0)
    termination_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    # Relationships
    streamer = relationship("User", foreign_keys=[streamer_id])
    comments = relationship("LiveComment", back_populates="session", cascade="all, delete-orphan")
    sanctions = relationship("LiveSanction", back_populates="session", cascade="all, delete-orphan")


class LiveComment(Base):
    __tablename__ = "live_comments"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True, autoincrement=True)
    session_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("live_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    is_blocked = Column(Boolean, default=False)
    toxic_score = Column(Float, default=0.0)
    violation_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("LiveSession", back_populates="comments")
    user = relationship("User", foreign_keys=[user_id])


class LiveSanction(Base):
    __tablename__ = "live_sanctions"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True, autoincrement=True)
    session_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("live_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(50), nullable=False) # WARNING, MUTED_5M, KICKED, BANNED
    reason = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("LiveSession", back_populates="sanctions")
    user = relationship("User", foreign_keys=[user_id])

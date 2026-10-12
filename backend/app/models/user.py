import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, Uuid
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="USER", nullable=False) # 'USER', 'ADMIN', 'MODERATOR'
    status = Column(String(20), default="active", nullable=False) # 'active', 'cooldown', 'banned'

    avatar_url = Column(Text, nullable=True, default=None)
    cover_url = Column(Text, nullable=True, default=None)
    bio = Column(Text, nullable=True)
    location = Column(String(100), nullable=True)
    hometown = Column(String(100), nullable=True)
    education = Column(String(150), nullable=True)
    high_school = Column(String(150), nullable=True)
    relationship_status = Column(String(50), nullable=True)

    is_verified = Column(Boolean, default=False)
    cooldown_until = Column(DateTime, nullable=True)
    cooldown_reason = Column(Text, nullable=True)
    cooldown_violation_text = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Uuid
from ..database import Base

class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True)
    email = Column(String(255), nullable=False, index=True)
    code = Column(String(10), nullable=False)
    type = Column(String(30), nullable=False) # 'email_verification', 'password_reset'
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

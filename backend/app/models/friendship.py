from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, func, Uuid
from ..database import Base

class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    requester_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    addressee_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), default="pending", nullable=False, index=True)  # 'pending', 'accepted', 'declined', 'blocked'
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

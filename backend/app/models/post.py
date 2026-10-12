from datetime import datetime
from sqlalchemy import Column, BigInteger, String, Text, Numeric, Integer, DateTime, Uuid, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class Post(Base):
    __tablename__ = "posts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    author_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    image_url = Column(Text, nullable=True)
    privacy = Column(String(20), default="public")
    ai_label = Column(String(50), default="Normal")
    ai_confidence = Column(Numeric(5, 4), default=0.9900)
    ai_status = Column(String(20), default="approved")
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    author = relationship("User", foreign_keys=[author_id], lazy="joined")

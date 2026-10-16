from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class MessageSendRequest(BaseModel):
    receiver_id: str
    content: str

class MessageItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: str
    receiver_id: str
    content: str
    status: str = "sent"  # 'sent', 'delivered', 'read'
    is_read: bool = False
    created_at: datetime

class ConversationPartner(BaseModel):
    id: str
    name: str
    username: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    is_online: bool = False
    is_friend: bool = False

class ConversationItem(BaseModel):
    id: int
    user: ConversationPartner
    status: str = "accepted"  # 'accepted', 'pending'
    initiated_by: Optional[str] = None
    is_requester: bool = False
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    last_message_status: Optional[str] = None
    last_message_sender_id: Optional[str] = None

class UpdateMessageStatusRequest(BaseModel):
    status: str  # 'delivered', 'read'

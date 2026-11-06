from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class MessageSendRequest(BaseModel):
    receiver_id: Optional[str] = None
    conversation_id: Optional[int] = None
    content: Optional[str] = ""
    media_url: Optional[str] = None
    media_type: Optional[str] = "text"

class CreateGroupRequest(BaseModel):
    name: str
    member_ids: List[str]
    avatar_url: Optional[str] = None

class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None

class MessageItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: str
    receiver_id: Optional[str] = None
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = "text"
    status: str = "sent"  # 'sent', 'delivered', 'read', 'recalled'
    is_read: bool = False
    is_recalled: bool = False
    created_at: datetime
    sender_name: Optional[str] = None
    sender_avatar: Optional[str] = None

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
    user: Optional[ConversationPartner] = None
    status: str = "accepted"  # 'accepted', 'pending', 'blocked'
    type: str = "direct"  # 'direct', 'group'
    name: Optional[str] = None
    avatar: Optional[str] = None
    member_count: int = 2
    members: Optional[List[ConversationPartner]] = None
    initiated_by: Optional[str] = None
    blocked_by: Optional[str] = None
    is_requester: bool = False
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    last_message_status: Optional[str] = None
    last_message_sender_id: Optional[str] = None

class UpdateMessageStatusRequest(BaseModel):
    status: str  # 'delivered', 'read'

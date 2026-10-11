from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class UserFriendSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    full_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None

class MutualFriendSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    avatar: Optional[str] = None

class FriendRequestItem(BaseModel):
    id: int
    user: UserFriendSummary
    mutual_friends: List[MutualFriendSummary] = []
    mutual_friends_count: int = 0
    created_at: Optional[datetime] = None

class FriendItem(BaseModel):
    id: str
    username: str
    name: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    mutual_friends_count: int = 0

class FriendSuggestionItem(BaseModel):
    id: str
    username: str
    name: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    mutual_friends: List[MutualFriendSummary] = []
    mutual_count: int = 0
    request_sent: bool = False

class FriendshipStatusResponse(BaseModel):
    target_user_id: str
    status: str  # 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'blocked'
    friendship_id: Optional[int] = None

class FriendshipActionResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

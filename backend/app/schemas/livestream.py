from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class LiveSessionCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255, description="Tiêu đề phiên livestream")
    description: Optional[str] = Field(None, max_length=500, description="Mô tả nội dung phiên live")
    category: Optional[str] = Field("Giao lưu", description="Chủ đề phát sóng")

class LiveSessionResponse(BaseModel):
    id: int
    streamer_id: str
    streamer_name: str
    streamer_avatar: Optional[str] = None
    title: str
    description: Optional[str] = None
    category: str
    status: str
    viewer_count: int
    violation_count: int
    created_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class LiveCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500, description="Nội dung bình luận trong phòng live")

class LiveCommentResponse(BaseModel):
    id: int
    session_id: int
    user_id: str
    user_name: str
    user_avatar: Optional[str] = None
    content: str
    is_blocked: bool
    toxic_score: float
    violation_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LiveFrameCheckRequest(BaseModel):
    frame_base64: Optional[str] = Field(None, description="Ảnh snapshot từ video stream định dạng base64")
    sample_tag: Optional[str] = "video_frame"

class LiveFrameCheckResponse(BaseModel):
    is_safe: bool
    violation_type: Optional[str] = None
    confidence: float = 0.0
    action_taken: str = "NONE" # NONE, WARNED, EMERGENCY_TERMINATED
    message: str

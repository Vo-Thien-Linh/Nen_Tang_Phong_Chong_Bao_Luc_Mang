from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from ..database import get_db
from ..utils.security import decode_access_token
from ..services.message_service import MessageService
from ..schemas.message import (
    MessageItem,
    MessageSendRequest,
    ConversationItem,
)

router = APIRouter(prefix="/messages", tags=["Chức năng Nhắn tin (Messaging)"])

def get_current_user_id(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> str:
    """Dependency lấy user_id từ JWT Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu đăng nhập để thực hiện thao tác này"
        )
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên làm việc đã hết hạn hoặc token không hợp lệ"
        )
    return payload["sub"]

@router.get(
    "/conversations",
    response_model=List[ConversationItem],
    summary="Lấy danh sách các cuộc trò chuyện",
    description="Lấy danh sách cuộc trò chuyện theo tab: 'accepted' (hộp thư chính) hoặc 'pending' (tin nhắn chờ)"
)
def get_conversations(
    tab: Optional[str] = Query(None, description="'accepted' hoặc 'pending'"),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return MessageService.get_conversations(current_user_id, tab, db)

@router.get(
    "/conversations/{conversation_id}",
    response_model=List[MessageItem],
    summary="Lấy danh sách tin nhắn trong cuộc trò chuyện",
    description="Lấy tin nhắn và tự động đánh dấu đã xem (read) các tin nhắn chưa xem của đối phương"
)
def get_messages(
    conversation_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return MessageService.get_messages(conversation_id, current_user_id, db)

@router.post(
    "/conversations/with/{user_id}",
    summary="Khởi tạo hoặc lấy cuộc trò chuyện với một người dùng",
    description="Dùng khi người dùng bấm 'Nhắn tin' từ trang cá nhân hoặc danh sách bạn bè"
)
def get_or_create_conversation(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    conv = MessageService.get_or_create_conversation(current_user_id, user_id, db)
    return {"conversation_id": conv.id, "status": conv.status}

@router.post(
    "/send",
    response_model=MessageItem,
    summary="Gửi tin nhắn mới",
    description="Gửi tin nhắn cho người dùng khác, tự động tạo cuộc trò chuyện nếu chưa có"
)
def send_message(
    payload: MessageSendRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return MessageService.send_message(current_user_id, payload.receiver_id, payload.content, db)

@router.put(
    "/conversations/{conversation_id}/read",
    summary="Đánh dấu đã xem toàn bộ tin nhắn trong cuộc trò chuyện",
    description="Cập nhật trạng thái thành 'read' (đã xem)"
)
def mark_read(
    conversation_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    MessageService.mark_read(conversation_id, current_user_id, db)
    return {"success": True, "message": "Đã đánh dấu xem tin nhắn"}

@router.put(
    "/conversations/{conversation_id}/accept",
    summary="Chấp nhận tin nhắn chờ từ người lạ",
    description="Chuyển cuộc trò chuyện từ trạng thái 'pending' sang 'accepted'"
)
def accept_conversation(
    conversation_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    MessageService.accept_conversation(conversation_id, current_user_id, db)
    return {"success": True, "message": "Đã chấp nhận cuộc trò chuyện vào hộp thư chính"}

@router.delete(
    "/conversations/{conversation_id}",
    summary="Từ chối hoặc xóa cuộc trò chuyện chờ",
    description="Xóa cuộc trò chuyện khỏi danh sách chờ"
)
def decline_conversation(
    conversation_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    MessageService.decline_conversation(conversation_id, current_user_id, db)
    return {"success": True, "message": "Đã xóa cuộc trò chuyện"}

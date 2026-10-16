from fastapi import APIRouter, Depends, HTTPException, status, Header, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Optional, List

from ..database import get_db
from ..models.user import User
from ..models.friendship import Friendship
from sqlalchemy import or_, and_
from ..utils.security import decode_access_token
from ..services.message_service import MessageService
from ..schemas.message import (
    MessageItem,
    MessageSendRequest,
    ConversationItem,
)

router = APIRouter(prefix="/messages", tags=["Chức năng Nhắn tin (Messaging)"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            dead = set()
            for ws in list(self.active_connections[user_id]):
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.active_connections[user_id].discard(ws)

manager = ConnectionManager()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        manager.disconnect(user_id, websocket)

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
    if user_id == current_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tạo cuộc trò chuyện với chính mình"
        )

    partner = db.query(User).filter(User.id == user_id).first()
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng này"
        )

    is_friend = db.query(Friendship).filter(
        or_(
            and_(Friendship.requester_id == current_user_id, Friendship.addressee_id == user_id),
            and_(Friendship.requester_id == user_id, Friendship.addressee_id == current_user_id)
        ),
        Friendship.status == "accepted"
    ).first() is not None

    conv = db.query(Conversation).filter(
        or_(
            and_(Conversation.user1_id == current_user_id, Conversation.user2_id == user_id),
            and_(Conversation.user1_id == user_id, Conversation.user2_id == current_user_id)
        )
    ).first()

    has_msg = False
    if conv:
        has_msg = db.query(Message).filter(Message.conversation_id == conv.id).first() is not None
        if is_friend and conv.status != "accepted":
            conv.status = "accepted"
            db.commit()

    return {
        "conversation_id": conv.id if (conv and (has_msg or is_friend)) else None,
        "status": conv.status if conv else ("accepted" if is_friend else "pending"),
        "initiated_by": str(conv.initiated_by) if conv else str(current_user_id),
        "is_requester": (str(conv.initiated_by) == str(current_user_id)) if conv else True,
        "is_draft": not (has_msg or is_friend),
        "user": {
            "id": str(partner.id),
            "name": partner.full_name,
            "username": partner.username,
            "avatar": partner.avatar_url,
            "bio": partner.bio,
            "is_online": True,
            "is_friend": is_friend
        }
    }

@router.post(
    "/send",
    response_model=MessageItem,
    summary="Gửi tin nhắn mới",
    description="Gửi tin nhắn cho người dùng khác, tự động tạo cuộc trò chuyện nếu chưa có"
)
async def send_message(
    payload: MessageSendRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    msg = MessageService.send_message(current_user_id, payload.receiver_id, payload.content, db)
    msg_dict = {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": str(msg.sender_id),
        "receiver_id": str(msg.receiver_id),
        "content": msg.content,
        "status": msg.status,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None
    }
    await manager.send_to_user(str(payload.receiver_id), {
        "type": "NEW_MESSAGE",
        "conversation_id": msg.conversation_id,
        "message": msg_dict
    })
    await manager.send_to_user(str(current_user_id), {
        "type": "MESSAGE_SENT",
        "conversation_id": msg.conversation_id,
        "message": msg_dict
    })
    return msg

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
async def accept_conversation(
    conversation_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    from ..models.message import Conversation
    MessageService.accept_conversation(conversation_id, current_user_id, db)
    db_conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if db_conv:
        partner_id = str(db_conv.user2_id) if str(db_conv.user1_id) == str(current_user_id) else str(db_conv.user1_id)
        await manager.send_to_user(partner_id, {
            "type": "CONVERSATION_ACCEPTED",
            "conversation_id": conversation_id
        })
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

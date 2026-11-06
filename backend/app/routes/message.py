from fastapi import APIRouter, Depends, HTTPException, status, Header, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Optional, List
import json

from ..database import get_db
from ..models.user import User
from ..models.friendship import Friendship
from ..models.message import Conversation, Message
from sqlalchemy import or_, and_
from ..utils.security import decode_access_token
from ..services.message_service import MessageService
from ..schemas.message import (
    MessageItem,
    MessageSendRequest,
    ConversationItem,
    CreateGroupRequest,
    UpdateGroupRequest,
)

router = APIRouter(prefix="/messages", tags=["Chức năng Nhắn tin (Messaging)"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket, subprotocol: Optional[str] = None):
        await websocket.accept(subprotocol=subprotocol)
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    def is_user_online(self, user_id: str) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    async def send_to_user(self, user_id: str, message: dict) -> bool:
        if user_id in self.active_connections:
            dead = set()
            delivered = False
            for ws in list(self.active_connections[user_id]):
                try:
                    await ws.send_json(message)
                    delivered = True
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.active_connections[user_id].discard(ws)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
            return delivered
        return False

manager = ConnectionManager()

def get_websocket_bearer_token(websocket: WebSocket) -> Optional[str]:
    """Read the bearer token from the browser WebSocket subprotocol handshake."""
    offered_protocols = websocket.headers.get("sec-websocket-protocol", "").split(",")
    for protocol in offered_protocols:
        protocol = protocol.strip()
        if protocol.startswith("bearer."):
            token = protocol[len("bearer."):].strip()
            return token or None
    return None

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    token = get_websocket_bearer_token(websocket)
    payload = decode_access_token(token) if token else None
    token_user_id = str(payload.get("sub", "")) if payload else ""
    if not token_user_id or token_user_id != str(user_id):
        await websocket.close(code=4401, reason="Unauthorized")
        return

    await manager.connect(user_id, websocket, subprotocol="nexussocial")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
                continue

            try:
                msg_payload = json.loads(data)
            except Exception:
                continue

            event_type = msg_payload.get("type")
            target_user_id = msg_payload.get("receiver_id") or msg_payload.get("target_id")

            # Xử lý các sự kiện Báo hiệu Cuộc gọi WebRTC (Call Signaling)
            if event_type in [
                "CALL_REQUEST",
                "CALL_RESPONSE",
                "WEBRTC_SIGNAL",
                "CALL_ENDED",
                "CALL_CANDIDATE",
            ]:
                if target_user_id:
                    is_online = manager.is_user_online(str(target_user_id))
                    if not is_online and event_type == "CALL_REQUEST":
                        await websocket.send_json({
                            "type": "CALL_RESPONSE",
                            "caller_id": user_id,
                            "receiver_id": target_user_id,
                            "accepted": False,
                            "reason": "offline"
                        })
                    else:
                        msg_payload["from_user_id"] = user_id
                        if event_type == "CALL_REQUEST":
                            msg_payload["caller_id"] = user_id
                        await manager.send_to_user(str(target_user_id), msg_payload)
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
        if is_friend and conv.status != "accepted" and conv.status != "blocked":
            conv.status = "accepted"
            db.commit()

    return {
        "conversation_id": conv.id if (conv and (has_msg or is_friend or conv.status == "blocked")) else None,
        "status": conv.status if conv else ("accepted" if is_friend else "pending"),
        "initiated_by": str(conv.initiated_by) if conv else str(current_user_id),
        "blocked_by": str(conv.blocked_by) if (conv and getattr(conv, "blocked_by", None)) else None,
        "is_requester": (str(conv.initiated_by) == str(current_user_id)) if conv else True,
        "is_draft": not (has_msg or is_friend or (conv and conv.status == "blocked")),
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
    "/groups",
    response_model=ConversationItem,
    summary="Tạo nhóm trò chuyện mới",
    description="Tạo cuộc trò chuyện nhóm với tối thiểu 3 thành viên"
)
async def create_group(
    payload: CreateGroupRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    group = MessageService.create_group(current_user_id, payload, db)
    recipients = MessageService.get_conversation_recipient_ids(group.id, current_user_id, db)
    group_data = group.model_dump() if hasattr(group, "model_dump") else group.dict()
    for r_id in recipients:
        await manager.send_to_user(str(r_id), {
            "type": "GROUP_CREATED",
            "conversation_id": group.id,
            "conversation": group_data
        })
    return group

@router.put(
    "/groups/{conversation_id}",
    response_model=ConversationItem,
    summary="Cập nhật thông tin nhóm trò chuyện (tên nhóm, ảnh đại diện)",
    description="Cho phép thành viên cập nhật tên nhóm hoặc ảnh đại diện của nhóm"
)
async def update_group(
    conversation_id: int,
    payload: UpdateGroupRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    result = MessageService.update_group(conversation_id, current_user_id, payload, db)
    updated_group = result["conversation"]
    system_messages = result["system_messages"]

    group_data = updated_group.model_dump() if hasattr(updated_group, "model_dump") else updated_group.dict()
    recipients = MessageService.get_conversation_recipient_ids(conversation_id, current_user_id, db)
    all_members = list(set(recipients + [str(current_user_id)]))

    for u_id in all_members:
        await manager.send_to_user(str(u_id), {
            "type": "GROUP_UPDATED",
            "conversation_id": conversation_id,
            "conversation": group_data
        })
        for sm in system_messages:
            sm_dict = sm.model_dump() if hasattr(sm, "model_dump") else sm.dict()
            if sm_dict.get("created_at") and hasattr(sm_dict["created_at"], "isoformat"):
                sm_dict["created_at"] = sm_dict["created_at"].isoformat()
            await manager.send_to_user(str(u_id), {
                "type": "NEW_MESSAGE",
                "conversation_id": conversation_id,
                "message": sm_dict
            })

    return updated_group

@router.post(
    "/send",
    response_model=MessageItem,
    summary="Gửi tin nhắn mới",
    description="Gửi tin nhắn cho người dùng khác hoặc gửi vào nhóm trò chuyện"
)
async def send_message(
    payload: MessageSendRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    msg = MessageService.send_message(
        sender_id=current_user_id,
        receiver_id=payload.receiver_id,
        content=payload.content,
        db=db,
        media_url=payload.media_url,
        media_type=payload.media_type,
        conversation_id=payload.conversation_id
    )
    msg_dict = {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": str(msg.sender_id),
        "receiver_id": str(msg.receiver_id) if msg.receiver_id else None,
        "content": msg.content,
        "media_url": msg.media_url,
        "media_type": msg.media_type,
        "status": msg.status,
        "is_read": msg.is_read,
        "is_recalled": msg.is_recalled,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "sender_name": getattr(msg, "sender_name", None),
        "sender_avatar": getattr(msg, "sender_avatar", None),
    }

    recipients = MessageService.get_conversation_recipient_ids(msg.conversation_id, current_user_id, db)
    for r_id in recipients:
        await manager.send_to_user(str(r_id), {
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

@router.post(
    "/messages/{message_id}/recall",
    response_model=MessageItem,
    summary="Thu hồi tin nhắn đã gửi",
    description="Chỉ cho phép người gửi thu hồi tin nhắn của chính mình"
)
async def recall_message(
    message_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    msg = MessageService.recall_message(message_id, current_user_id, db)
    recall_payload = {
        "type": "MESSAGE_RECALLED",
        "conversation_id": msg.conversation_id,
        "message_id": msg.id,
        "content": msg.content,
        "status": msg.status,
        "is_recalled": True
    }
    recipients = MessageService.get_conversation_recipient_ids(msg.conversation_id, current_user_id, db)
    for r_id in recipients:
        await manager.send_to_user(str(r_id), recall_payload)
    await manager.send_to_user(str(current_user_id), recall_payload)
    return msg

@router.post(
    "/conversations/{conversation_id}/block",
    summary="Chặn người dùng trong cuộc trò chuyện",
    description="Chặn người dùng đối phương, ngăn chặn việc gửi tin nhắn tiếp theo"
)
async def block_conversation(
    conversation_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    MessageService.block_conversation(conversation_id, current_user_id, db)
    db_conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if db_conv:
        partner_id = str(db_conv.user2_id) if str(db_conv.user1_id) == str(current_user_id) else str(db_conv.user1_id)
        await manager.send_to_user(partner_id, {
            "type": "CONVERSATION_BLOCKED",
            "conversation_id": conversation_id,
            "blocked_by": str(current_user_id)
        })
        await manager.send_to_user(str(current_user_id), {
            "type": "CONVERSATION_BLOCKED",
            "conversation_id": conversation_id,
            "blocked_by": str(current_user_id)
        })
    return {"success": True, "message": "Đã chặn cuộc trò chuyện"}

@router.post(
    "/conversations/{conversation_id}/unblock",
    summary="Bỏ chặn cuộc trò chuyện",
    description="Gỡ chặn cuộc trò chuyện cho phép tiếp tục nhắn tin"
)
async def unblock_conversation(
    conversation_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    MessageService.unblock_conversation(conversation_id, current_user_id, db)
    db_conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if db_conv:
        partner_id = str(db_conv.user2_id) if str(db_conv.user1_id) == str(current_user_id) else str(db_conv.user1_id)
        await manager.send_to_user(partner_id, {
            "type": "CONVERSATION_UNBLOCKED",
            "conversation_id": conversation_id
        })
        await manager.send_to_user(str(current_user_id), {
            "type": "CONVERSATION_UNBLOCKED",
            "conversation_id": conversation_id
        })
    return {"success": True, "message": "Đã bỏ chặn cuộc trò chuyện"}

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

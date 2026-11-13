from fastapi import APIRouter, Depends, HTTPException, status, Header, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
import json

from ..database import get_db, SessionLocal
from ..models.user import User
from ..models.friendship import Friendship
from ..models.message import Conversation, Message, ConversationMember
from sqlalchemy import or_, and_
from ..utils.security import decode_access_token
from ..services.message_service import MessageService
from ..schemas.message import (
    MessageItem,
    MessageSendRequest,
    ConversationItem,
    CreateGroupRequest,
    UpdateGroupRequest,
    AddGroupMembersRequest,
)

router = APIRouter(prefix="/messages", tags=["Chức năng Nhắn tin (Messaging)"])

# Quản lý các phòng gọi video/thoại nhóm đang hoạt động: conversation_id -> dict
active_group_calls: dict[int, dict] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}
        self.last_seen_times: dict[str, str] = {}

    async def connect(self, user_id: str, websocket: WebSocket, subprotocol: Optional[str] = None):
        await websocket.accept(subprotocol=subprotocol)
        target_str = str(user_id).strip()
        if target_str not in self.active_connections:
            self.active_connections[target_str] = set()
        self.active_connections[target_str].add(websocket)
        self.last_seen_times.pop(target_str, None)

    def disconnect(self, user_id: str, websocket: WebSocket):
        target_str = str(user_id).strip()
        if target_str in self.active_connections:
            self.active_connections[target_str].discard(websocket)
            if not self.active_connections[target_str]:
                del self.active_connections[target_str]
                self.last_seen_times[target_str] = datetime.now(timezone.utc).isoformat()

    def is_user_online(self, user_id: str) -> bool:
        target_str = str(user_id).strip().lower()
        for uid, conns in self.active_connections.items():
            if str(uid).strip().lower() == target_str and len(conns) > 0:
                return True
        return False

    def get_last_seen(self, user_id: str) -> Optional[str]:
        target_str = str(user_id).strip()
        return self.last_seen_times.get(target_str)

    async def broadcast(self, message: dict, exclude_user_id: Optional[str] = None):
        exclude_str = str(exclude_user_id).strip().lower() if exclude_user_id else None
        for uid in list(self.active_connections.keys()):
            if exclude_str and str(uid).strip().lower() == exclude_str:
                continue
            await self.send_to_user(uid, message)

    async def send_to_user(self, user_id: str, message: dict) -> bool:
        target_str = str(user_id).strip().lower()
        delivered = False
        matching_keys = [k for k in list(self.active_connections.keys()) if str(k).strip().lower() == target_str]

        for k in matching_keys:
            dead = set()
            for ws in list(self.active_connections.get(k, [])):
                try:
                    await ws.send_json(message)
                    delivered = True
                except Exception:
                    dead.add(ws)
            for ws in dead:
                if k in self.active_connections:
                    self.active_connections[k].discard(ws)
            if k in self.active_connections and not self.active_connections[k]:
                del self.active_connections[k]
        return delivered

manager = ConnectionManager()

def format_call_duration_str(seconds: int) -> str:
    sec = max(0, int(seconds))
    hours = sec // 3600
    minutes = (sec % 3600) // 60
    rem = sec % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{rem:02d}"
    return f"{minutes:02d}:{rem:02d}"

async def handle_group_call_leave(conv_id: int, user_id: str):
    room = active_group_calls.get(int(conv_id))
    if not room or str(user_id) not in room["participants"]:
        return

    room["participants"].pop(str(user_id), None)
    remaining_count = len(room["participants"])

    if remaining_count > 0:
        # Báo cho các thành viên còn lại trong cuộc gọi
        for p in list(room["participants"].values()):
            await manager.send_to_user(str(p["user_id"]), {
                "type": "GROUP_CALL_USER_LEFT",
                "conversation_id": conv_id,
                "user_id": str(user_id)
            })

    # Cập nhật banner trạng thái cuộc gọi cho các thành viên nhóm
    is_active = remaining_count >= 1
    status_payload = {
        "type": "GROUP_CALL_STATUS",
        "conversation_id": conv_id,
        "is_active": is_active,
        "call_type": room["call_type"],
        "participants_count": remaining_count,
        "initiator_id": room["initiator_id"]
    }
    db = SessionLocal()
    try:
        recipients = MessageService.get_conversation_recipient_ids(conv_id, str(user_id), db)
        all_members = list(set(recipients + [str(user_id)]))
        for r_id in all_members:
            await manager.send_to_user(str(r_id), status_payload)

        # Khi tất cả thành viên đã rời cuộc gọi -> Cuộc gọi kết thúc, lưu lịch sử vào khung chat nhóm
        if remaining_count == 0:
            started_at = room.get("started_at")
            duration_sec = 0
            if started_at:
                now_utc = datetime.now(timezone.utc)
                duration_sec = max(0, int((now_utc - started_at).total_seconds()))

            dur_text = format_call_duration_str(duration_sec)
            call_type_text = "video nhóm" if room.get("call_type") == "video" else "thoại nhóm"
            max_p = room.get("max_participants", 1)

            if max_p > 1:
                log_content = f"Cuộc gọi {call_type_text} kết thúc • {dur_text}"
            else:
                log_content = f"Cuộc gọi {call_type_text} nhỡ • {dur_text}"

            log_msg = Message(
                conversation_id=conv_id,
                sender_id=room.get("initiator_id") or str(user_id),
                content=log_content,
                media_type="call_log",
                media_url=None,
                status="sent",
                created_at=datetime.now(timezone.utc)
            )
            db.add(log_msg)
            db.commit()
            db.refresh(log_msg)

            msg_dict = {
                "id": log_msg.id,
                "conversation_id": conv_id,
                "sender_id": str(log_msg.sender_id),
                "receiver_id": None,
                "content": log_msg.content,
                "media_url": None,
                "media_type": "call_log",
                "status": "sent",
                "is_read": False,
                "is_recalled": False,
                "created_at": log_msg.created_at.isoformat(),
                "sender_name": "Cuộc gọi nhóm",
                "sender_avatar": None
            }
            for r_id in all_members:
                await manager.send_to_user(str(r_id), {
                    "type": "NEW_MESSAGE",
                    "conversation_id": conv_id,
                    "message": msg_dict
                })
    except Exception as e:
        print("Lỗi lưu lịch sử cuộc gọi nhóm:", e)
    finally:
        db.close()

    if remaining_count == 0:
        active_group_calls.pop(int(conv_id), None)

def get_websocket_bearer_token(websocket: WebSocket) -> Optional[str]:
    """Read the bearer token from the browser WebSocket subprotocol handshake."""
    offered_protocols = websocket.headers.get("sec-websocket-protocol", "").split(",")
    for protocol in offered_protocols:
        protocol = protocol.strip()
        if protocol.startswith("bearer."):
            token = protocol[len("bearer."):].strip()
            return token or None
    return None

def update_user_db_last_seen(user_id: str, last_seen_dt: datetime):
    try:
        from ..database import SessionLocal
        from ..models.user import User
        with SessionLocal() as db_session:
            db_u = db_session.query(User).filter(User.id == str(user_id)).first()
            if db_u:
                db_u.last_seen = last_seen_dt
                db_session.commit()
    except Exception as e:
        logger.warning(f"Could not persist last_seen for {user_id}: {e}")

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    token = get_websocket_bearer_token(websocket)
    payload = decode_access_token(token) if token else None
    token_user_id = str(payload.get("sub", "")) if payload else ""
    if not token_user_id or token_user_id.strip().lower() != str(user_id).strip().lower():
        await websocket.close(code=4401, reason="Unauthorized")
        return

    await manager.connect(user_id, websocket, subprotocol="nexussocial")
    update_user_db_last_seen(str(user_id), datetime.now(timezone.utc))
    try:
        # Thông báo trạng thái Trực tuyến (Online) tới các người dùng khác
        await manager.broadcast({
            "type": "USER_STATUS",
            "user_id": str(user_id),
            "is_online": True
        }, exclude_user_id=str(user_id))

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

            # Xử lý các sự kiện Báo hiệu Cuộc gọi nhóm WebRTC (Group Call Signaling)
            elif event_type == "GROUP_CALL_START":
                conv_id = msg_payload.get("conversation_id")
                if conv_id:
                    conv_id = int(conv_id)
                    call_type = msg_payload.get("call_type", "video")
                    caller_name = msg_payload.get("caller_name", "Thành viên")
                    caller_avatar = msg_payload.get("caller_avatar")

                    # Kiểm tra xem cuộc gọi đã diễn ra trong nhóm hay chưa
                    existing_room = active_group_calls.get(conv_id)
                    if existing_room and len(existing_room.get("participants", {})) > 0:
                        # Cuộc gọi nhóm đã tồn tại! Tự động chuyển thành JOIN để không phá hủy phòng đang có
                        user_info = {
                            "user_id": str(user_id),
                            "name": caller_name,
                            "avatar": caller_avatar
                        }
                        existing_participants = [
                            p for uid, p in existing_room["participants"].items()
                            if str(uid) != str(user_id)
                        ]
                        existing_room["participants"][str(user_id)] = user_info
                        existing_room["max_participants"] = max(
                            existing_room.get("max_participants", 1),
                            len(existing_room["participants"])
                        )

                        # 1. Trả về trạng thái phòng cho người vừa vào
                        await websocket.send_json({
                            "type": "GROUP_CALL_ROOM_STATE",
                            "conversation_id": conv_id,
                            "initiator_id": existing_room["initiator_id"],
                            "call_type": existing_room["call_type"],
                            "participants": existing_participants
                        })

                        # 2. Báo cho tất cả thành viên đang có trong phòng biết người mới đã vào
                        for p in existing_participants:
                            await manager.send_to_user(str(p["user_id"]), {
                                "type": "GROUP_CALL_USER_JOINED",
                                "conversation_id": conv_id,
                                "user": user_info
                            })

                        # 3. Cập nhật GROUP_CALL_STATUS cho toàn bộ thành viên nhóm
                        status_payload = {
                            "type": "GROUP_CALL_STATUS",
                            "conversation_id": conv_id,
                            "is_active": True,
                            "call_type": existing_room["call_type"],
                            "participants_count": len(existing_room["participants"]),
                            "initiator_id": existing_room["initiator_id"]
                        }
                        db = SessionLocal()
                        try:
                            recipients = MessageService.get_conversation_recipient_ids(conv_id, str(user_id), db)
                            for r_id in set(recipients + [str(user_id)]):
                                await manager.send_to_user(str(r_id), status_payload)
                        finally:
                            db.close()
                    else:
                        active_group_calls[conv_id] = {
                            "conversation_id": conv_id,
                            "initiator_id": str(user_id),
                            "call_type": call_type,
                            "participants": {
                                str(user_id): {
                                    "user_id": str(user_id),
                                    "name": caller_name,
                                    "avatar": caller_avatar
                                }
                            },
                            "started_at": datetime.now(timezone.utc),
                            "max_participants": 1
                        }

                        await websocket.send_json({
                            "type": "GROUP_CALL_STARTED",
                            "conversation_id": conv_id,
                            "room": {
                                "conversation_id": conv_id,
                                "initiator_id": str(user_id),
                                "call_type": call_type,
                                "participants": list(active_group_calls[conv_id]["participants"].values())
                            }
                        })

                        db = SessionLocal()
                        try:
                            recipients = MessageService.get_conversation_recipient_ids(conv_id, str(user_id), db)
                            invite_payload = {
                                "type": "GROUP_CALL_INVITE",
                                "conversation_id": conv_id,
                                "initiator_id": str(user_id),
                                "caller_name": caller_name,
                                "caller_avatar": caller_avatar,
                                "call_type": call_type,
                                "participants_count": 1
                            }
                            status_payload = {
                                "type": "GROUP_CALL_STATUS",
                                "conversation_id": conv_id,
                                "is_active": True,
                                "call_type": call_type,
                                "participants_count": 1,
                                "initiator_id": str(user_id)
                            }
                            for r_id in recipients:
                                await manager.send_to_user(str(r_id), invite_payload)
                                await manager.send_to_user(str(r_id), status_payload)
                            await manager.send_to_user(str(user_id), status_payload)
                        finally:
                            db.close()

            elif event_type == "GROUP_CALL_JOIN":
                conv_id = msg_payload.get("conversation_id")
                if conv_id:
                    conv_id = int(conv_id)
                    room = active_group_calls.get(conv_id)
                    if room:
                        user_name = msg_payload.get("user_name", "Thành viên")
                        user_avatar = msg_payload.get("user_avatar") or msg_payload.get("caller_avatar")
                        user_info = {
                            "user_id": str(user_id),
                            "name": user_name,
                            "avatar": user_avatar
                        }
                        # Lấy danh sách thành viên hiện có ngoại trừ chính người đang join
                        existing_participants = [
                            p for uid, p in room["participants"].items()
                            if str(uid) != str(user_id)
                        ]
                        room["participants"][str(user_id)] = user_info
                        room["max_participants"] = max(room.get("max_participants", 1), len(room["participants"]))

                        await websocket.send_json({
                            "type": "GROUP_CALL_ROOM_STATE",
                            "conversation_id": conv_id,
                            "initiator_id": room["initiator_id"],
                            "call_type": room["call_type"],
                            "participants": existing_participants
                        })

                        for p in existing_participants:
                            await manager.send_to_user(str(p["user_id"]), {
                                "type": "GROUP_CALL_USER_JOINED",
                                "conversation_id": conv_id,
                                "user": user_info
                            })

                        status_payload = {
                            "type": "GROUP_CALL_STATUS",
                            "conversation_id": conv_id,
                            "is_active": True,
                            "call_type": room["call_type"],
                            "participants_count": len(room["participants"]),
                            "initiator_id": room["initiator_id"]
                        }
                        db = SessionLocal()
                        try:
                            all_recipients = MessageService.get_conversation_recipient_ids(conv_id, str(user_id), db)
                            for r_id in set(all_recipients + [str(user_id)]):
                                await manager.send_to_user(str(r_id), status_payload)
                        finally:
                            db.close()

            elif event_type == "GROUP_CALL_SIGNAL":
                target_user_id = msg_payload.get("to_user_id")
                if target_user_id:
                    msg_payload["from_user_id"] = str(user_id)
                    await manager.send_to_user(str(target_user_id), msg_payload)

            elif event_type == "GROUP_CALL_LEAVE":
                conv_id = msg_payload.get("conversation_id")
                if conv_id:
                    await handle_group_call_leave(int(conv_id), str(user_id))
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
        if not manager.is_user_online(user_id):
            now_dt = datetime.now(timezone.utc)
            now_iso = now_dt.isoformat()
            update_user_db_last_seen(str(user_id), now_dt)
            await manager.broadcast({
                "type": "USER_STATUS",
                "user_id": str(user_id),
                "is_online": False,
                "last_seen": now_iso
            })
        for c_id in list(active_group_calls.keys()):
            await handle_group_call_leave(c_id, str(user_id))
    except Exception:
        manager.disconnect(user_id, websocket)
        if not manager.is_user_online(user_id):
            now_dt = datetime.now(timezone.utc)
            now_iso = now_dt.isoformat()
            update_user_db_last_seen(str(user_id), now_dt)
            await manager.broadcast({
                "type": "USER_STATUS",
                "user_id": str(user_id),
                "is_online": False,
                "last_seen": now_iso
            })
        for c_id in list(active_group_calls.keys()):
            await handle_group_call_leave(c_id, str(user_id))

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
    return MessageService.get_conversations(
        current_user_id,
        tab,
        db,
        is_online_func=manager.is_user_online,
        get_last_seen_func=manager.get_last_seen
    )

@router.get(
    "/users/online-status",
    summary="Lấy trạng thái hoạt động thực tế của danh sách người dùng"
)
def get_users_online_status(
    user_ids: str = Query(..., description="Danh sách ID người dùng cách nhau bởi dấu phẩy"),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    ids = [uid.strip() for uid in user_ids.split(",") if uid.strip()]
    statuses = {}
    for uid in ids:
        online = manager.is_user_online(uid)
        last_dt = manager.get_last_seen(uid)
        if not last_dt and not online:
            u = db.query(User).filter(User.id == uid).first()
            if u and getattr(u, "last_seen", None):
                last_dt = u.last_seen.isoformat()
            else:
                last_sent_msg = db.query(Message.created_at).filter(Message.sender_id == uid).order_by(Message.id.desc()).first()
                if last_sent_msg and last_sent_msg[0]:
                    last_dt = last_sent_msg[0].isoformat()
                elif u and getattr(u, "updated_at", None):
                    last_dt = u.updated_at.isoformat()
        statuses[uid] = {
            "is_online": online,
            "last_seen": last_dt
        }
    return statuses

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

    partner_last_seen = manager.get_last_seen(str(partner.id))
    if not partner_last_seen and not manager.is_user_online(str(partner.id)):
        if getattr(partner, "last_seen", None):
            partner_last_seen = partner.last_seen.isoformat()
        else:
            last_sent = db.query(Message.created_at).filter(Message.sender_id == str(partner.id)).order_by(Message.id.desc()).first()
            if last_sent and last_sent[0]:
                partner_last_seen = last_sent[0].isoformat()
            elif getattr(partner, "updated_at", None):
                partner_last_seen = partner.updated_at.isoformat()

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
            "is_online": manager.is_user_online(str(partner.id)),
            "is_friend": is_friend,
            "last_seen": partner_last_seen
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
    "/groups/{conversation_id}/members",
    response_model=ConversationItem,
    summary="Thêm thành viên mới vào nhóm trò chuyện",
    description="Thêm một hoặc nhiều bạn bè vào nhóm trò chuyện và gửi thông báo hệ thống realtime"
)
async def add_group_members(
    conversation_id: int,
    payload: AddGroupMembersRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    result = MessageService.add_group_members(conversation_id, current_user_id, payload, db)
    updated_group = result["conversation"]
    system_messages = result["system_messages"]

    group_data = updated_group.model_dump() if hasattr(updated_group, "model_dump") else updated_group.dict()
    recipients = MessageService.get_conversation_recipient_ids(conversation_id, current_user_id, db)
    all_members = list(set(recipients + [str(current_user_id)] + [str(mid) for mid in payload.member_ids]))

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

@router.get(
    "/groups/{conversation_id}/call-status",
    summary="Lấy trạng thái cuộc gọi nhóm hiện tại",
    description="Kiểm tra xem nhóm có cuộc gọi đang diễn ra hay không và danh sách người tham gia"
)
def get_group_call_status(
    conversation_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    room = active_group_calls.get(int(conversation_id))
    if not room or len(room["participants"]) == 0:
        return {
            "is_active": False,
            "call_type": None,
            "participants_count": 0,
            "participants": [],
            "initiator_id": None
        }
    return {
        "is_active": True,
        "call_type": room["call_type"],
        "participants_count": len(room["participants"]),
        "participants": list(room["participants"].values()),
        "initiator_id": room["initiator_id"]
    }

@router.post(
    "/groups/{conversation_id}/start-call",
    summary="Bắt đầu cuộc gọi video nhóm qua REST API",
    description="Khởi tạo phòng gọi nhóm và phát tín hiệu realtime cho các thành viên trong nhóm"
)
async def start_group_call_endpoint(
    conversation_id: int,
    payload: Optional[dict] = None,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    conv_id = int(conversation_id)
    member = db.query(ConversationMember).filter(
        ConversationMember.conversation_id == conv_id,
        ConversationMember.user_id == current_user_id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Bạn không phải thành viên của nhóm này")

    user = db.query(User).filter(User.id == current_user_id).first()
    caller_name = user.full_name if user else "Thành viên"
    caller_avatar = user.avatar_url if user else None
    call_type = (payload or {}).get("call_type", "video")

    is_new_room = conv_id not in active_group_calls or len(active_group_calls[conv_id]["participants"]) == 0

    if is_new_room:
        active_group_calls[conv_id] = {
            "conversation_id": conv_id,
            "initiator_id": str(current_user_id),
            "call_type": call_type,
            "participants": {
                str(current_user_id): {
                    "user_id": str(current_user_id),
                    "name": caller_name,
                    "avatar": caller_avatar
                }
            },
            "started_at": datetime.now(timezone.utc),
            "max_participants": 1
        }
        room = active_group_calls[conv_id]
        recipients = MessageService.get_conversation_recipient_ids(conv_id, str(current_user_id), db)

        invite_payload = {
            "type": "GROUP_CALL_INVITE",
            "conversation_id": conv_id,
            "initiator_id": str(current_user_id),
            "caller_name": caller_name,
            "caller_avatar": caller_avatar,
            "call_type": call_type,
            "participants_count": 1
        }
        status_payload = {
            "type": "GROUP_CALL_STATUS",
            "conversation_id": conv_id,
            "is_active": True,
            "call_type": call_type,
            "participants_count": 1,
            "initiator_id": room["initiator_id"]
        }
        for r_id in recipients:
            await manager.send_to_user(str(r_id), invite_payload)
            await manager.send_to_user(str(r_id), status_payload)
        await manager.send_to_user(str(current_user_id), status_payload)

        return {
            "success": True,
            "is_active": True,
            "conversation_id": conv_id,
            "participants_count": 1,
            "participants": list(room["participants"].values()),
            "existing_participants": [],
            "initiator_id": room["initiator_id"]
        }
    else:
        # Phòng đã có thành viên: tự động merge người dùng này vào phòng hiện tại (JOIN)
        room = active_group_calls[conv_id]
        user_info = {
            "user_id": str(current_user_id),
            "name": caller_name,
            "avatar": caller_avatar
        }
        existing_participants = [
            p for uid, p in room["participants"].items()
            if str(uid) != str(current_user_id)
        ]
        room["participants"][str(current_user_id)] = user_info
        room["max_participants"] = max(
            room.get("max_participants", 1),
            len(room["participants"])
        )

        for p in existing_participants:
            await manager.send_to_user(str(p["user_id"]), {
                "type": "GROUP_CALL_USER_JOINED",
                "conversation_id": conv_id,
                "user": user_info
            })

        recipients = MessageService.get_conversation_recipient_ids(conv_id, str(current_user_id), db)
        status_payload = {
            "type": "GROUP_CALL_STATUS",
            "conversation_id": conv_id,
            "is_active": True,
            "call_type": room["call_type"],
            "participants_count": len(room["participants"]),
            "initiator_id": room["initiator_id"]
        }
        for r_id in set(recipients + [str(current_user_id)]):
            await manager.send_to_user(str(r_id), status_payload)

        return {
            "success": True,
            "is_active": True,
            "conversation_id": conv_id,
            "participants_count": len(room["participants"]),
            "participants": list(room["participants"].values()),
            "existing_participants": existing_participants,
            "initiator_id": room["initiator_id"]
        }

@router.post(
    "/groups/{conversation_id}/join-call",
    summary="Tham gia cuộc gọi video nhóm qua REST API"
)
async def join_group_call_endpoint(
    conversation_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    conv_id = int(conversation_id)
    room = active_group_calls.get(conv_id)
    if not room or len(room["participants"]) == 0:
        raise HTTPException(status_code=404, detail="Không có cuộc gọi nhóm nào đang diễn ra trong cuộc trò chuyện này")

    user = db.query(User).filter(User.id == current_user_id).first()
    user_info = {
        "user_id": str(current_user_id),
        "name": user.full_name if user else "Thành viên",
        "avatar": user.avatar_url if user else None
    }
    existing_participants = [
        p for uid, p in room["participants"].items()
        if str(uid) != str(current_user_id)
    ]
    room["participants"][str(current_user_id)] = user_info
    room["max_participants"] = max(room.get("max_participants", 1), len(room["participants"]))

    for p in existing_participants:
        await manager.send_to_user(str(p["user_id"]), {
            "type": "GROUP_CALL_USER_JOINED",
            "conversation_id": conv_id,
            "user": user_info
        })

    recipients = MessageService.get_conversation_recipient_ids(conv_id, str(current_user_id), db)
    status_payload = {
        "type": "GROUP_CALL_STATUS",
        "conversation_id": conv_id,
        "is_active": True,
        "call_type": room["call_type"],
        "participants_count": len(room["participants"]),
        "initiator_id": room["initiator_id"]
    }
    for r_id in set(recipients + [str(current_user_id)]):
        await manager.send_to_user(str(r_id), status_payload)

    return {
        "success": True,
        "is_active": True,
        "conversation_id": conv_id,
        "participants": existing_participants,
        "initiator_id": room["initiator_id"]
    }

@router.post(
    "/groups/{conversation_id}/leave-call",
    summary="Rời cuộc gọi video nhóm qua REST API"
)
async def leave_group_call_endpoint(
    conversation_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    await handle_group_call_leave(conversation_id, current_user_id)
    return {"success": True}

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

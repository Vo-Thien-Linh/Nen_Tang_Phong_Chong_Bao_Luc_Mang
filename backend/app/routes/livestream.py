from fastapi import APIRouter, Depends, HTTPException, status, Header, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Set
from datetime import datetime
import json

from ..database import get_db
from ..models.user import User
from ..utils.security import decode_access_token
from ..services.livestream_service import LiveStreamService
from ..schemas.livestream import (
    LiveSessionCreate,
    LiveSessionResponse,
    LiveCommentCreate,
    LiveCommentResponse,
    LiveFrameCheckRequest,
    LiveFrameCheckResponse
)

router = APIRouter(prefix="/livestreams", tags=["Chức năng Livestream Phòng Chống Bạo Lực Mạng (Mở rộng)"])

# Quản lý kết nối WebSocket cho từng phòng Livestream
class LiveRoomManager:
    def __init__(self):
        # room_id -> {user_id: set of WebSockets}
        self.rooms: Dict[int, Dict[str, Set[WebSocket]]] = {}

    async def join_room(self, room_id: int, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
        if user_id not in self.rooms[room_id]:
            self.rooms[room_id][user_id] = set()
        self.rooms[room_id][user_id].add(websocket)

        # Thông báo tăng số người xem trong phòng
        viewer_count = len(self.rooms[room_id])
        await self.broadcast(room_id, {
            "type": "ROOM_STATUS",
            "viewer_count": viewer_count,
            "message": f"Người dùng {user_id} đã tham gia phòng",
            "active_user_ids": list(self.rooms[room_id].keys())
        })

    def remove_socket(self, room_id: int, user_id: str, websocket: WebSocket):
        if room_id in self.rooms and user_id in self.rooms[room_id]:
            self.rooms[room_id][user_id].discard(websocket)
            if not self.rooms[room_id][user_id]:
                del self.rooms[room_id][user_id]
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def leave_room(self, room_id: int, user_id: str, websocket: WebSocket):
        self.remove_socket(room_id, user_id, websocket)
        if room_id in self.rooms:
            viewer_count = len(self.rooms[room_id])
            await self.broadcast(room_id, {
                "type": "ROOM_STATUS",
                "viewer_count": viewer_count,
                "message": f"Người dùng {user_id} đã rời phòng",
                "active_user_ids": list(self.rooms[room_id].keys())
            })

    async def broadcast(self, room_id: int, payload: dict, exclude_user_id: Optional[str] = None):
        if room_id not in self.rooms:
            return
        dead_conns = []
        for uid, conns in self.rooms[room_id].items():
            if exclude_user_id and uid == exclude_user_id:
                continue
            for ws in conns:
                try:
                    await ws.send_json(payload)
                except Exception:
                    dead_conns.append((uid, ws))

        for uid, ws in dead_conns:
            self.remove_socket(room_id, uid, ws)

    async def send_to_user(self, room_id: int, user_id: str, payload: dict):
        if room_id in self.rooms and user_id in self.rooms[room_id]:
            for ws in list(self.rooms[room_id][user_id]):
                try:
                    await ws.send_json(payload)
                except Exception:
                    self.remove_socket(room_id, user_id, ws)

live_manager = LiveRoomManager()

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Dependency xác thực JWT Bearer token và trả về User object"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu đăng nhập để thực hiện chức năng này"
        )
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên làm việc hết hạn hoặc token không hợp lệ"
        )
    user_id = str(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản người dùng"
        )
    return user


@router.post("", response_model=LiveSessionResponse, summary="Khởi tạo phiên Livestream mới")
def create_livestream(
    req: LiveSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = LiveStreamService.create_session(
        db=db,
        streamer_id=current_user.id,
        title=req.title,
        description=req.description,
        category=req.category
    )
    return LiveSessionResponse(
        id=session.id,
        streamer_id=str(current_user.id),
        streamer_name=current_user.full_name,
        streamer_avatar=current_user.avatar_url,
        title=session.title,
        description=session.description,
        category=session.category,
        status=session.status,
        viewer_count=session.viewer_count or 1,
        violation_count=session.violation_count or 0,
        created_at=session.created_at,
        ended_at=session.ended_at
    )


@router.get("", response_model=List[LiveSessionResponse], summary="Lấy danh sách các phòng Livestream đang phát")
def get_active_livestreams(db: Session = Depends(get_db)):
    sessions = LiveStreamService.get_active_sessions(db)
    result = []
    for s in sessions:
        streamer = db.query(User).filter(User.id == s.streamer_id).first()
        result.append(LiveSessionResponse(
            id=s.id,
            streamer_id=str(s.streamer_id),
            streamer_name=streamer.full_name if streamer else "Streamer",
            streamer_avatar=streamer.avatar_url if streamer else None,
            title=s.title,
            description=s.description,
            category=s.category,
            status=s.status,
            viewer_count=s.viewer_count or 1,
            violation_count=s.violation_count or 0,
            created_at=s.created_at,
            ended_at=s.ended_at
        ))
    return result


@router.get("/{session_id}", response_model=LiveSessionResponse, summary="Chi tiết phòng Livestream")
def get_livestream_detail(session_id: int, db: Session = Depends(get_db)):
    session = LiveStreamService.get_session_by_id(db, session_id)
    streamer = db.query(User).filter(User.id == session.streamer_id).first()
    return LiveSessionResponse(
        id=session.id,
        streamer_id=str(session.streamer_id),
        streamer_name=streamer.full_name if streamer else "Streamer",
        streamer_avatar=streamer.avatar_url if streamer else None,
        title=session.title,
        description=session.description,
        category=session.category,
        status=session.status,
        viewer_count=session.viewer_count or 1,
        violation_count=session.violation_count or 0,
        created_at=session.created_at,
        ended_at=session.ended_at
    )


@router.post("/{session_id}/end", response_model=LiveSessionResponse, summary="Kết thúc buổi Livestream")
def end_livestream(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = LiveStreamService.end_session(db, session_id, current_user.id)
    return LiveSessionResponse(
        id=session.id,
        streamer_id=str(current_user.id),
        streamer_name=current_user.full_name,
        streamer_avatar=current_user.avatar_url,
        title=session.title,
        description=session.description,
        category=session.category,
        status=session.status,
        viewer_count=session.viewer_count or 0,
        violation_count=session.violation_count or 0,
        created_at=session.created_at,
        ended_at=session.ended_at
    )


@router.post("/{session_id}/comments", response_model=LiveCommentResponse, summary="Gửi bình luận vào phòng Live (có AI kiểm duyệt bạo lực)")
def post_live_comment(
    session_id: int,
    req: LiveCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comment = LiveStreamService.post_comment(
        db=db,
        session_id=session_id,
        user_id=current_user.id,
        content=req.content
    )
    return LiveCommentResponse(
        id=comment.id,
        session_id=comment.session_id,
        user_id=str(comment.user_id),
        user_name=current_user.full_name,
        user_avatar=current_user.avatar_url,
        content=comment.content,
        is_blocked=comment.is_blocked,
        toxic_score=comment.toxic_score,
        violation_reason=comment.violation_reason,
        created_at=comment.created_at
    )


@router.get("/{session_id}/comments", response_model=List[LiveCommentResponse], summary="Lấy danh sách bình luận an toàn")
def get_live_comments(session_id: int, db: Session = Depends(get_db)):
    comments = LiveStreamService.get_comments(db, session_id)
    result = []
    for c in comments:
        user = db.query(User).filter(User.id == c.user_id).first()
        result.append(LiveCommentResponse(
            id=c.id,
            session_id=c.session_id,
            user_id=str(c.user_id),
            user_name=user.full_name if user else "Khán giả",
            user_avatar=user.avatar_url if user else None,
            content=c.content,
            is_blocked=c.is_blocked,
            toxic_score=c.toxic_score,
            violation_reason=c.violation_reason,
            created_at=c.created_at
        ))
    return result


@router.post("/{session_id}/moderate-frame", response_model=LiveFrameCheckResponse, summary="Kiểm duyệt khung hình video luồng Live")
def moderate_live_frame(
    session_id: int,
    req: LiveFrameCheckRequest,
    db: Session = Depends(get_db)
):
    is_safe, msg, action = LiveStreamService.moderate_frame(
        db=db,
        session_id=session_id,
        frame_data=req.frame_base64,
        sample_tag=req.sample_tag or "normal"
    )
    return LiveFrameCheckResponse(
        is_safe=is_safe,
        violation_type=None if is_safe else msg,
        confidence=0.92 if not is_safe else 0.05,
        action_taken=action,
        message=msg
    )


@router.post("/{session_id}/terminate", response_model=LiveSessionResponse, summary="Cưỡng chế ngắt sóng buổi Live (Admin/AI)")
def terminate_livestream(
    session_id: int,
    reason: Optional[str] = "Cưỡng chế ngắt sóng do vi phạm nghiêm trọng an toàn không gian mạng",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = LiveStreamService.emergency_terminate(db, session_id, reason)
    streamer = db.query(User).filter(User.id == session.streamer_id).first()
    return LiveSessionResponse(
        id=session.id,
        streamer_id=str(session.streamer_id),
        streamer_name=streamer.full_name if streamer else "Streamer",
        streamer_avatar=streamer.avatar_url if streamer else None,
        title=session.title,
        description=session.description,
        category=session.category,
        status=session.status,
        viewer_count=0,
        violation_count=session.violation_count or 0,
        created_at=session.created_at,
        ended_at=session.ended_at
    )


@router.websocket("/ws/{session_id}/{user_id}")
async def livestream_websocket(websocket: WebSocket, session_id: int, user_id: str):
    await live_manager.join_room(session_id, user_id, websocket)
    try:
        while True:
            raw_data = await websocket.receive_text()
            if raw_data == "ping":
                await websocket.send_text("pong")
                continue

            try:
                data = json.loads(raw_data)
            except Exception:
                continue

            event_type = data.get("type")

            # 1. Báo hiệu WebRTC cho luồng video Livestream
            if event_type in ["STREAM_OFFER", "STREAM_ANSWER", "STREAM_ICE_CANDIDATE", "STREAM_REQUEST", "STREAMER_STATUS"]:
                target_user = data.get("target_user_id")
                data["from_user_id"] = user_id
                if target_user:
                    await live_manager.send_to_user(session_id, str(target_user), data)
                else:
                    await live_manager.broadcast(session_id, data, exclude_user_id=user_id)

            # 2. Luồng bình luận Realtime có phân tích độc hại
            elif event_type == "LIVE_CHAT":
                content = data.get("content", "")
                is_blocked, score, reason = LiveStreamService.analyze_content(content)
                if is_blocked:
                    # Gửi cảnh báo riêng cho người gửi (Friendly Nudge)
                    await websocket.send_json({
                        "type": "CHAT_MODERATION_ALERT",
                        "status": "BLOCKED",
                        "content": content,
                        "toxic_score": score,
                        "reason": reason,
                        "message": f"Bình luận bị chặn vì: {reason}. Hãy giữ gìn văn hóa ứng xử trực tuyến!"
                    })
                else:
                    # Phát tán bình luận an toàn tới toàn bộ khán giả
                    await live_manager.broadcast(session_id, {
                        "type": "NEW_LIVE_COMMENT",
                        "user_id": user_id,
                        "user_name": data.get("user_name", f"Khán giả {user_id}"),
                        "content": content,
                        "created_at": datetime.utcnow().isoformat()
                    })

            # 3. Phản ứng cảm xúc (Reaction Floating Hearts)
            elif event_type == "LIVE_REACTION":
                reaction_type = data.get("reaction", "❤️")
                await live_manager.broadcast(session_id, {
                    "type": "FLOATING_REACTION",
                    "user_id": user_id,
                    "reaction": reaction_type
                })

    except WebSocketDisconnect:
        await live_manager.leave_room(session_id, user_id, websocket)
    except Exception:
        await live_manager.leave_room(session_id, user_id, websocket)

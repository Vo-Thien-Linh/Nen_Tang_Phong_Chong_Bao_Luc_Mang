from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from ..database import get_db
from ..utils.security import decode_access_token
from ..services.friend_service import FriendService
from ..schemas.friendship import (
    FriendRequestItem,
    FriendItem,
    FriendSuggestionItem,
    FriendshipStatusResponse,
    FriendshipActionResponse
)

router = APIRouter(prefix="/friends", tags=["Chức năng Kết bạn (Friendship)"])

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

@router.post(
    "/request/{target_user_id}",
    response_model=FriendshipActionResponse,
    summary="Gửi lời mời kết bạn",
    description="Gửi lời mời kết bạn tới người dùng target_user_id"
)
def send_friend_request(
    target_user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return FriendService.send_request(current_user_id, target_user_id, db)

@router.post(
    "/accept/{request_id}",
    response_model=FriendshipActionResponse,
    summary="Chấp nhận lời mời kết bạn",
    description="Chấp thuận lời mời kết bạn có mã request_id"
)
def accept_friend_request(
    request_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return FriendService.accept_request(request_id, current_user_id, db)

@router.post(
    "/reject/{request_id}",
    response_model=FriendshipActionResponse,
    summary="Từ chối/Xóa lời mời kết bạn",
    description="Từ chối lời mời kết bạn có mã request_id"
)
def reject_friend_request(
    request_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return FriendService.reject_request(request_id, current_user_id, db)

@router.delete(
    "/cancel/{target_user_id}",
    response_model=FriendshipActionResponse,
    summary="Thu hồi lời mời kết bạn đã gửi",
    description="Hủy bỏ yêu cầu kết bạn đang chờ phản hồi đã gửi tới target_user_id"
)
def cancel_friend_request(
    target_user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return FriendService.cancel_sent_request(target_user_id, current_user_id, db)

@router.delete(
    "/{target_user_id}",
    response_model=FriendshipActionResponse,
    summary="Hủy kết bạn (Unfriend)",
    description="Xóa bỏ quan hệ bạn bè với target_user_id"
)
def unfriend(
    target_user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return FriendService.unfriend(target_user_id, current_user_id, db)

@router.get(
    "/requests",
    response_model=List[FriendRequestItem],
    summary="Danh sách lời mời kết bạn đang chờ",
    description="Lấy tất cả lời mời kết bạn gửi đến người dùng hiện tại (kèm thông tin bạn chung)"
)
def get_friend_requests(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return FriendService.get_pending_requests(current_user_id, db)

@router.get(
    "/list",
    response_model=List[FriendItem],
    summary="Danh sách bạn bè hiện tại",
    description="Lấy danh sách tất cả bạn bè, hỗ trợ tìm kiếm theo tên hoặc username"
)
def get_friends(
    search: Optional[str] = Query(None, description="Từ khóa tìm kiếm theo tên/username"),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return FriendService.get_friends_list(current_user_id, db, search)

@router.get(
    "/suggestions",
    response_model=List[FriendSuggestionItem],
    summary="Gợi ý kết bạn thông minh",
    description="Thuật toán Bạn của bạn bè (Friends of Friends), xếp hạng người có nhiều bạn chung lên đầu"
)
def get_friend_suggestions(
    limit: int = Query(20, ge=1, le=50, description="Số lượng gợi ý tối đa"),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return FriendService.get_suggestions(current_user_id, db, limit)

@router.get(
    "/status/{target_user_id}",
    response_model=FriendshipStatusResponse,
    summary="Kiểm tra trạng thái kết bạn",
    description="Lấy trạng thái quan hệ giữa tài khoản hiện tại và target_user_id ('none', 'pending_sent', 'pending_received', 'friends', 'blocked')"
)
def get_friendship_status(
    target_user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return FriendService.get_friendship_status(current_user_id, target_user_id, db)

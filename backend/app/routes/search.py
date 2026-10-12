from fastapi import APIRouter, Depends, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from typing import Optional, List, Dict, Any

from ..database import get_db
from ..utils.security import decode_access_token
from ..models.user import User
from ..models.post import Post
from ..services.friend_service import FriendService

router = APIRouter(prefix="/search", tags=["Chức năng Tìm kiếm (Search)"])

def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Dependency lấy user_id từ JWT Bearer token nếu có (không bắt buộc)"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    return payload["sub"]

@router.get("", summary="Tìm kiếm tổng hợp (Người dùng & Bài viết)")
def search_all(
    q: str = Query(..., min_length=1, description="Từ khóa tìm kiếm"),
    type: str = Query("all", description="Loại tìm kiếm: all, users, posts"),
    limit: int = Query(10, ge=1, le=50, description="Giới hạn số lượng kết quả"),
    current_user_id: Optional[str] = Depends(get_optional_user_id),
    db: Session = Depends(get_db)
):
    keyword = q.strip()
    if not keyword:
        return {"users": [], "posts": [], "query": ""}

    results: Dict[str, Any] = {
        "query": keyword,
        "users": [],
        "posts": []
    }

    # 1. Tìm kiếm người dùng
    if type in ["all", "users"]:
        user_query = db.query(User).filter(
            User.status != "banned",
            or_(
                User.full_name.ilike(f"%{keyword}%"),
                User.username.ilike(f"%{keyword}%"),
                User.email.ilike(f"%{keyword}%")
            )
        )
        matched_users = user_query.limit(limit).all()

        friend_ids = set()
        if current_user_id:
            try:
                friend_ids = FriendService._get_friend_ids(current_user_id, db)
            except Exception:
                friend_ids = set()

        for u in matched_users:
            results["users"].append({
                "id": str(u.id),
                "name": u.full_name,
                "username": u.username,
                "avatar": u.avatar_url or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
                "bio": u.bio or "Thành viên WINGS",
                "is_friend": str(u.id) in friend_ids,
                "is_me": current_user_id is not None and str(u.id) == current_user_id
            })

    # 2. Tìm kiếm bài viết
    if type in ["all", "posts"]:
        try:
            post_query = db.query(Post).filter(
                Post.content.ilike(f"%{keyword}%"),
                Post.ai_status != "hidden"
            ).order_by(desc(Post.created_at)).limit(limit)

            matched_posts = post_query.all()
            for p in matched_posts:
                author_name = p.author.full_name if p.author else "Người dùng WINGS"
                author_avatar = (p.author.avatar_url if p.author and p.author.avatar_url else None) or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"
                author_username = p.author.username if p.author else "user"
                results["posts"].append({
                    "id": p.id,
                    "content": p.content,
                    "imageUrl": p.image_url,
                    "createdAt": p.created_at.isoformat() if p.created_at else None,
                    "likesCount": p.likes_count or 0,
                    "commentsCount": p.comments_count or 0,
                    "author": {
                        "id": str(p.author_id),
                        "name": author_name,
                        "username": author_username,
                        "avatar": author_avatar
                    }
                })
        except Exception as e:
            print("Lưu ý: Không thể truy vấn bảng posts từ database:", e)

    return results

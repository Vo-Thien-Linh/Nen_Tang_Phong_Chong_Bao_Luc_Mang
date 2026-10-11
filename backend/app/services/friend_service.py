from typing import List, Optional, Set, Dict
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from fastapi import HTTPException, status

from ..models.user import User
from ..models.friendship import Friendship
from ..schemas.friendship import (
    UserFriendSummary,
    MutualFriendSummary,
    FriendRequestItem,
    FriendItem,
    FriendSuggestionItem,
    FriendshipStatusResponse,
    FriendshipActionResponse
)

class FriendService:

    @staticmethod
    def _get_friend_ids(user_id: str, db: Session) -> Set[str]:
        """Lấy tập hợp ID tất cả bạn bè chính thức của một người dùng"""
        friendships = db.query(Friendship).filter(
            or_(
                Friendship.requester_id == user_id,
                Friendship.addressee_id == user_id
            ),
            Friendship.status == "accepted"
        ).all()

        friend_ids = set()
        for f in friendships:
            if f.requester_id == user_id:
                friend_ids.add(f.addressee_id)
            else:
                friend_ids.add(f.requester_id)
        return friend_ids

    @staticmethod
    def _get_mutual_friends_data(user_id_1: str, user_id_2: str, db: Session) -> List[MutualFriendSummary]:
        """Tính toán danh sách các bạn bè chung giữa hai người"""
        friends_1 = FriendService._get_friend_ids(user_id_1, db)
        friends_2 = FriendService._get_friend_ids(user_id_2, db)
        mutual_ids = list(friends_1.intersection(friends_2))

        if not mutual_ids:
            return []

        # Lấy tối đa 5 người để hiển thị giao diện
        sample_ids = mutual_ids[:5]
        users = db.query(User).filter(User.id.in_(sample_ids)).all()

        return [
            MutualFriendSummary(
                id=u.id,
                name=u.full_name,
                avatar=u.avatar_url
            )
            for u in users
        ]

    @staticmethod
    def send_request(current_user_id: str, target_user_id: str, db: Session) -> FriendshipActionResponse:
        """Gửi lời mời kết bạn từ current_user tới target_user"""
        if current_user_id == target_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể tự gửi lời mời kết bạn cho chính mình"
            )

        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người dùng này"
            )

        # Kiểm tra quan hệ 2 chiều hiện có
        existing = db.query(Friendship).filter(
            or_(
                and_(Friendship.requester_id == current_user_id, Friendship.addressee_id == target_user_id),
                and_(Friendship.requester_id == target_user_id, Friendship.addressee_id == current_user_id)
            )
        ).first()

        if existing:
            if existing.status == "accepted":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Hai bạn đã là bạn bè của nhau"
                )
            if existing.status == "pending":
                if existing.requester_id == current_user_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Bạn đã gửi lời mời kết bạn trước đó, vui lòng chờ đối phương phản hồi"
                    )
                else:
                    # Đối phương đã gửi lời mời cho mình trước đó -> Tự động chấp nhận luôn
                    existing.status = "accepted"
                    db.commit()
                    db.refresh(existing)
                    return FriendshipActionResponse(
                        success=True,
                        message="Đối phương đã gửi lời mời trước đó, hai bạn đã chính thức trở thành bạn bè!",
                        data={"friendship_id": existing.id, "status": "accepted"}
                    )
            if existing.status == "declined":
                # Cho phép gửi lại lời mời nếu trước đó bị từ chối
                existing.requester_id = current_user_id
                existing.addressee_id = target_user_id
                existing.status = "pending"
                db.commit()
                db.refresh(existing)
                return FriendshipActionResponse(
                    success=True,
                    message="Đã gửi lời mời kết bạn thành công",
                    data={"friendship_id": existing.id, "status": "pending"}
                )

        new_request = Friendship(
            requester_id=current_user_id,
            addressee_id=target_user_id,
            status="pending"
        )
        db.add(new_request)
        db.commit()
        db.refresh(new_request)

        return FriendshipActionResponse(
            success=True,
            message="Đã gửi lời mời kết bạn thành công",
            data={"friendship_id": new_request.id, "status": "pending"}
        )

    @staticmethod
    def accept_request(request_id: int, current_user_id: str, db: Session) -> FriendshipActionResponse:
        """Chấp nhận lời mời kết bạn được gửi đến mình"""
        friendship = db.query(Friendship).filter(
            Friendship.id == request_id,
            Friendship.addressee_id == current_user_id,
            Friendship.status == "pending"
        ).first()

        if not friendship:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lời mời kết bạn phù hợp hoặc đã được xử lý"
            )

        friendship.status = "accepted"
        db.commit()

        requester = db.query(User).filter(User.id == friendship.requester_id).first()
        friend_name = requester.full_name if requester else "người dùng này"

        return FriendshipActionResponse(
            success=True,
            message=f"Đã đồng ý kết bạn với {friend_name}",
            data={"friendship_id": friendship.id, "status": "accepted"}
        )

    @staticmethod
    def reject_request(request_id: int, current_user_id: str, db: Session) -> FriendshipActionResponse:
        """Từ chối lời mời kết bạn"""
        friendship = db.query(Friendship).filter(
            Friendship.id == request_id,
            Friendship.addressee_id == current_user_id,
            Friendship.status == "pending"
        ).first()

        if not friendship:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lời mời kết bạn để xóa"
            )

        # Xóa bản ghi để hai bên có thể tương tác lại sau này
        db.delete(friendship)
        db.commit()

        return FriendshipActionResponse(
            success=True,
            message="Đã xóa lời mời kết bạn",
            data={"friendship_id": request_id, "status": "none"}
        )

    @staticmethod
    def cancel_sent_request(target_user_id: str, current_user_id: str, db: Session) -> FriendshipActionResponse:
        """Thu hồi lời mời kết bạn mà mình đã gửi đi"""
        friendship = db.query(Friendship).filter(
            Friendship.requester_id == current_user_id,
            Friendship.addressee_id == target_user_id,
            Friendship.status == "pending"
        ).first()

        if not friendship:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lời mời kết bạn đã gửi"
            )

        db.delete(friendship)
        db.commit()

        return FriendshipActionResponse(
            success=True,
            message="Đã thu hồi lời mời kết bạn",
            data={"target_user_id": target_user_id, "status": "none"}
        )

    @staticmethod
    def unfriend(target_user_id: str, current_user_id: str, db: Session) -> FriendshipActionResponse:
        """Hủy quan hệ bạn bè giữa hai người"""
        friendship = db.query(Friendship).filter(
            or_(
                and_(Friendship.requester_id == current_user_id, Friendship.addressee_id == target_user_id),
                and_(Friendship.requester_id == target_user_id, Friendship.addressee_id == current_user_id)
            ),
            Friendship.status == "accepted"
        ).first()

        if not friendship:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hai bạn chưa phải là bạn bè để hủy kết bạn"
            )

        db.delete(friendship)
        db.commit()

        return FriendshipActionResponse(
            success=True,
            message="Đã hủy kết bạn thành công",
            data={"target_user_id": target_user_id, "status": "none"}
        )

    @staticmethod
    def get_pending_requests(current_user_id: str, db: Session) -> List[FriendRequestItem]:
        """Lấy danh sách lời mời kết bạn gửi đến người dùng hiện tại (Tab Lời mời)"""
        requests = db.query(Friendship).filter(
            Friendship.addressee_id == current_user_id,
            Friendship.status == "pending"
        ).order_by(desc(Friendship.created_at)).all()

        results = []
        for req in requests:
            requester = db.query(User).filter(User.id == req.requester_id).first()
            if not requester:
                continue

            mutual_data = FriendService._get_mutual_friends_data(current_user_id, requester.id, db)
            all_mutual_ids = FriendService._get_friend_ids(current_user_id, db).intersection(
                FriendService._get_friend_ids(requester.id, db)
            )

            results.append(
                FriendRequestItem(
                    id=req.id,
                    user=UserFriendSummary(
                        id=requester.id,
                        username=requester.username,
                        full_name=requester.full_name,
                        avatar_url=requester.avatar_url,
                        bio=requester.bio
                    ),
                    mutual_friends=mutual_data,
                    mutual_friends_count=len(all_mutual_ids),
                    created_at=req.created_at
                )
            )

        return results

    @staticmethod
    def get_friends_list(current_user_id: str, db: Session, search: Optional[str] = None) -> List[FriendItem]:
        """Lấy danh sách bạn bè chính thức (Tab Tất cả bạn bè)"""
        friend_ids = FriendService._get_friend_ids(current_user_id, db)
        if not friend_ids:
            return []

        query = db.query(User).filter(User.id.in_(list(friend_ids)))
        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            query = query.filter(
                or_(
                    User.full_name.ilike(s),
                    User.username.ilike(s)
                )
            )

        users = query.all()

        results = []
        for u in users:
            mutual_ids = FriendService._get_friend_ids(current_user_id, db).intersection(
                FriendService._get_friend_ids(u.id, db)
            )
            results.append(
                FriendItem(
                    id=u.id,
                    username=u.username,
                    name=u.full_name,
                    avatar=u.avatar_url,
                    bio=u.bio,
                    mutual_friends_count=len(mutual_ids)
                )
            )

        return results

    @staticmethod
    def get_suggestions(current_user_id: str, db: Session, limit: int = 20) -> List[FriendSuggestionItem]:
        """Gợi ý kết bạn theo thuật toán Bạn của bạn (Friends of Friends)"""
        my_friends = FriendService._get_friend_ids(current_user_id, db)

        # Lấy các user đang có lời mời pending (cả gửi đi và nhận về) để không gợi ý lại
        pending_records = db.query(Friendship).filter(
            or_(
                Friendship.requester_id == current_user_id,
                Friendship.addressee_id == current_user_id
            ),
            Friendship.status == "pending"
        ).all()

        pending_ids = set()
        sent_request_ids = set()
        for p in pending_records:
            other_id = p.addressee_id if p.requester_id == current_user_id else p.requester_id
            pending_ids.add(other_id)
            if p.requester_id == current_user_id:
                sent_request_ids.add(p.addressee_id)

        # Tập ID cần loại trừ khỏi gợi ý: chính mình + bạn bè hiện tại + người đang có lời mời chờ
        excluded_ids = my_friends.union(pending_ids).union({current_user_id})

        # 1. Tìm ứng viên từ Bạn của bạn bè
        candidate_scores: Dict[str, int] = {}
        for friend_id in my_friends:
            fof_ids = FriendService._get_friend_ids(friend_id, db)
            for fof_id in fof_ids:
                if fof_id not in excluded_ids:
                    candidate_scores[fof_id] = candidate_scores.get(fof_id, 0) + 1

        # Sắp xếp ứng viên có nhiều bạn chung nhất lên đầu
        sorted_candidates = sorted(candidate_scores.items(), key=lambda x: x[1], reverse=True)
        top_candidate_ids = [uid for uid, _ in sorted_candidates[:limit]]

        # 2. Nếu không đủ ứng viên (người dùng mới), bổ sung thêm các người dùng active khác
        if len(top_candidate_ids) < limit:
            remaining_slots = limit - len(top_candidate_ids)
            more_users = db.query(User).filter(
                ~User.id.in_(list(excluded_ids.union(set(top_candidate_ids)))),
                User.status == "active"
            ).limit(remaining_slots).all()
            top_candidate_ids.extend([u.id for u in more_users])

        if not top_candidate_ids:
            return []

        candidates = db.query(User).filter(User.id.in_(top_candidate_ids)).all()
        # Đưa về dictionary để giữ đúng thứ tự sắp xếp theo điểm bạn chung
        user_map = {u.id: u for u in candidates}

        results = []
        for uid in top_candidate_ids:
            u = user_map.get(uid)
            if not u:
                continue

            mutual_data = FriendService._get_mutual_friends_data(current_user_id, u.id, db)
            all_mutual = my_friends.intersection(FriendService._get_friend_ids(u.id, db))

            results.append(
                FriendSuggestionItem(
                    id=u.id,
                    username=u.username,
                    name=u.full_name,
                    avatar=u.avatar_url,
                    bio=u.bio,
                    mutual_friends=mutual_data,
                    mutual_count=len(all_mutual),
                    request_sent=u.id in sent_request_ids
                )
            )

        return results

    @staticmethod
    def get_friendship_status(current_user_id: str, target_user_id: str, db: Session) -> FriendshipStatusResponse:
        """Lấy trạng thái kết bạn giữa current_user và một tài khoản bất kỳ"""
        if current_user_id == target_user_id:
            return FriendshipStatusResponse(
                target_user_id=target_user_id,
                status="self"
            )

        f = db.query(Friendship).filter(
            or_(
                and_(Friendship.requester_id == current_user_id, Friendship.addressee_id == target_user_id),
                and_(Friendship.requester_id == target_user_id, Friendship.addressee_id == current_user_id)
            )
        ).first()

        if not f:
            return FriendshipStatusResponse(target_user_id=target_user_id, status="none")

        if f.status == "accepted":
            return FriendshipStatusResponse(target_user_id=target_user_id, status="friends", friendship_id=f.id)

        if f.status == "pending":
            if f.requester_id == current_user_id:
                return FriendshipStatusResponse(target_user_id=target_user_id, status="pending_sent", friendship_id=f.id)
            else:
                return FriendshipStatusResponse(target_user_id=target_user_id, status="pending_received", friendship_id=f.id)

        if f.status == "blocked":
            return FriendshipStatusResponse(target_user_id=target_user_id, status="blocked", friendship_id=f.id)

        return FriendshipStatusResponse(target_user_id=target_user_id, status="none")

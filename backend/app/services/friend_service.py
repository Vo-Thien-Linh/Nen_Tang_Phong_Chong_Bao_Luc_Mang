from typing import List, Optional, Set, Dict
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func
from fastapi import HTTPException, status

from ..models.user import User
from ..models.friendship import Friendship
from ..models.message import Conversation
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
        """Lấy tập hợp ID tất cả bạn bè chính thức của một người dùng (1 query)"""
        friendships = db.query(Friendship).filter(
            or_(
                Friendship.requester_id == user_id,
                Friendship.addressee_id == user_id
            ),
            Friendship.status == "accepted"
        ).all()

        friend_ids = set()
        for f in friendships:
            if str(f.requester_id) == user_id:
                friend_ids.add(str(f.addressee_id))
            else:
                friend_ids.add(str(f.requester_id))
        return friend_ids

    @staticmethod
    def _get_batch_friend_maps(user_ids: List[str], db: Session) -> Dict[str, Set[str]]:
        """Gộp truy vấn: Lấy danh sách bạn bè cho nhiều người dùng chỉ trong 1 câu SQL"""
        if not user_ids:
            return {}

        mapping: Dict[str, Set[str]] = {uid: set() for uid in user_ids}
        friendships = db.query(Friendship).filter(
            or_(
                Friendship.requester_id.in_(user_ids),
                Friendship.addressee_id.in_(user_ids)
            ),
            Friendship.status == "accepted"
        ).all()

        for f in friendships:
            req_id = str(f.requester_id)
            addr_id = str(f.addressee_id)
            if req_id in mapping:
                mapping[req_id].add(addr_id)
            if addr_id in mapping:
                mapping[addr_id].add(req_id)

        return mapping

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
                if str(existing.requester_id) == current_user_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Bạn đã gửi lời mời kết bạn trước đó, vui lòng chờ đối phương phản hồi"
                    )
                else:
                    existing.status = "accepted"

                    # TỰ ĐỘNG THÊM BẠN BÈ VÀO Ô CHÁT (Tạo/kích hoạt hội thoại 'accepted')
                    partner_id = str(existing.requester_id)
                    u1, u2 = (current_user_id, partner_id) if str(current_user_id) < str(partner_id) else (partner_id, current_user_id)
                    conv = db.query(Conversation).filter(
                        or_(
                            and_(Conversation.user1_id == u1, Conversation.user2_id == u2),
                            and_(Conversation.user1_id == u2, Conversation.user2_id == u1)
                        )
                    ).first()
                    if conv:
                        conv.status = "accepted"
                        conv.last_message_at = func.now()
                    else:
                        new_conv = Conversation(
                            user1_id=u1,
                            user2_id=u2,
                            status="accepted",
                            initiated_by=current_user_id,
                            last_message_at=func.now(),
                            created_at=func.now(),
                            updated_at=func.now()
                        )
                        db.add(new_conv)

                    db.commit()
                    return FriendshipActionResponse(
                        success=True,
                        message="Đối phương đã gửi lời mời trước đó, hai bạn đã chính thức trở thành bạn bè!",
                        data={"friendship_id": existing.id, "status": "accepted"}
                    )
            if existing.status == "declined":
                existing.requester_id = current_user_id
                existing.addressee_id = target_user_id
                existing.status = "pending"
                db.commit()
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

        return FriendshipActionResponse(
            success=True,
            message="Đã gửi lời mời kết bạn thành công",
            data={"friendship_id": new_request.id, "status": "pending"}
        )

    @staticmethod
    def accept_request(request_id: int, current_user_id: str, db: Session) -> FriendshipActionResponse:
        """Chấp nhận lời mời kết bạn"""
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

        # TỰ ĐỘNG THÊM BẠN BÈ VÀO Ô CHÁT (Tạo/kích hoạt hội thoại 'accepted')
        partner_id = str(friendship.requester_id)
        u1, u2 = (current_user_id, partner_id) if str(current_user_id) < str(partner_id) else (partner_id, current_user_id)
        conv = db.query(Conversation).filter(
            or_(
                and_(Conversation.user1_id == u1, Conversation.user2_id == u2),
                and_(Conversation.user1_id == u2, Conversation.user2_id == u1)
            )
        ).first()
        if conv:
            conv.status = "accepted"
            conv.last_message_at = func.now()
        else:
            new_conv = Conversation(
                user1_id=u1,
                user2_id=u2,
                status="accepted",
                initiated_by=current_user_id,
                last_message_at=func.now(),
                created_at=func.now(),
                updated_at=func.now()
            )
            db.add(new_conv)

        db.commit()

        return FriendshipActionResponse(
            success=True,
            message="Đã đồng ý kết bạn",
            data={"friendship_id": friendship.id, "status": "accepted"}
        )

    @staticmethod
    def reject_request(request_id: int, current_user_id: str, db: Session) -> FriendshipActionResponse:
        """Từ chối / Xóa lời mời kết bạn"""
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

        db.delete(friendship)
        db.commit()

        return FriendshipActionResponse(
            success=True,
            message="Đã xóa lời mời kết bạn",
            data={"friendship_id": request_id, "status": "none"}
        )

    @staticmethod
    def cancel_sent_request(target_user_id: str, current_user_id: str, db: Session) -> FriendshipActionResponse:
        """Thu hồi lời mời kết bạn đã gửi đi"""
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
        """Lấy danh sách lời mời kết bạn gửi đến người dùng hiện tại (Tối ưu Batch Query)"""
        requests = db.query(Friendship).filter(
            Friendship.addressee_id == current_user_id,
            Friendship.status == "pending"
        ).order_by(desc(Friendship.created_at)).all()

        if not requests:
            return []

        requester_ids = [str(r.requester_id) for r in requests]
        users = db.query(User).filter(User.id.in_(requester_ids)).all()
        user_map = {str(u.id): u for u in users}

        # Batch query bạn bè của current_user và tất cả requesters (Chỉ 1 query)
        all_related_ids = [current_user_id] + requester_ids
        friend_maps = FriendService._get_batch_friend_maps(all_related_ids, db)
        my_friends = friend_maps.get(current_user_id, set())

        # Thu thập các ID bạn chung cần hiển thị avatar
        sample_mutual_ids = set()
        req_mutual_map = {}
        for rid in requester_ids:
            req_friends = friend_maps.get(rid, set())
            mutual = my_friends.intersection(req_friends)
            req_mutual_map[rid] = mutual
            sample_mutual_ids.update(list(mutual)[:5])

        sample_users = {}
        if sample_mutual_ids:
            s_users = db.query(User).filter(User.id.in_(list(sample_mutual_ids))).all()
            sample_users = {str(u.id): MutualFriendSummary(id=str(u.id), name=u.full_name, avatar=u.avatar_url) for u in s_users}

        results = []
        for req in requests:
            rid = str(req.requester_id)
            requester = user_map.get(rid)
            if not requester:
                continue

            mutual_ids = req_mutual_map.get(rid, set())
            mutual_list = [sample_users[mid] for mid in list(mutual_ids)[:5] if mid in sample_users]

            results.append(
                FriendRequestItem(
                    id=req.id,
                    user=UserFriendSummary(
                        id=str(requester.id),
                        username=requester.username,
                        full_name=requester.full_name,
                        avatar_url=requester.avatar_url,
                        bio=requester.bio
                    ),
                    mutual_friends=mutual_list,
                    mutual_friends_count=len(mutual_ids),
                    created_at=req.created_at
                )
            )

        return results

    @staticmethod
    def get_friends_list(current_user_id: str, db: Session, search: Optional[str] = None) -> List[FriendItem]:
        """Lấy danh sách bạn bè chính thức (Tối ưu tốc độ cao qua Batch Query)"""
        my_friends = FriendService._get_friend_ids(current_user_id, db)
        if not my_friends:
            return []

        query = db.query(User).filter(User.id.in_(list(my_friends)))
        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            query = query.filter(
                or_(
                    User.full_name.ilike(s),
                    User.username.ilike(s)
                )
            )

        users = query.all()
        if not users:
            return []

        friend_ids = [str(u.id) for u in users]
        # Batch lấy quan hệ bạn bè của tất cả bạn bè (chỉ 1 query)
        friend_maps = FriendService._get_batch_friend_maps(friend_ids, db)

        results = []
        for u in users:
            uid = str(u.id)
            u_friends = friend_maps.get(uid, set())
            mutual_count = len(my_friends.intersection(u_friends))

            results.append(
                FriendItem(
                    id=uid,
                    username=u.username,
                    name=u.full_name,
                    avatar=u.avatar_url,
                    bio=u.bio,
                    mutual_friends_count=mutual_count
                )
            )

        return results

    @staticmethod
    def get_suggestions(current_user_id: str, db: Session, limit: int = 20) -> List[FriendSuggestionItem]:
        """Gợi ý kết bạn theo thuật toán Bạn của bạn (Friends of Friends) - Tối ưu Batch Query"""
        my_friends = FriendService._get_friend_ids(current_user_id, db)

        # Lấy các user đang có lời mời pending trong 1 query
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
            req_id = str(p.requester_id)
            addr_id = str(p.addressee_id)
            other_id = addr_id if req_id == current_user_id else req_id
            pending_ids.add(other_id)
            if req_id == current_user_id:
                sent_request_ids.add(addr_id)

        excluded_ids = my_friends.union(pending_ids).union({current_user_id})

        # Batch query bạn bè của tất cả my_friends chỉ trong 1 câu SQL
        friend_maps = FriendService._get_batch_friend_maps(list(my_friends), db)

        candidate_scores: Dict[str, int] = {}
        for fid, fof_ids in friend_maps.items():
            for fof_id in fof_ids:
                if fof_id not in excluded_ids:
                    candidate_scores[fof_id] = candidate_scores.get(fof_id, 0) + 1

        sorted_candidates = sorted(candidate_scores.items(), key=lambda x: x[1], reverse=True)
        top_candidate_ids = [uid for uid, _ in sorted_candidates[:limit]]

        # Nếu không đủ ứng viên (user mới), lấy thêm user active khác
        if len(top_candidate_ids) < limit:
            remaining = limit - len(top_candidate_ids)
            more_users = db.query(User).filter(
                ~User.id.in_(list(excluded_ids.union(set(top_candidate_ids)))),
                User.status == "active"
            ).limit(remaining).all()
            top_candidate_ids.extend([str(u.id) for u in more_users])

        if not top_candidate_ids:
            return []

        candidates = db.query(User).filter(User.id.in_(top_candidate_ids)).all()
        user_map = {str(u.id): u for u in candidates}

        # Batch query để lấy danh sách bạn chung của các ứng viên
        candidate_friend_maps = FriendService._get_batch_friend_maps(top_candidate_ids, db)

        sample_mutual_ids = set()
        for cid in top_candidate_ids:
            c_friends = candidate_friend_maps.get(cid, set())
            mutual = my_friends.intersection(c_friends)
            sample_mutual_ids.update(list(mutual)[:5])

        sample_users = {}
        if sample_mutual_ids:
            s_users = db.query(User).filter(User.id.in_(list(sample_mutual_ids))).all()
            sample_users = {str(u.id): MutualFriendSummary(id=str(u.id), name=u.full_name, avatar=u.avatar_url) for u in s_users}

        results = []
        for uid in top_candidate_ids:
            u = user_map.get(uid)
            if not u:
                continue

            c_friends = candidate_friend_maps.get(uid, set())
            mutual = my_friends.intersection(c_friends)
            mutual_list = [sample_users[mid] for mid in list(mutual)[:5] if mid in sample_users]

            results.append(
                FriendSuggestionItem(
                    id=str(u.id),
                    username=u.username,
                    name=u.full_name,
                    avatar=u.avatar_url,
                    bio=u.bio,
                    mutual_friends=mutual_list,
                    mutual_count=len(mutual),
                    request_sent=uid in sent_request_ids
                )
            )

        return results

    @staticmethod
    def get_friendship_status(current_user_id: str, target_user_id: str, db: Session) -> FriendshipStatusResponse:
        """Lấy trạng thái kết bạn giữa current_user và một tài khoản bất kỳ"""
        if current_user_id == target_user_id:
            return FriendshipStatusResponse(target_user_id=target_user_id, status="self")

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
            if str(f.requester_id) == current_user_id:
                return FriendshipStatusResponse(target_user_id=target_user_id, status="pending_sent", friendship_id=f.id)
            else:
                return FriendshipStatusResponse(target_user_id=target_user_id, status="pending_received", friendship_id=f.id)

        if f.status == "blocked":
            return FriendshipStatusResponse(target_user_id=target_user_id, status="blocked", friendship_id=f.id)

        return FriendshipStatusResponse(target_user_id=target_user_id, status="none")

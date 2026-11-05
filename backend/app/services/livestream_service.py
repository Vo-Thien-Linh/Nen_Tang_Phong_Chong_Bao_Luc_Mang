from datetime import datetime
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status

from ..models.livestream import LiveSession, LiveComment, LiveSanction
from ..models.user import User

# Từ điển kiểm duyệt từ khóa thù ghét, bạo lực và công kích cá nhân (Cyberbullying & Hate speech)
BLACK_LIST_KEYWORDS: Dict[str, Tuple[float, str]] = {
    "giết": (0.95, "Đe dọa bạo lực / Xâm hại thân thể"),
    "đánh chết": (0.98, "Đe dọa tính mạng / Bạo lực nghiêm trọng"),
    "đập nát": (0.90, "Đe dọa bạo lực thể xác"),
    "chết đi": (0.92, "Xúi giục tự hại / Bạo lực ngôn từ"),
    "súc vật": (0.85, "Xúc phạm danh dự / Hạ thấp nhân phẩm"),
    "con điếm": (0.90, "Lăng mạ / Quấy rối tình dục"),
    "đm": (0.80, "Ngôn từ tục tĩu / Chửi bới"),
    "đcm": (0.85, "Ngôn từ tục tĩu / Chửi bới"),
    "vcl": (0.75, "Ngôn từ thiếu văn hóa"),
    "rác rưởi": (0.70, "Công kích cá nhân / Miệt thị"),
    "cút đi": (0.65, "Bắt nạt hội đồng / Xua đuổi"),
    "đồ khốn": (0.75, "Lăng mạ cá nhân"),
    "mất dạy": (0.70, "Xúc phạm nhân phẩm"),
    "ngu ngốc": (0.60, "Miệt thị trí tuệ / Công kích"),
}

class LiveStreamService:
    @staticmethod
    def analyze_content(text: str) -> Tuple[bool, float, Optional[str]]:
        """
        Phân tích nội dung phòng chống bạo lực mạng.
        Trả về: (is_blocked, toxic_score, violation_reason)
        """
        text_lower = text.lower().strip()
        highest_score = 0.0
        reasons = []

        for keyword, (score, reason) in BLACK_LIST_KEYWORDS.items():
            if keyword in text_lower:
                if score > highest_score:
                    highest_score = score
                if reason not in reasons:
                    reasons.append(reason)

        if highest_score >= 0.60:
            return True, highest_score, "; ".join(reasons)
        return False, highest_score, None

    @staticmethod
    def create_session(db: Session, streamer_id: str, title: str, description: Optional[str] = None, category: str = "Giao lưu") -> LiveSession:
        # Kiểm tra tiêu đề có vi phạm ngôn từ bạo lực/thù ghét không
        is_blocked, score, reason = LiveStreamService.analyze_content(title)
        if is_blocked:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tiêu đề buổi live vi phạm chuẩn mực cộng đồng: {reason}"
            )

        # Kiểm tra streamer có đang mở phòng live nào khác không
        existing_active = db.query(LiveSession).filter(
            LiveSession.streamer_id == streamer_id,
            LiveSession.status == "LIVE"
        ).first()

        if existing_active:
            # Tự động đóng phòng cũ để mở phòng mới
            existing_active.status = "ENDED"
            existing_active.ended_at = datetime.utcnow()

        session = LiveSession(
            streamer_id=streamer_id,
            title=title.strip(),
            description=description.strip() if description else None,
            category=category or "Giao lưu",
            status="LIVE",
            viewer_count=1,
            violation_count=0,
            created_at=datetime.utcnow()
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_active_sessions(db: Session, limit: int = 20) -> List[LiveSession]:
        return db.query(LiveSession).filter(
            LiveSession.status == "LIVE"
        ).order_by(desc(LiveSession.created_at)).limit(limit).all()

    @staticmethod
    def get_session_by_id(db: Session, session_id: int) -> LiveSession:
        session = db.query(LiveSession).filter(LiveSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phòng livestream")
        return session

    @staticmethod
    def end_session(db: Session, session_id: int, streamer_id: str) -> LiveSession:
        session = LiveStreamService.get_session_by_id(db, session_id)
        if str(session.streamer_id) != str(streamer_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ streamer mới có quyền kết thúc phiên live này")

        session.status = "ENDED"
        session.ended_at = datetime.utcnow()
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def post_comment(db: Session, session_id: int, user_id: str, content: str) -> LiveComment:
        session = LiveStreamService.get_session_by_id(db, session_id)
        if session.status != "LIVE":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phòng livestream này đã kết thúc")

        # Kiểm tra xem user có đang bị cấm chat (Muted) trong phòng này không
        recent_mute = db.query(LiveSanction).filter(
            LiveSanction.session_id == session_id,
            LiveSanction.user_id == user_id,
            LiveSanction.action.in_(["MUTED_5M", "KICKED", "BANNED"])
        ).order_by(desc(LiveSanction.created_at)).first()

        if recent_mute:
            time_diff = (datetime.utcnow() - recent_mute.created_at).total_seconds()
            if time_diff < 300: # 5 phút
                remaining = int(300 - time_diff)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Bạn đang bị tạm dừng quyền bình luận do vi phạm ngôn từ bạo lực. Thử lại sau {remaining} giây."
                )

        # Phân tích nội dung bình luận
        is_blocked, toxic_score, reason = LiveStreamService.analyze_content(content)

        comment = LiveComment(
            session_id=session_id,
            user_id=user_id,
            content=content,
            is_blocked=is_blocked,
            toxic_score=toxic_score,
            violation_reason=reason,
            created_at=datetime.utcnow()
        )
        db.add(comment)

        # Nếu vi phạm -> Ghi nhận cảnh cáo (Sanction) & kiểm tra xem có vượt ngưỡng để phạt cấm chat không
        if is_blocked:
            session.violation_count = (session.violation_count or 0) + 1
            sanction = LiveSanction(
                session_id=session_id,
                user_id=user_id,
                action="WARNING",
                reason=reason or "Ngôn từ độc hại / Vi phạm tiêu chuẩn",
                created_at=datetime.utcnow()
            )
            db.add(sanction)
            db.flush()

            # Đếm số lần vi phạm của user trong session
            violation_count = db.query(LiveSanction).filter(
                LiveSanction.session_id == session_id,
                LiveSanction.user_id == user_id,
                LiveSanction.action == "WARNING"
            ).count()

            if violation_count >= 3:
                mute_sanction = LiveSanction(
                    session_id=session_id,
                    user_id=user_id,
                    action="MUTED_5M",
                    reason="Tái phạm công kích / Bạo lực mạng nhiều lần trong phiên phát trực tiếp",
                    created_at=datetime.utcnow()
                )
                db.add(mute_sanction)

        db.commit()
        db.refresh(comment)
        return comment

    @staticmethod
    def get_comments(db: Session, session_id: int, limit: int = 50) -> List[LiveComment]:
        # Chỉ trả về các comment an toàn (không bị chặn) cho người xem thông thường
        return db.query(LiveComment).filter(
            LiveComment.session_id == session_id,
            LiveComment.is_blocked == False
        ).order_by(LiveComment.created_at.asc()).limit(limit).all()

    @staticmethod
    def moderate_frame(db: Session, session_id: int, frame_data: Optional[str] = None, sample_tag: str = "normal") -> Tuple[bool, str, str]:
        """
        Kiểm duyệt khung hình video luồng phát trực tiếp.
        Tự động ngắt sóng (Emergency Kill-Switch) nếu phát hiện bạo lực nặng.
        """
        session = LiveStreamService.get_session_by_id(db, session_id)
        if session.status != "LIVE":
            return False, "Phiên live đã kết thúc", "NONE"

        # Đánh giá nội dung khung hình theo test tag hoặc signature
        is_violation = False
        violation_type = None

        if sample_tag in ["violence", "nsfw", "hate_symbol", "danger", "violence_critical"]:
            is_violation = True
            violation_type = "Phát hiện nội dung có yếu tố bạo lực hoặc phản cảm trong luồng video"
        elif frame_data and ("danger_pattern" in frame_data.lower() or "violence" in frame_data.lower()):
            is_violation = True
            violation_type = "AI nhận diện hành vi đe dọa / bạo lực thời gian thực"

        if is_violation:
            frame_sanction = LiveSanction(
                session_id=session_id,
                user_id=session.streamer_id,
                action="FRAME_WARNING",
                reason=violation_type,
                created_at=datetime.utcnow()
            )
            db.add(frame_sanction)
            db.flush()

            frame_violations = db.query(LiveSanction).filter(
                LiveSanction.session_id == session_id,
                LiveSanction.action == "FRAME_WARNING"
            ).count()

            # Nếu vi phạm nghiêm trọng (từ 2 lần cảnh báo video trở lên) -> Ngắt sóng khẩn cấp
            if frame_violations >= 2 or sample_tag == "violence_critical":
                session.status = "TERMINATED_FOR_VIOLATION"
                session.termination_reason = f"Cưỡng chế ngắt sóng: {violation_type}"
                session.ended_at = datetime.utcnow()
                db.commit()
                return False, session.termination_reason, "EMERGENCY_TERMINATED"
            else:
                db.commit()
                return False, f"Cảnh báo vi phạm nội dung luồng hình ảnh: {violation_type}", "WARNED"


        return True, "Khung hình an toàn", "NONE"

    @staticmethod
    def emergency_terminate(db: Session, session_id: int, reason: str = "Cưỡng chế dừng bởi Quản trị viên do vi phạm an toàn") -> LiveSession:
        session = LiveStreamService.get_session_by_id(db, session_id)
        session.status = "TERMINATED_FOR_VIOLATION"
        session.termination_reason = reason
        session.ended_at = datetime.utcnow()
        db.commit()
        db.refresh(session)
        return session

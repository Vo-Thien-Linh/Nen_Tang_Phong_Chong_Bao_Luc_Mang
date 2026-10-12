from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func
from fastapi import HTTPException, status

from ..models.user import User
from ..models.friendship import Friendship
from ..models.message import Conversation, Message
from ..schemas.message import (
    MessageItem,
    ConversationItem,
    ConversationPartner,
)

class MessageService:

    @staticmethod
    def get_or_create_conversation(user1_id: str, user2_id: str, db: Session) -> Conversation:
        if user1_id == user2_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể tạo cuộc trò chuyện với chính mình"
            )

        conv = db.query(Conversation).filter(
            or_(
                and_(Conversation.user1_id == user1_id, Conversation.user2_id == user2_id),
                and_(Conversation.user1_id == user2_id, Conversation.user2_id == user1_id)
            )
        ).first()

        if conv:
            return conv

        # Kiểm tra xem 2 người đã là bạn bè chưa
        is_friend = db.query(Friendship).filter(
            or_(
                and_(Friendship.requester_id == user1_id, Friendship.addressee_id == user2_id),
                and_(Friendship.requester_id == user2_id, Friendship.addressee_id == user1_id)
            ),
            Friendship.status == "accepted"
        ).first() is not None

        conv_status = "accepted" if is_friend else "pending"

        # Đảm bảo thứ tự u1, u2 nhất quán để khớp với index LEAST/GREATEST
        u1, u2 = (user1_id, user2_id) if str(user1_id) < str(user2_id) else (user2_id, user1_id)

        new_conv = Conversation(
            user1_id=u1,
            user2_id=u2,
            status=conv_status,
            initiated_by=user1_id,
            last_message_at=func.now(),
            created_at=func.now(),
            updated_at=func.now()
        )
        db.add(new_conv)
        db.commit()
        db.refresh(new_conv)
        return new_conv

    @staticmethod
    def get_conversations(current_user_id: str, tab: Optional[str], db: Session) -> List[ConversationItem]:
        query = db.query(Conversation).filter(
            or_(
                Conversation.user1_id == current_user_id,
                Conversation.user2_id == current_user_id
            )
        )

        if tab == "pending":
            query = query.filter(Conversation.status == "pending")
        elif tab == "accepted":
            query = query.filter(Conversation.status == "accepted")

        conversations = query.order_by(desc(Conversation.last_message_at)).all()

        result = []
        for c in conversations:
            partner_id = str(c.user2_id) if str(c.user1_id) == str(current_user_id) else str(c.user1_id)
            partner_user = db.query(User).filter(User.id == partner_id).first()
            if not partner_user:
                continue

            last_msg = db.query(Message).filter(
                Message.conversation_id == c.id
            ).order_by(desc(Message.created_at)).first()

            unread_count = db.query(Message).filter(
                Message.conversation_id == c.id,
                Message.receiver_id == current_user_id,
                Message.is_read == False
            ).count()

            is_friend = db.query(Friendship).filter(
                or_(
                    and_(Friendship.requester_id == current_user_id, Friendship.addressee_id == partner_id),
                    and_(Friendship.requester_id == partner_id, Friendship.addressee_id == current_user_id)
                ),
                Friendship.status == "accepted"
            ).first() is not None

            partner_info = ConversationPartner(
                id=str(partner_user.id),
                name=partner_user.full_name,
                username=partner_user.username,
                avatar=partner_user.avatar_url,
                bio=partner_user.bio,
                is_online=True,
                is_friend=is_friend
            )

            result.append(ConversationItem(
                id=c.id,
                user=partner_info,
                status=c.status,
                last_message=last_msg.content if last_msg else None,
                last_message_at=last_msg.created_at if last_msg else c.last_message_at,
                unread_count=unread_count,
                last_message_status=last_msg.status if last_msg else None,
                last_message_sender_id=str(last_msg.sender_id) if last_msg else None
            ))

        return result

    @staticmethod
    def get_messages(conversation_id: int, current_user_id: str, db: Session) -> List[MessageItem]:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cuộc trò chuyện")

        if str(conv.user1_id) != str(current_user_id) and str(conv.user2_id) != str(current_user_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xem cuộc trò chuyện này")

        # Đánh dấu các tin nhắn chưa xem gửi cho current_user thành 'read' (Đã xem)
        unread_msgs = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.receiver_id == current_user_id,
            Message.is_read == False
        ).all()

        if unread_msgs:
            for m in unread_msgs:
                m.is_read = True
                m.status = "read"
            db.commit()

        messages = db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).order_by(Message.created_at.asc()).all()

        return [
            MessageItem(
                id=m.id,
                conversation_id=m.conversation_id,
                sender_id=str(m.sender_id),
                receiver_id=str(m.receiver_id),
                content=m.content,
                status=m.status or "sent",
                is_read=m.is_read,
                created_at=m.created_at
            )
            for m in messages
        ]

    @staticmethod
    def send_message(sender_id: str, receiver_id: str, content: str, db: Session) -> MessageItem:
        if sender_id == receiver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể gửi tin nhắn cho chính mình"
            )

        if not content or not content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nội dung tin nhắn không được để trống"
            )

        receiver = db.query(User).filter(User.id == receiver_id).first()
        if not receiver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người nhận"
            )

        conv = MessageService.get_or_create_conversation(sender_id, receiver_id, db)

        new_msg = Message(
            conversation_id=conv.id,
            sender_id=sender_id,
            receiver_id=receiver_id,
            content=content.strip(),
            status="sent",  # Đã gửi lên máy chủ
            is_read=False,
            created_at=func.now()
        )
        db.add(new_msg)

        conv.last_message_at = func.now()
        db.commit()
        db.refresh(new_msg)

        return MessageItem(
            id=new_msg.id,
            conversation_id=new_msg.conversation_id,
            sender_id=str(new_msg.sender_id),
            receiver_id=str(new_msg.receiver_id),
            content=new_msg.content,
            status=new_msg.status,
            is_read=new_msg.is_read,
            created_at=new_msg.created_at
        )

    @staticmethod
    def mark_delivered(conversation_id: int, current_user_id: str, db: Session):
        """Khi thiết bị người nhận kết nối hoặc kéo dữ liệu, tin nhắn chuyển sang 'delivered' (Đã nhận)"""
        msgs = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.receiver_id == current_user_id,
            Message.status == "sent"
        ).all()
        for m in msgs:
            m.status = "delivered"
        db.commit()

    @staticmethod
    def mark_read(conversation_id: int, current_user_id: str, db: Session):
        """Khi người nhận bấm vào khung chat và đọc tin nhắn, chuyển sang 'read' (Đã xem)"""
        msgs = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.receiver_id == current_user_id,
            Message.status != "read"
        ).all()
        for m in msgs:
            m.status = "read"
            m.is_read = True
        db.commit()

    @staticmethod
    def accept_conversation(conversation_id: int, current_user_id: str, db: Session) -> bool:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cuộc trò chuyện")

        conv.status = "accepted"
        db.commit()
        return True

    @staticmethod
    def decline_conversation(conversation_id: int, current_user_id: str, db: Session) -> bool:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cuộc trò chuyện")

        db.delete(conv)
        db.commit()
        return True

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
            # Nếu 2 người đã là bạn bè và không bị chặn, đảm bảo trạng thái hội thoại là 'accepted'
            if conv.status != "blocked":
                is_friend = db.query(Friendship).filter(
                    or_(
                        and_(Friendship.requester_id == user1_id, Friendship.addressee_id == user2_id),
                        and_(Friendship.requester_id == user2_id, Friendship.addressee_id == user1_id)
                    ),
                    Friendship.status == "accepted"
                ).first() is not None
                if is_friend and conv.status != "accepted":
                    conv.status = "accepted"
                    db.commit()
                    db.refresh(conv)
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
        # Tự động đảm bảo tất cả bạn bè chính thức (accepted) đều có cuộc trò chuyện sẵn sàng
        try:
            accepted_friendships = db.query(Friendship).filter(
                or_(
                    Friendship.requester_id == current_user_id,
                    Friendship.addressee_id == current_user_id
                ),
                Friendship.status == "accepted"
            ).all()

            has_new_conv = False
            for f in accepted_friendships:
                partner_id = str(f.addressee_id) if str(f.requester_id) == str(current_user_id) else str(f.requester_id)
                u1, u2 = (current_user_id, partner_id) if str(current_user_id) < str(partner_id) else (partner_id, current_user_id)
                existing_conv = db.query(Conversation).filter(
                    or_(
                        and_(Conversation.user1_id == u1, Conversation.user2_id == u2),
                        and_(Conversation.user1_id == u2, Conversation.user2_id == u1)
                    )
                ).first()
                if not existing_conv:
                    new_conv = Conversation(
                        user1_id=u1,
                        user2_id=u2,
                        status="accepted",
                        initiated_by=current_user_id,
                        last_message_at=f.updated_at or func.now(),
                        created_at=f.created_at or func.now(),
                        updated_at=f.updated_at or func.now()
                    )
                    db.add(new_conv)
                    has_new_conv = True
                elif existing_conv.status != "accepted" and existing_conv.status != "blocked":
                    existing_conv.status = "accepted"
                    has_new_conv = True

            if has_new_conv:
                db.commit()
        except Exception as e:
            db.rollback()

        query = db.query(Conversation).filter(
            or_(
                Conversation.user1_id == current_user_id,
                Conversation.user2_id == current_user_id
            )
        )

        if tab == "pending":
            # Chỉ bên người nhận mới xuất hiện trong tin nhắn chờ
            query = query.filter(
                and_(Conversation.status == "pending", Conversation.initiated_by != current_user_id)
            )
        elif tab == "accepted":
            # Hộp thư chính gồm các hội thoại accepted HOẶC pending do chính mình gửi HOẶC bị blocked
            query = query.filter(
                or_(
                    Conversation.status == "accepted",
                    Conversation.status == "blocked",
                    and_(Conversation.status == "pending", Conversation.initiated_by == current_user_id)
                )
            )

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

            is_friend = db.query(Friendship).filter(
                or_(
                    and_(Friendship.requester_id == current_user_id, Friendship.addressee_id == partner_id),
                    and_(Friendship.requester_id == partner_id, Friendship.addressee_id == current_user_id)
                ),
                Friendship.status == "accepted"
            ).first() is not None

            # Nếu KHÔNG PHẢI BẠN BÈ và KHÔNG CÓ TIN NHẮN THỰC TẾ và KHÔNG BỊ CHẶN -> Bỏ qua
            if not is_friend and not last_msg and c.status != "blocked":
                continue

            unread_count = db.query(Message).filter(
                Message.conversation_id == c.id,
                Message.receiver_id == current_user_id,
                Message.is_read == False
            ).count()

            partner_info = ConversationPartner(
                id=str(partner_user.id),
                name=partner_user.full_name,
                username=partner_user.username,
                avatar=partner_user.avatar_url,
                bio=partner_user.bio,
                is_online=True,
                is_friend=is_friend
            )

            is_requester = (str(c.initiated_by) == str(current_user_id))

            last_msg_text = None
            if last_msg:
                if getattr(last_msg, "is_recalled", False):
                    last_msg_text = "Tin nhắn đã được thu hồi"
                elif getattr(last_msg, "media_url", None) and getattr(last_msg, "media_type", "") == "image":
                    last_msg_text = "[Hình ảnh] " + (last_msg.content or "")
                elif getattr(last_msg, "media_url", None) and getattr(last_msg, "media_type", "") == "file":
                    last_msg_text = "[Tệp tin] " + (last_msg.content or "")
                else:
                    last_msg_text = last_msg.content
            elif is_friend:
                last_msg_text = "Bắt đầu cuộc trò chuyện"

            result.append(ConversationItem(
                id=c.id,
                user=partner_info,
                status=c.status,
                initiated_by=str(c.initiated_by) if c.initiated_by else None,
                blocked_by=str(c.blocked_by) if getattr(c, "blocked_by", None) else None,
                is_requester=is_requester,
                last_message=last_msg_text,
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
                media_url=getattr(m, "media_url", None),
                media_type=getattr(m, "media_type", "text") or "text",
                status=m.status or "sent",
                is_read=m.is_read,
                is_recalled=bool(getattr(m, "is_recalled", False)),
                created_at=m.created_at
            )
            for m in messages
        ]

    @staticmethod
    def send_message(sender_id: str, receiver_id: str, content: Optional[str] = "", db: Session = None, media_url: Optional[str] = None, media_type: Optional[str] = "text") -> MessageItem:
        if sender_id == receiver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể gửi tin nhắn cho chính mình"
            )

        has_text = content and content.strip()
        if not has_text and not media_url:
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

        if conv.status == "blocked":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cuộc trò chuyện này đang bị chặn"
            )

        default_media_caption = "Đã gửi một tệp đính kèm" if media_type == "file" else ("Đã gửi một hình ảnh" if media_type == "image" else "")
        final_content = content.strip() if has_text else default_media_caption

        new_msg = Message(
            conversation_id=conv.id,
            sender_id=sender_id,
            receiver_id=receiver_id,
            content=final_content,
            media_url=media_url,
            media_type=media_type or "text",
            status="sent",
            is_read=False,
            is_recalled=False,
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
            media_url=new_msg.media_url,
            media_type=new_msg.media_type or "text",
            status=new_msg.status,
            is_read=new_msg.is_read,
            is_recalled=bool(new_msg.is_recalled),
            created_at=new_msg.created_at
        )

    @staticmethod
    def recall_message(message_id: int, current_user_id: str, db: Session) -> MessageItem:
        """Thu hồi tin nhắn đã gửi (chỉ người gửi mới có quyền thu hồi)"""
        msg = db.query(Message).filter(Message.id == message_id).first()
        if not msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tin nhắn"
            )

        if str(msg.sender_id) != str(current_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn chỉ có thể thu hồi tin nhắn do chính mình gửi"
            )

        msg.is_recalled = True
        msg.content = "Tin nhắn đã được thu hồi"
        msg.status = "recalled"
        msg.media_url = None
        db.commit()
        db.refresh(msg)

        return MessageItem(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_id=str(msg.sender_id),
            receiver_id=str(msg.receiver_id),
            content=msg.content,
            media_url=None,
            media_type=getattr(msg, "media_type", "text") or "text",
            status=msg.status,
            is_read=msg.is_read,
            is_recalled=True,
            created_at=msg.created_at
        )

    @staticmethod
    def block_conversation(conversation_id: int, current_user_id: str, db: Session) -> ConversationItem:
        """Chặn người dùng trong cuộc trò chuyện"""
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cuộc trò chuyện")

        if str(conv.user1_id) != str(current_user_id) and str(conv.user2_id) != str(current_user_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền thao tác trên cuộc trò chuyện này")

        conv.status = "blocked"
        conv.blocked_by = current_user_id
        db.commit()
        db.refresh(conv)
        return conv

    @staticmethod
    def unblock_conversation(conversation_id: int, current_user_id: str, db: Session) -> ConversationItem:
        """Bỏ chặn người dùng trong cuộc trò chuyện"""
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cuộc trò chuyện")

        if str(conv.user1_id) != str(current_user_id) and str(conv.user2_id) != str(current_user_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền thao tác trên cuộc trò chuyện này")

        if conv.blocked_by and str(conv.blocked_by) != str(current_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ người thực hiện chặn mới có quyền bỏ chặn"
            )

        conv.status = "accepted"
        conv.blocked_by = None
        db.commit()
        db.refresh(conv)
        return conv

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

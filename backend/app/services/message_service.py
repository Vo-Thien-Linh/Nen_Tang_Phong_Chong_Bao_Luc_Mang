from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func
from fastapi import HTTPException, status

from ..models.user import User
from ..models.friendship import Friendship
from ..models.message import Conversation, Message, ConversationMember
from ..schemas.message import (
    MessageItem,
    ConversationItem,
    ConversationPartner,
    CreateGroupRequest,
    UpdateGroupRequest,
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
    def create_group(creator_id: str, payload: CreateGroupRequest, db: Session) -> ConversationItem:
        group_name = (payload.name or "").strip()
        if not group_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tên nhóm không được để trống"
            )

        # Lọc danh sách thành viên hợp lệ (loại bỏ trùng lặp và người tạo)
        valid_member_ids = list({str(m_id) for m_id in payload.member_ids if str(m_id) != str(creator_id)})
        if len(valid_member_ids) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nhóm trò chuyện cần tối thiểu 3 thành viên (bao gồm cả bạn)"
            )

        members = db.query(User).filter(User.id.in_(valid_member_ids)).all()
        if len(members) != len(valid_member_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Một số người dùng được chọn không tồn tại"
            )

        creator = db.query(User).filter(User.id == creator_id).first()
        if not creator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người tạo nhóm"
            )

        new_group = Conversation(
            user1_id=None,
            user2_id=None,
            status="accepted",
            type="group",
            name=group_name,
            avatar_url=payload.avatar_url,
            initiated_by=creator_id,
            last_message_at=func.now(),
            created_at=func.now(),
            updated_at=func.now()
        )
        db.add(new_group)
        db.commit()
        db.refresh(new_group)

        admin_member = ConversationMember(
            conversation_id=new_group.id,
            user_id=creator_id,
            role="admin",
            joined_at=func.now()
        )
        db.add(admin_member)

        for m_id in valid_member_ids:
            member_entry = ConversationMember(
                conversation_id=new_group.id,
                user_id=m_id,
                role="member",
                joined_at=func.now()
            )
            db.add(member_entry)

        initial_msg = Message(
            conversation_id=new_group.id,
            sender_id=creator_id,
            receiver_id=None,
            content=f"{creator.full_name} đã tạo nhóm \"{group_name}\"",
            media_type="system",
            status="sent",
            is_read=True,
            created_at=func.now()
        )
        db.add(initial_msg)
        db.commit()

        all_users = [creator] + members
        member_partners = [
            ConversationPartner(
                id=str(u.id),
                name=u.full_name,
                username=u.username,
                avatar=u.avatar_url,
                bio=u.bio,
                is_online=True,
                is_friend=True
            )
            for u in all_users
        ]

        return ConversationItem(
            id=new_group.id,
            type="group",
            name=new_group.name,
            avatar=new_group.avatar_url,
            member_count=len(all_users),
            members=member_partners,
            status="accepted",
            initiated_by=str(creator_id),
            is_requester=True,
            last_message=initial_msg.content,
            last_message_at=new_group.last_message_at,
            unread_count=0,
            last_message_status="sent",
            last_message_sender_id=str(creator_id)
        )

    @staticmethod
    def update_group(conversation_id: int, user_id: str, payload: UpdateGroupRequest, db: Session) -> dict:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv or getattr(conv, "type", "direct") != "group":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy nhóm trò chuyện"
            )

        is_member = db.query(ConversationMember).filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id
        ).first() is not None
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không phải thành viên của nhóm này"
            )

        updater = db.query(User).filter(User.id == user_id).first()
        if not updater:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy thông tin người dùng"
            )

        system_messages = []

        if payload.name is not None:
            new_name = payload.name.strip()
            if not new_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tên nhóm không được để trống"
                )
            if new_name != conv.name:
                conv.name = new_name
                sys_msg_name = Message(
                    conversation_id=conv.id,
                    sender_id=user_id,
                    receiver_id=None,
                    content=f"{updater.full_name} đã đổi tên nhóm thành \"{new_name}\"",
                    media_type="system",
                    status="sent",
                    is_read=True,
                    created_at=func.now()
                )
                db.add(sys_msg_name)
                system_messages.append(sys_msg_name)

        if payload.avatar_url is not None:
            if payload.avatar_url != conv.avatar_url:
                conv.avatar_url = payload.avatar_url
                sys_msg_avatar = Message(
                    conversation_id=conv.id,
                    sender_id=user_id,
                    receiver_id=None,
                    content=f"{updater.full_name} đã thay đổi ảnh đại diện của nhóm",
                    media_type="system",
                    status="sent",
                    is_read=True,
                    created_at=func.now()
                )
                db.add(sys_msg_avatar)
                system_messages.append(sys_msg_avatar)

        if system_messages:
            conv.last_message_at = func.now()
            conv.updated_at = func.now()
            db.commit()
            db.refresh(conv)
            for sm in system_messages:
                db.refresh(sm)

        members_query = db.query(ConversationMember, User).join(
            User, User.id == ConversationMember.user_id
        ).filter(ConversationMember.conversation_id == conv.id).all()

        group_members = [
            ConversationPartner(
                id=str(u.id),
                name=u.full_name,
                username=u.username,
                avatar=u.avatar_url,
                bio=u.bio,
                is_online=True,
                is_friend=True
            )
            for _, u in members_query
        ]

        last_msg = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(desc(Message.created_at)).first()

        updated_conv = ConversationItem(
            id=conv.id,
            type="group",
            name=conv.name or "Nhóm trò chuyện",
            avatar=conv.avatar_url,
            member_count=len(group_members),
            members=group_members,
            status=conv.status,
            initiated_by=str(conv.initiated_by) if conv.initiated_by else None,
            blocked_by=None,
            is_requester=str(conv.initiated_by) == str(user_id),
            last_message=last_msg.content if last_msg else None,
            last_message_at=last_msg.created_at if last_msg else conv.last_message_at,
            unread_count=0,
            last_message_status=last_msg.status if last_msg else None,
            last_message_sender_id=str(last_msg.sender_id) if last_msg else None
        )

        formatted_sys_msgs = [
            MessageItem(
                id=sm.id,
                conversation_id=sm.conversation_id,
                sender_id=str(sm.sender_id),
                receiver_id=None,
                content=sm.content,
                media_url=None,
                media_type="system",
                status=sm.status,
                is_read=sm.is_read,
                is_recalled=False,
                created_at=sm.created_at,
                sender_name=updater.full_name,
                sender_avatar=updater.avatar_url
            )
            for sm in system_messages
        ]

        return {
            "conversation": updated_conv,
            "system_messages": formatted_sys_msgs
        }

    @staticmethod
    def get_conversation_recipient_ids(conversation_id: int, sender_id: str, db: Session) -> List[str]:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv:
            return []
        if getattr(conv, "type", "direct") == "group":
            members = db.query(ConversationMember.user_id).filter(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id != sender_id
            ).all()
            return [str(m[0]) for m in members]
        else:
            partner_id = str(conv.user2_id) if str(conv.user1_id) == str(sender_id) else str(conv.user1_id)
            return [partner_id]

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

        # Lấy danh sách ID các nhóm mà current_user là thành viên
        group_member_rows = db.query(ConversationMember.conversation_id).filter(
            ConversationMember.user_id == current_user_id
        ).all()
        group_conv_ids = [r[0] for r in group_member_rows]

        query = db.query(Conversation).filter(
            or_(
                and_(
                    or_(Conversation.user1_id == current_user_id, Conversation.user2_id == current_user_id),
                    or_(Conversation.type == "direct", Conversation.type == None)
                ),
                and_(
                    Conversation.id.in_(group_conv_ids),
                    Conversation.type == "group"
                )
            )
        )

        if tab == "pending":
            # Chỉ bên người nhận mới xuất hiện trong tin nhắn chờ (chỉ áp dụng 1-1)
            query = query.filter(
                and_(Conversation.status == "pending", Conversation.initiated_by != current_user_id, Conversation.type != "group")
            )
        elif tab == "accepted":
            # Hộp thư chính gồm các hội thoại accepted HOẶC pending do chính mình gửi HOẶC bị blocked HOẶC nhóm
            query = query.filter(
                or_(
                    Conversation.type == "group",
                    Conversation.status == "accepted",
                    Conversation.status == "blocked",
                    and_(Conversation.status == "pending", Conversation.initiated_by == current_user_id)
                )
            )

        conversations = query.order_by(desc(Conversation.last_message_at)).all()

        result = []
        for c in conversations:
            if getattr(c, "type", "direct") == "group":
                members_query = db.query(ConversationMember, User).join(
                    User, User.id == ConversationMember.user_id
                ).filter(ConversationMember.conversation_id == c.id).all()

                group_members = [
                    ConversationPartner(
                        id=str(u.id),
                        name=u.full_name,
                        username=u.username,
                        avatar=u.avatar_url,
                        bio=u.bio,
                        is_online=True,
                        is_friend=True
                    )
                    for _, u in members_query
                ]

                last_msg = db.query(Message).filter(
                    Message.conversation_id == c.id
                ).order_by(desc(Message.created_at)).first()

                unread_count = db.query(Message).filter(
                    Message.conversation_id == c.id,
                    Message.sender_id != current_user_id,
                    Message.is_read == False
                ).count()

                last_msg_text = None
                if last_msg:
                    if getattr(last_msg, "is_recalled", False):
                        last_msg_text = "Tin nhắn đã được thu hồi"
                    elif getattr(last_msg, "media_type", "") == "system":
                        last_msg_text = last_msg.content
                    elif getattr(last_msg, "media_url", None) and getattr(last_msg, "media_type", "") == "image":
                        last_msg_text = "[Hình ảnh] " + (last_msg.content or "")
                    elif getattr(last_msg, "media_url", None) and getattr(last_msg, "media_type", "") == "file":
                        last_msg_text = "[Tệp tin] " + (last_msg.content or "")
                    elif getattr(last_msg, "media_type", "") == "call_log":
                        last_msg_text = "[Cuộc gọi] " + (last_msg.content or "")
                    else:
                        sender_user = next((u for _, u in members_query if str(u.id) == str(last_msg.sender_id)), None)
                        prefix = "Bạn: " if str(last_msg.sender_id) == str(current_user_id) else (f"{sender_user.full_name.split()[-1]}: " if sender_user else "")
                        last_msg_text = prefix + (last_msg.content or "")

                result.append(ConversationItem(
                    id=c.id,
                    type="group",
                    name=c.name or "Nhóm trò chuyện",
                    avatar=c.avatar_url,
                    member_count=len(group_members),
                    members=group_members,
                    status=c.status,
                    initiated_by=str(c.initiated_by) if c.initiated_by else None,
                    blocked_by=None,
                    is_requester=str(c.initiated_by) == str(current_user_id),
                    last_message=last_msg_text,
                    last_message_at=last_msg.created_at if last_msg else c.last_message_at,
                    unread_count=unread_count,
                    last_message_status=last_msg.status if last_msg else None,
                    last_message_sender_id=str(last_msg.sender_id) if last_msg else None
                ))
                continue

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
                elif getattr(last_msg, "media_type", "") == "call_log":
                    last_msg_text = "[Cuộc gọi] " + (last_msg.content or "")
                else:
                    last_msg_text = last_msg.content
            elif is_friend:
                last_msg_text = "Bắt đầu cuộc trò chuyện"

            result.append(ConversationItem(
                id=c.id,
                user=partner_info,
                type="direct",
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

        is_group = getattr(conv, "type", "direct") == "group"
        if is_group:
            is_member = db.query(ConversationMember).filter(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == current_user_id
            ).first() is not None
            if not is_member:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xem cuộc trò chuyện này")
        else:
            if str(conv.user1_id) != str(current_user_id) and str(conv.user2_id) != str(current_user_id):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xem cuộc trò chuyện này")

        # Đánh dấu các tin nhắn chưa xem thành 'read' (Đã xem)
        if is_group:
            unread_msgs = db.query(Message).filter(
                Message.conversation_id == conversation_id,
                Message.sender_id != current_user_id,
                Message.is_read == False
            ).all()
        else:
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

        # Cache thông tin sender để gắn avatar & tên (hỗ trợ nhóm)
        sender_ids = list({str(m.sender_id) for m in messages})
        users = db.query(User).filter(User.id.in_(sender_ids)).all() if sender_ids else []
        users_map = {str(u.id): u for u in users}

        return [
            MessageItem(
                id=m.id,
                conversation_id=m.conversation_id,
                sender_id=str(m.sender_id),
                receiver_id=str(m.receiver_id) if m.receiver_id else None,
                content=m.content,
                media_url=getattr(m, "media_url", None),
                media_type=getattr(m, "media_type", "text") or "text",
                status=m.status or "sent",
                is_read=m.is_read,
                is_recalled=bool(getattr(m, "is_recalled", False)),
                created_at=m.created_at,
                sender_name=users_map[str(m.sender_id)].full_name if str(m.sender_id) in users_map else None,
                sender_avatar=users_map[str(m.sender_id)].avatar_url if str(m.sender_id) in users_map else None,
            )
            for m in messages
        ]

    @staticmethod
    def send_message(
        sender_id: str,
        receiver_id: Optional[str] = None,
        content: Optional[str] = "",
        db: Session = None,
        media_url: Optional[str] = None,
        media_type: Optional[str] = "text",
        conversation_id: Optional[int] = None
    ) -> MessageItem:
        has_text = content and content.strip()
        if not has_text and not media_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nội dung tin nhắn không được để trống"
            )

        # 1. Trường hợp gửi theo conversation_id (đặc biệt là nhóm)
        if conversation_id:
            conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
            if not conv:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cuộc trò chuyện")

            if getattr(conv, "type", "direct") == "group":
                is_member = db.query(ConversationMember).filter(
                    ConversationMember.conversation_id == conv.id,
                    ConversationMember.user_id == sender_id
                ).first() is not None
                if not is_member:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không phải thành viên của nhóm này")

                default_media_caption = "Đã gửi một tệp đính kèm" if media_type == "file" else ("Đã gửi một hình ảnh" if media_type == "image" else "")
                final_content = content.strip() if has_text else default_media_caption

                new_msg = Message(
                    conversation_id=conv.id,
                    sender_id=sender_id,
                    receiver_id=None,
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

                sender_user = db.query(User).filter(User.id == sender_id).first()
                return MessageItem(
                    id=new_msg.id,
                    conversation_id=new_msg.conversation_id,
                    sender_id=str(new_msg.sender_id),
                    receiver_id=str(new_msg.receiver_id) if new_msg.receiver_id else None,
                    content=new_msg.content,
                    media_url=new_msg.media_url,
                    media_type=new_msg.media_type or "text",
                    status=new_msg.status,
                    is_read=new_msg.is_read,
                    is_recalled=bool(new_msg.is_recalled),
                    created_at=new_msg.created_at,
                    sender_name=sender_user.full_name if sender_user else None,
                    sender_avatar=sender_user.avatar_url if sender_user else None
                )

        # 2. Trường hợp gửi 1-1 (truyền thống)
        if not receiver_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Yêu cầu receiver_id hoặc conversation_id")

        if sender_id == receiver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể gửi tin nhắn cho chính mình"
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

        sender_user = db.query(User).filter(User.id == sender_id).first()
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
            created_at=new_msg.created_at,
            sender_name=sender_user.full_name if sender_user else None,
            sender_avatar=sender_user.avatar_url if sender_user else None
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

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from app.database import Base
from app.models.user import User
from app.models.message import Conversation, Message, ConversationMember
from app.services.message_service import MessageService
from app.schemas.message import CreateGroupRequest

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        u1 = User(
            id="11111111-1111-1111-1111-111111111111",
            username="alice",
            email="alice@example.com",
            full_name="Alice Nguyen",
            password_hash="hash"
        )
        u2 = User(
            id="22222222-2222-2222-2222-222222222222",
            username="bob",
            email="bob@example.com",
            full_name="Bob Tran",
            password_hash="hash"
        )
        u3 = User(
            id="33333333-3333-3333-3333-333333333333",
            username="charlie",
            email="charlie@example.com",
            full_name="Charlie Le",
            password_hash="hash"
        )
        u4 = User(
            id="44444444-4444-4444-4444-444444444444",
            username="david",
            email="david@example.com",
            full_name="David Pham",
            password_hash="hash"
        )
        db.add_all([u1, u2, u3, u4])
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_create_group_success(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"
    u3_id = "33333333-3333-3333-3333-333333333333"

    req = CreateGroupRequest(
        name="Nhóm Đồ Án",
        member_ids=[u2_id, u3_id],
        avatar_url="https://example.com/group-avatar.png"
    )

    group = MessageService.create_group(u1_id, req, db_session)
    assert group.id is not None
    assert group.type == "group"
    assert group.name == "Nhóm Đồ Án"
    assert group.member_count == 3
    assert len(group.members) == 3

    # Check members in database
    members = db_session.query(ConversationMember).filter(
        ConversationMember.conversation_id == group.id
    ).all()
    assert len(members) == 3
    admin = next(m for m in members if m.user_id == u1_id)
    assert admin.role == "admin"

    # Check system message
    sys_msg = db_session.query(Message).filter(
        Message.conversation_id == group.id,
        Message.media_type == "system"
    ).first()
    assert sys_msg is not None
    assert "Alice Nguyen đã tạo nhóm" in sys_msg.content

def test_create_group_requires_min_3_members(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"

    req = CreateGroupRequest(
        name="Nhóm 2 người",
        member_ids=[u2_id]
    )

    with pytest.raises(HTTPException) as exc_info:
        MessageService.create_group(u1_id, req, db_session)
    assert exc_info.value.status_code == 400
    assert "tối thiểu 3 thành viên" in exc_info.value.detail

def test_create_group_empty_name(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"
    u3_id = "33333333-3333-3333-3333-333333333333"

    req = CreateGroupRequest(
        name="   ",
        member_ids=[u2_id, u3_id]
    )

    with pytest.raises(HTTPException) as exc_info:
        MessageService.create_group(u1_id, req, db_session)
    assert exc_info.value.status_code == 400
    assert "Tên nhóm không được để trống" in exc_info.value.detail

def test_create_group_nonexistent_user(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"
    non_existent = "99999999-9999-9999-9999-999999999999"

    req = CreateGroupRequest(
        name="Nhóm Thử Nghiệm",
        member_ids=[u2_id, non_existent]
    )

    with pytest.raises(HTTPException) as exc_info:
        MessageService.create_group(u1_id, req, db_session)
    assert exc_info.value.status_code == 400
    assert "không tồn tại" in exc_info.value.detail

def test_send_and_get_group_messages(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"
    u3_id = "33333333-3333-3333-3333-333333333333"
    u4_id = "44444444-4444-4444-4444-444444444444"

    group = MessageService.create_group(
        u1_id,
        CreateGroupRequest(name="Nhóm Nghiên Cứu", member_ids=[u2_id, u3_id]),
        db_session
    )

    # Bob sends a message into the group
    msg = MessageService.send_message(
        sender_id=u2_id,
        conversation_id=group.id,
        content="Chào cả nhóm!",
        db=db_session
    )
    assert msg.id is not None
    assert msg.conversation_id == group.id
    assert msg.sender_name == "Bob Tran"

    # Charlie reads messages
    messages = MessageService.get_messages(group.id, u3_id, db_session)
    assert len(messages) >= 2  # System creation message + Bob's message
    last_msg = messages[-1]
    assert last_msg.content == "Chào cả nhóm!"
    assert last_msg.sender_name == "Bob Tran"

    # Non-member (David) attempts to send message -> 403
    with pytest.raises(HTTPException) as exc_info:
        MessageService.send_message(
            sender_id=u4_id,
            conversation_id=group.id,
            content="Tôi vào nhóm với!",
            db=db_session
        )
    assert exc_info.value.status_code == 403
    assert "không phải thành viên" in exc_info.value.detail

    # Non-member (David) attempts to read messages -> 403
    with pytest.raises(HTTPException) as exc_info2:
        MessageService.get_messages(group.id, u4_id, db_session)
    assert exc_info2.value.status_code == 403

def test_get_group_recipient_ids(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"
    u3_id = "33333333-3333-3333-3333-333333333333"

    group = MessageService.create_group(
        u1_id,
        CreateGroupRequest(name="Nhóm 3 người", member_ids=[u2_id, u3_id]),
        db_session
    )

    # Recipients for Alice should be Bob and Charlie
    recipients = MessageService.get_conversation_recipient_ids(group.id, u1_id, db_session)
    assert sorted(recipients) == sorted([u2_id, u3_id])

    # Recipients for Bob should be Alice and Charlie
    recipients_bob = MessageService.get_conversation_recipient_ids(group.id, u2_id, db_session)
    assert sorted(recipients_bob) == sorted([u1_id, u3_id])

def test_group_conversations_listing(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"
    u3_id = "33333333-3333-3333-3333-333333333333"
    u4_id = "44444444-4444-4444-4444-444444444444"

    group = MessageService.create_group(
        u1_id,
        CreateGroupRequest(name="Nhóm Đồ Án Chuyên Ngành", member_ids=[u2_id, u3_id]),
        db_session
    )

    # Bob lists conversations in accepted tab
    bob_convs = MessageService.get_conversations(u2_id, "accepted", db_session)
    matching = [c for c in bob_convs if c.id == group.id]
    assert len(matching) == 1
    assert matching[0].type == "group"
    assert matching[0].name == "Nhóm Đồ Án Chuyên Ngành"
    assert matching[0].member_count == 3

    # David is not in the group, so his list should not contain this group
    david_convs = MessageService.get_conversations(u4_id, "accepted", db_session)
    assert not any(c.id == group.id for c in david_convs)


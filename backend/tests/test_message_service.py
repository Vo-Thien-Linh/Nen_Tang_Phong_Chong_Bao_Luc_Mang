import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from app.database import Base
from app.models.user import User
from app.models.message import Conversation, Message
from app.services.message_service import MessageService

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
        db.add_all([u1, u2])
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_send_and_recall_message_success(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"

    # 1. Send message
    msg = MessageService.send_message(
        sender_id=u1_id,
        receiver_id=u2_id,
        content="Xin chao Bob!",
        db=db_session
    )
    assert msg.id is not None
    assert msg.content == "Xin chao Bob!"
    assert msg.is_recalled is False

    # 2. Recall own message
    recalled = MessageService.recall_message(
        message_id=msg.id,
        current_user_id=u1_id,
        db=db_session
    )
    assert recalled.id == msg.id
    assert recalled.is_recalled is True
    assert recalled.status == "recalled"
    assert recalled.content == "Tin nhắn đã được thu hồi"

def test_recall_message_forbidden_for_other_user(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"

    msg = MessageService.send_message(
        sender_id=u1_id,
        receiver_id=u2_id,
        content="Bi mat",
        db=db_session
    )

    # Bob tries to recall Alice's message -> should raise 403
    with pytest.raises(HTTPException) as exc_info:
        MessageService.recall_message(
            message_id=msg.id,
            current_user_id=u2_id,
            db=db_session
        )
    assert exc_info.value.status_code == 403
    assert "chính mình" in exc_info.value.detail

def test_recall_nonexistent_message(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    with pytest.raises(HTTPException) as exc_info:
        MessageService.recall_message(
            message_id=99999,
            current_user_id=u1_id,
            db=db_session
        )
    assert exc_info.value.status_code == 404

def test_block_and_unblock_conversation(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"

    # Initialize conversation
    conv = MessageService.get_or_create_conversation(u1_id, u2_id, db_session)
    assert conv.status in ["accepted", "pending"]

    # Block conversation
    MessageService.block_conversation(conv.id, u1_id, db_session)
    db_session.refresh(conv)
    assert conv.status == "blocked"
    assert str(conv.blocked_by) == u1_id

    # Sending message while blocked is forbidden
    with pytest.raises(HTTPException) as exc_info:
        MessageService.send_message(
            sender_id=u1_id,
            receiver_id=u2_id,
            content="Hello when blocked",
            db=db_session
        )
    assert exc_info.value.status_code == 403

    # Unblock conversation
    MessageService.unblock_conversation(conv.id, u1_id, db_session)
    db_session.refresh(conv)
    assert conv.status == "accepted"
    assert conv.blocked_by is None

    # Now sending succeeds
    msg = MessageService.send_message(
        sender_id=u1_id,
        receiver_id=u2_id,
        content="Hello after unblock",
        db=db_session
    )
    assert msg.content == "Hello after unblock"

def test_send_image_message(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"

    msg = MessageService.send_message(
        sender_id=u1_id,
        receiver_id=u2_id,
        content="Xem anh nay nhe",
        db=db_session,
        media_url="https://images.unsplash.com/photo-example.jpg",
        media_type="image"
    )
    assert msg.media_url == "https://images.unsplash.com/photo-example.jpg"
    assert msg.media_type == "image"
    assert msg.content == "Xem anh nay nhe"

def test_send_file_message(db_session):
    u1_id = "11111111-1111-1111-1111-111111111111"
    u2_id = "22222222-2222-2222-2222-222222222222"

    msg = MessageService.send_message(
        sender_id=u1_id,
        receiver_id=u2_id,
        content="Bao_cao_WINGS.pdf",
        db=db_session,
        media_url="data:application/pdf;base64,JVBERi0xLjQK...",
        media_type="file"
    )
    assert msg.media_url.startswith("data:application/pdf")
    assert msg.media_type == "file"
    assert msg.content == "Bao_cao_WINGS.pdf"

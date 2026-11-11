import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from app.database import Base
from app.models.user import User
from app.models.friendship import Friendship
from app.models.user_settings import UserSettings
from app.services.friend_service import FriendService

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Alice (Requester)
        alice = User(
            id="11111111-1111-1111-1111-111111111111",
            username="alice",
            email="alice@example.com",
            full_name="Alice Nguyen",
            password_hash="hash"
        )
        # Bob (Target)
        bob = User(
            id="22222222-2222-2222-2222-222222222222",
            username="bob",
            email="bob@example.com",
            full_name="Bob Tran",
            password_hash="hash"
        )
        # Charlie (Mutual friend)
        charlie = User(
            id="33333333-3333-3333-3333-333333333333",
            username="charlie",
            email="charlie@example.com",
            full_name="Charlie Le",
            password_hash="hash"
        )
        db.add_all([alice, bob, charlie])
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_send_friend_request_everyone_allowed(db_session):
    alice_id = "11111111-1111-1111-1111-111111111111"
    bob_id = "22222222-2222-2222-2222-222222222222"

    # Bob sets privacy to 'everyone'
    bob_settings = UserSettings(user_id=bob_id, who_can_send_friend_requests="everyone")
    db_session.add(bob_settings)
    db_session.commit()

    resp = FriendService.send_request(alice_id, bob_id, db_session)
    assert resp.success is True
    assert resp.data["status"] == "pending"

def test_send_friend_request_friends_of_friends_rejected_no_mutual(db_session):
    alice_id = "11111111-1111-1111-1111-111111111111"
    bob_id = "22222222-2222-2222-2222-222222222222"

    # Bob sets privacy to 'friends_of_friends'
    bob_settings = UserSettings(user_id=bob_id, who_can_send_friend_requests="friends_of_friends")
    db_session.add(bob_settings)
    db_session.commit()

    # Alice and Bob have no mutual friends -> should be blocked with 400
    with pytest.raises(HTTPException) as exc_info:
        FriendService.send_request(alice_id, bob_id, db_session)

    assert exc_info.value.status_code == 400
    assert "chỉ nhận lời mời kết bạn từ bạn của bạn bè" in exc_info.value.detail

def test_send_friend_request_friends_of_friends_allowed_with_mutual(db_session):
    alice_id = "11111111-1111-1111-1111-111111111111"
    bob_id = "22222222-2222-2222-2222-222222222222"
    charlie_id = "33333333-3333-3333-3333-333333333333"

    # Bob sets privacy to 'friends_of_friends'
    bob_settings = UserSettings(user_id=bob_id, who_can_send_friend_requests="friends_of_friends")
    db_session.add(bob_settings)

    # Charlie is friends with both Alice and Bob (mutual friend)
    f1 = Friendship(requester_id=alice_id, addressee_id=charlie_id, status="accepted")
    f2 = Friendship(requester_id=bob_id, addressee_id=charlie_id, status="accepted")
    db_session.add_all([f1, f2])
    db_session.commit()

    # Now Alice sends request to Bob -> allowed!
    resp = FriendService.send_request(alice_id, bob_id, db_session)
    assert resp.success is True
    assert resp.data["status"] == "pending"


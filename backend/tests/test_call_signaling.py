import pytest
import json
from unittest.mock import AsyncMock, MagicMock
from app.routes.message import ConnectionManager, websocket_endpoint
from fastapi import WebSocketDisconnect

@pytest.mark.anyio
async def test_connection_manager_connect_and_disconnect():
    manager = ConnectionManager()
    user_id = "user-123"
    mock_ws = AsyncMock()

    await manager.connect(user_id, mock_ws)
    assert manager.is_user_online(user_id) is True
    assert mock_ws in manager.active_connections[user_id]

    manager.disconnect(user_id, mock_ws)
    assert manager.is_user_online(user_id) is False
    assert user_id not in manager.active_connections

@pytest.mark.anyio
async def test_call_signaling_forward_to_online_receiver():
    manager = ConnectionManager()
    caller_id = "caller-001"
    receiver_id = "receiver-002"

    caller_ws = AsyncMock()
    receiver_ws = AsyncMock()

    await manager.connect(caller_id, caller_ws)
    await manager.connect(receiver_id, receiver_ws)

    # Caller sends CALL_REQUEST
    call_request = {
        "type": "CALL_REQUEST",
        "caller_id": caller_id,
        "receiver_id": receiver_id,
        "call_type": "video",
        "caller_name": "Nguyen Van A"
    }

    # Simulate message forward via manager.send_to_user
    delivered = await manager.send_to_user(receiver_id, call_request)
    assert delivered is True
    receiver_ws.send_json.assert_called_once_with(call_request)

@pytest.mark.anyio
async def test_call_signaling_webrtc_offer_and_answer():
    manager = ConnectionManager()
    caller_id = "caller-001"
    receiver_id = "receiver-002"

    caller_ws = AsyncMock()
    receiver_ws = AsyncMock()

    await manager.connect(caller_id, caller_ws)
    await manager.connect(receiver_id, receiver_ws)

    # 1. Caller sends WebRTC offer
    offer_msg = {
        "type": "WEBRTC_SIGNAL",
        "caller_id": caller_id,
        "receiver_id": receiver_id,
        "signal_type": "offer",
        "sdp": "v=0\r\no=alice 2890844526..."
    }
    await manager.send_to_user(receiver_id, offer_msg)
    receiver_ws.send_json.assert_called_with(offer_msg)

    # 2. Receiver answers WebRTC answer
    answer_msg = {
        "type": "WEBRTC_SIGNAL",
        "caller_id": caller_id,
        "receiver_id": caller_id,
        "signal_type": "answer",
        "sdp": "v=0\r\no=bob 2890844527..."
    }
    await manager.send_to_user(caller_id, answer_msg)
    caller_ws.send_json.assert_called_with(answer_msg)

@pytest.mark.anyio
async def test_call_signaling_call_ended():
    manager = ConnectionManager()
    caller_id = "caller-001"
    receiver_id = "receiver-002"

    caller_ws = AsyncMock()
    receiver_ws = AsyncMock()

    await manager.connect(caller_id, caller_ws)
    await manager.connect(receiver_id, receiver_ws)

    end_msg = {
        "type": "CALL_ENDED",
        "caller_id": caller_id,
        "receiver_id": receiver_id,
        "duration": 125
    }
    delivered = await manager.send_to_user(receiver_id, end_msg)
    assert delivered is True
    receiver_ws.send_json.assert_called_once_with(end_msg)

@pytest.mark.anyio
async def test_call_signaling_call_declined_response():
    manager = ConnectionManager()
    caller_id = "caller-001"
    callee_id = "callee-002"

    caller_ws = AsyncMock()
    callee_ws = AsyncMock()

    await manager.connect(caller_id, caller_ws)
    await manager.connect(callee_id, callee_ws)

    # Callee declines call -> sends CALL_RESPONSE accepted=False
    decline_response = {
        "type": "CALL_RESPONSE",
        "caller_id": caller_id,
        "receiver_id": caller_id,
        "accepted": False,
        "reason": "declined"
    }
    delivered = await manager.send_to_user(caller_id, decline_response)
    assert delivered is True
    caller_ws.send_json.assert_called_with(decline_response)

@pytest.mark.anyio
async def test_group_call_signaling_mesh_and_lifecycle():
    from app.routes.message import active_group_calls, handle_group_call_leave
    manager = ConnectionManager()
    conv_id = 9999
    user1_id = "group-user-1"
    user2_id = "group-user-2"
    user3_id = "group-user-3"

    ws1 = AsyncMock()
    ws2 = AsyncMock()
    ws3 = AsyncMock()

    await manager.connect(user1_id, ws1)
    await manager.connect(user2_id, ws2)
    await manager.connect(user3_id, ws3)

    # 1. Initialize active group call room with user 1 as initiator
    active_group_calls[conv_id] = {
        "conversation_id": conv_id,
        "initiator_id": user1_id,
        "call_type": "video",
        "participants": {
            user1_id: {"user_id": user1_id, "name": "User One", "avatar": None}
        }
    }
    assert conv_id in active_group_calls
    assert len(active_group_calls[conv_id]["participants"]) == 1

    # 2. User 2 joins group call
    user2_info = {"user_id": user2_id, "name": "User Two", "avatar": None}
    active_group_calls[conv_id]["participants"][user2_id] = user2_info

    # Send room state to user 2 (contains user 1)
    await manager.send_to_user(user2_id, {
        "type": "GROUP_CALL_ROOM_STATE",
        "conversation_id": conv_id,
        "participants": [active_group_calls[conv_id]["participants"][user1_id]]
    })
    ws2.send_json.assert_called_with({
        "type": "GROUP_CALL_ROOM_STATE",
        "conversation_id": conv_id,
        "participants": [active_group_calls[conv_id]["participants"][user1_id]]
    })

    # Notify existing participant (User 1) about User 2 joined
    await manager.send_to_user(user1_id, {
        "type": "GROUP_CALL_USER_JOINED",
        "conversation_id": conv_id,
        "user": user2_info
    })
    ws1.send_json.assert_called_with({
        "type": "GROUP_CALL_USER_JOINED",
        "conversation_id": conv_id,
        "user": user2_info
    })

    # 3. P2P WebRTC Signal forwarding between user 2 and user 1
    mesh_signal = {
        "type": "GROUP_CALL_SIGNAL",
        "conversation_id": conv_id,
        "from_user_id": user2_id,
        "to_user_id": user1_id,
        "signal": {"type": "offer", "sdp": "fake_offer_sdp"}
    }
    await manager.send_to_user(user1_id, mesh_signal)
    ws1.send_json.assert_called_with(mesh_signal)

    # 4. User 1 leaves group call
    await handle_group_call_leave(conv_id, user1_id)
    assert conv_id in active_group_calls
    assert user1_id not in active_group_calls[conv_id]["participants"]
    assert user2_id in active_group_calls[conv_id]["participants"]

    # 5. User 2 leaves -> room is cleaned up
    await handle_group_call_leave(conv_id, user2_id)
    assert conv_id not in active_group_calls

@pytest.mark.anyio
async def test_group_call_rest_endpoints():
    from app.routes.message import (
        start_group_call_endpoint,
        join_group_call_endpoint,
        leave_group_call_endpoint,
        get_group_call_status,
        active_group_calls
    )
    conv_id = 999
    active_group_calls.pop(conv_id, None)

    u1_id = "u1-uuid"
    u2_id = "u2-uuid"

    mock_db = MagicMock()
    mock_member = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_member

    # 1. Start call via REST
    start_res = await start_group_call_endpoint(
        conversation_id=conv_id,
        payload={"call_type": "video"},
        current_user_id=u1_id,
        db=mock_db
    )
    assert start_res["success"] is True
    assert start_res["is_active"] is True
    assert start_res["participants_count"] == 1

    # 2. Check call status via REST
    status_res = get_group_call_status(conversation_id=conv_id, current_user_id=u2_id, db=mock_db)
    assert status_res["is_active"] is True
    assert status_res["participants_count"] == 1

    # 3. Join call via REST
    join_res = await join_group_call_endpoint(conversation_id=conv_id, current_user_id=u2_id, db=mock_db)
    assert join_res["success"] is True
    assert len(join_res["participants"]) == 1

    # 4. Check status again -> 2 participants
    status_res2 = get_group_call_status(conversation_id=conv_id, current_user_id=u1_id, db=mock_db)
    assert status_res2["participants_count"] == 2

    # 5. Leave call via REST
    await leave_group_call_endpoint(conversation_id=conv_id, current_user_id=u1_id, db=mock_db)
    status_res3 = get_group_call_status(conversation_id=conv_id, current_user_id=u2_id, db=mock_db)
    assert status_res3["participants_count"] == 1

    await leave_group_call_endpoint(conversation_id=conv_id, current_user_id=u2_id, db=mock_db)
    status_res4 = get_group_call_status(conversation_id=conv_id, current_user_id=u1_id, db=mock_db)
    assert status_res4["is_active"] is False
    assert status_res4["participants_count"] == 0

@pytest.mark.anyio
async def test_group_call_end_creates_call_log():
    from app.routes.message import (
        handle_group_call_leave,
        active_group_calls,
        format_call_duration_str,
        manager
    )
    from datetime import datetime, timezone, timedelta

    assert format_call_duration_str(0) == "00:00"
    assert format_call_duration_str(65) == "01:05"
    assert format_call_duration_str(3665) == "01:01:05"

    conv_id = 888
    u1 = "user-alpha"
    u2 = "user-beta"

    active_group_calls[conv_id] = {
        "conversation_id": conv_id,
        "initiator_id": u1,
        "call_type": "video",
        "participants": {
            u1: {"user_id": u1, "name": "Alpha", "avatar": None},
            u2: {"user_id": u2, "name": "Beta", "avatar": None}
        },
        "started_at": datetime.now(timezone.utc) - timedelta(seconds=90),
        "max_participants": 2
    }

    ws1 = AsyncMock()
    ws2 = AsyncMock()
    await manager.connect(u1, ws1)
    await manager.connect(u2, ws2)

    # u1 leaves
    await handle_group_call_leave(conv_id, u1)
    assert conv_id in active_group_calls
    assert len(active_group_calls[conv_id]["participants"]) == 1

    # u2 leaves -> room cleans up
    await handle_group_call_leave(conv_id, u2)
    assert conv_id not in active_group_calls

@pytest.mark.anyio
async def test_start_group_call_auto_merges_when_room_already_active():
    from app.routes.message import (
        start_group_call_endpoint,
        active_group_calls,
        handle_group_call_leave
    )
    conv_id = 8888
    active_group_calls.pop(conv_id, None)

    u1_id = "user-1-host"
    u2_id = "user-2-joiner"

    mock_db = MagicMock()
    mock_member = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_member

    # 1. Host creates call
    res1 = await start_group_call_endpoint(
        conversation_id=conv_id,
        payload={"call_type": "video"},
        current_user_id=u1_id,
        db=mock_db
    )
    assert res1["success"] is True
    assert res1["participants_count"] == 1
    assert conv_id in active_group_calls

    # 2. Member joins by calling start_group_call (e.g. clicking "Gọi nhóm" instead of "Tham gia")
    # Must NOT overwrite or create isolated room!
    res2 = await start_group_call_endpoint(
        conversation_id=conv_id,
        payload={"call_type": "video"},
        current_user_id=u2_id,
        db=mock_db
    )
    assert res2["success"] is True
    assert res2["participants_count"] == 2
    assert len(active_group_calls[conv_id]["participants"]) == 2
    assert u1_id in active_group_calls[conv_id]["participants"]
    assert u2_id in active_group_calls[conv_id]["participants"]
    assert len(res2["existing_participants"]) == 1
    assert res2["existing_participants"][0]["user_id"] == u1_id

    # Cleanup
    await handle_group_call_leave(conv_id, u1_id)
    await handle_group_call_leave(conv_id, u2_id)
    assert conv_id not in active_group_calls




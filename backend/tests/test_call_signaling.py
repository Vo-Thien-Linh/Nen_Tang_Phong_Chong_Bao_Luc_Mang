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


import pytest
from app.services.livestream_service import LiveStreamService

def test_livestream_moderation_normal_content():
    text = "Chào mọi người nhé, buổi live vui quá!"
    is_blocked, score, reason = LiveStreamService.analyze_content(text)
    assert not is_blocked
    assert reason is None

def test_livestream_moderation_blacklist_keyword():
    text = "thằng vcl này nói linh tinh"
    is_blocked, score, reason = LiveStreamService.analyze_content(text)
    assert is_blocked
    assert score >= 0.60
    assert reason is not None

def test_livestream_moderation_ai_toxic_content():
    text = "mày là đồ điên, đồ khùng, đồ mất dạy"
    is_blocked, score, reason = LiveStreamService.analyze_content(text)
    assert is_blocked
    assert score >= 0.60
    assert "AI" in reason or "Ngôn từ" in reason

def test_livestream_moderation_ai_violence_content():
    text = "tao sẽ đánh chết mày, đâm chết cả nhà mày"
    is_blocked, score, reason = LiveStreamService.analyze_content(text)
    assert is_blocked
    assert score >= 0.60

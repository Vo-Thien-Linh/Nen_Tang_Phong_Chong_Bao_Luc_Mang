from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="", tags=["Quản trị & Báo cáo (Admin)"])

# Dữ liệu bộ nhớ tạm cho báo cáo & khiếu nại
reports_db = [
    {
        "id": "rep-1",
        "reporter": {"id": "user-1", "name": "Lê Thu Trang", "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200"},
        "targetType": "post",
        "targetId": "post-3",
        "targetAuthor": {"name": "Trần Hoàng Nam", "username": "nam_traveler"},
        "contentExcerpt": "Hoàng hôn ở Đà Lạt chiều nay bình yên lạ thường...",
        "reason": "spam",
        "reasonLabel": "Spam / Tin rác",
        "details": "Nghi ngờ bài viết chứa liên kết quảng cáo spam.",
        "status": "pending",
        "adminNotes": "",
        "createdAt": "40 phút trước",
        "aiStatus": {"label": "Normal", "confidence": 0.99}
    }
]

appeals_db = [
    {
        "id": "app-1",
        "user": {"id": "user-current", "name": "Võ Thiện Linh", "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"},
        "contentType": "post",
        "contentId": "post-2",
        "originalText": "Hôm nay team em 'tiêu diệt' gọn ghẽ đống bug cứng đầu!",
        "aiPredictedLabel": "Violence",
        "aiConfidence": 0.912,
        "aiActionTaken": "warn_user",
        "appealReason": "Tôi ví von 'tiêu diệt bug', không có ý định bạo lực.",
        "status": "pending",
        "adminNotes": "",
        "createdAt": "25 phút trước"
    }
]

@router.get("/admin/stats")
def get_admin_stats():
    return {
        "success": True,
        "data": {
            "totalContentScanned": 1845,
            "pendingReports": len([r for r in reports_db if r["status"] == "pending"]),
            "pendingAppeals": len([a for a in appeals_db if a["status"] == "pending"]),
            "falsePositivesOverridden": 1,
            "estimatedAiAccuracy": 96.4,
            "avgLatencyMs": 42.8,
            "distribution": {
                "normal": 1620,
                "toxic": 135,
                "hateSpeech": 42,
                "violence": 48
            }
        }
    }

@router.get("/reports")
def get_reports():
    return {"success": True, "data": reports_db}

@router.get("/appeals")
def get_appeals():
    return {"success": True, "data": appeals_db}

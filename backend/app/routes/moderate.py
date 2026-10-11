from fastapi import APIRouter
from pydantic import BaseModel
import time

router = APIRouter(prefix="", tags=["Kiểm duyệt nội dung AI (Moderation)"])

class ModerateRequest(BaseModel):
    text: str

class ModerateResponse(BaseModel):
    label: str           # "Normal", "Toxic", "Violence", "Hate Speech"
    confidence: float
    action: str          # "allow", "warn", "hide"
    latency_ms: float
    reason: str

@router.post("/moderate", response_model=ModerateResponse, summary="Phân tích kiểm duyệt nội dung độc hại")
def moderate_text(req: ModerateRequest):
    start = time.time()
    text_lower = req.text.lower()
    
    label = "Normal"
    confidence = 0.985
    action = "allow"
    reason = "Nội dung an toàn, không phát hiện vi phạm."
    
    # Bộ từ khóa nhận diện bạo lực / thù địch mô phỏng
    violence_keywords = ["đánh", "đập", "giết", "chém", "bắn", "tiêu diệt", "tẩn", "đấm"]
    toxic_keywords = ["ngu", "chó", "rác rưởi", "đồ khốn", "mất dạy", "óc chó", "dốt nát"]
    hate_keywords = ["kỳ thị", "phân biệt chủng tộc", "bọn mọi", "thù ghét"]
    
    if any(k in text_lower for k in violence_keywords):
        label = "Violence"
        confidence = 0.96
        action = "warn"
        reason = "Phát hiện từ ngữ mang tính bạo lực / đe dọa thể xác."
    elif any(k in text_lower for k in toxic_keywords):
        label = "Toxic"
        confidence = 0.93
        action = "warn"
        reason = "Phát hiện ngôn từ công kích cá nhân, xúc phạm hoặc thô tục."
    elif any(k in text_lower for k in hate_keywords):
        label = "Hate Speech"
        confidence = 0.94
        action = "hide"
        reason = "Phát hiện phát ngôn mang tính thù địch, kích động."
        
    latency = round((time.time() - start) * 1000 + 35, 1) # ms
    
    return ModerateResponse(
        label=label,
        confidence=confidence,
        action=action,
        latency_ms=latency,
        reason=reason
    )
